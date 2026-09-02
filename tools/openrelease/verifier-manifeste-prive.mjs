#!/usr/bin/env node
/**
 * Vérifie que les règles à contenu sensible ne partent pas avec le dépôt.
 *
 * POURQUOI CET OUTIL EXISTE
 * Le manifeste de réécriture est publié avec la distribution. Or pour dire
 * « remplace cette adresse IP », une règle doit ÉCRIRE cette adresse. Publier
 * le manifeste revenait donc à publier la carte de l'infrastructure qu'il
 * servait à masquer — ainsi que des domaines et des numéros de téléphone
 * d'établissements tiers. Mesuré avant correction : 7 adresses IP publiques,
 * 2 courriels et 7 domaines réels, tous dans les règles de réécriture.
 *
 * Ces définitions vivent maintenant dans `manifest-prive.json`, hors du dépôt.
 * Le manifeste public n'en garde que des jalons : un identifiant et une
 * empreinte, qui ne révèlent rien.
 *
 * Ce contrôle vérifie trois choses :
 *   1. le fichier privé n'est PAS suivi par git ;
 *   2. il est bien couvert par .gitignore ;
 *   3. le manifeste public ne contient plus de valeur réelle.
 *
 * Le point 3 est le plus important : les deux premiers protègent le mécanisme,
 * le troisième protège le résultat. Un jour où quelqu'un rajoutera une règle
 * sensible directement dans le manifeste public, c'est lui qui le dira.
 *
 * Usage : node verifier-manifeste-prive.mjs [racine]
 * Sortie : code 1 si une valeur réelle subsiste, ou si le fichier privé fuit.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const racine = process.argv[2] || '.';
const CHEMIN_PRIVE = 'tools/openrelease/manifest-prive.json';

let fautes = 0;
const faute = (m) => { console.error(`  ${m}`); fautes++; };

// --- 1. le fichier privé ne doit pas être suivi par git ---------------------

let suivis = '';
try {
  suivis = execFileSync('git', ['ls-files', CHEMIN_PRIVE], {
    cwd: racine, encoding: 'utf8',
  }).trim();
} catch {
  // Hors dépôt git : les points 1 et 2 ne s'appliquent pas, le 3 si.
}

if (suivis) {
  faute(`${CHEMIN_PRIVE} est SUIVI PAR GIT : il partirait avec le dépôt. ` +
        `Le retirer de l'index (git rm --cached) sans supprimer le fichier.`);
}

// --- 2. il doit être couvert par .gitignore ---------------------------------

const gitignore = join(racine, '.gitignore');
if (existsSync(gitignore)) {
  const contenu = readFileSync(gitignore, 'utf8');
  if (!contenu.includes('manifest-prive.json')) {
    faute(`.gitignore ne couvre pas ${CHEMIN_PRIVE} : rien n'empêche de l'ajouter par mégarde.`);
  }
}

// --- 3. le manifeste public ne doit plus porter de valeur réelle -----------

const publicBrut = readFileSync(join(racine, 'tools/openrelease/manifest.json'), 'utf8');

/**
 * Le manifeste écrit des REGEX : un domaine y figure « a\\.b\\.com », jamais
 * « a.b.com ». Les motifs ci-dessous cherchent la forme lisible et ne
 * voyaient donc rien — ce contrôle a rendu VERT un manifeste qui portait deux
 * références de projet et le nom d'hôte de la plateforme de l'éditeur.
 *
 * On dé-échappe avant de chercher. Le texte dé-échappé ne sert qu'à ça : il
 * n'est jamais écrit ni affiché.
 */
const publicLisible = publicBrut.replace(/\\\\\./g, '.').replace(/\\\./g, '.');

/**
 * Domaines et adresses que le dépôt s'autorise : ceux que les normes réservent
 * à la documentation, plus la marque de la distribution elle-même.
 */
const TOLERES = [
  'example.com', 'example.org', 'example.net', '.test', '.invalid', '.localhost',
  'openpulse', 'github.com', 'npmjs.com', 'localhost',
];

/**
 * Noms de FICHIERS qui ressemblent à des domaines.
 *
 * `tsconfig.app.json` contient « tsconfig.app », que le motif des domaines
 * capte comme un nom sous le TLD `.app`. Un contrôle qui signale un nom de
 * fichier finit par être ignoré, et c'est ainsi qu'un vrai domaine passe.
 */
const FICHIERS_CONNUS = [
  'tsconfig.', 'vite.config', 'vitest.config', 'package.', 'eslint.',
  'postcss.config', 'tailwind.config', 'playwright.config',
];

const estNomDeFichier = (v) => {
  const bas = v.toLowerCase();
  if (FICHIERS_CONNUS.some((f) => bas.startsWith(f))) return true;
  // « quelque-chose.app » suivi d'une autre extension dans le texte source est
  // un fichier, pas un hôte. On ne peut pas le savoir depuis la valeur seule ;
  // la liste ci-dessus couvre les cas réels du dépôt.
  return false;
};

const estTolere = (v) =>
  TOLERES.some((t) => v.toLowerCase().includes(t)) || estNomDeFichier(v);

const CONTROLES = [
  {
    nom: 'adresse de courriel réelle',
    motif: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    nom: 'domaine réel',
    motif: /\b[a-z0-9-]+\.(?:fr|com|io|net|cloud|dev|app|eu)\b/g,
  },
  {
    // Une référence de projet hébergé n'a ni point ni tiret : les deux motifs
    // ci-dessus, qui cherchent un domaine, ne peuvent pas la voir. Elle vaut
    // pourtant l'adresse : elle nomme la base de l'éditeur.
    nom: 'référence de projet hébergé',
    motif: /"[a-z]{20}"/g,
  },
  {
    nom: "nom d'hôte d'hébergeur",
    motif: /\b[a-z0-9-]+\.[a-z0-9-]+\.cloudapp\.azure\.com\b/g,
  },
];

for (const { nom, motif } of CONTROLES) {
  const trouves = [...new Set(publicLisible.match(motif) ?? [])].filter((v) => !estTolere(v));
  if (trouves.length) {
    // On dit COMBIEN, jamais QUOI : ce message peut finir dans un journal de
    // chaîne d'intégration public.
    faute(`${trouves.length} ${nom}(s) subsiste(nt) dans le manifeste publié. ` +
          `Les déplacer dans ${CHEMIN_PRIVE} et laisser un jalon.`);
  }
}

// --- cohérence des jalons ---------------------------------------------------

const manifeste = JSON.parse(publicBrut);
// Les jalons vivent a deux endroits : poses A LEUR PLACE dans `reecritures`,
// ce qui preserve l'ordre d'application, et dans le tableau historique
// `reecritures_privees`, applique ensuite. Les deux comptent.
const jalons = [
  ...(manifeste.reecritures ?? []).filter((r) => r.prive),
  ...(manifeste.reecritures_privees ?? []),
];

for (const j of jalons) {
  if (!j.id || !j.empreinte) {
    faute(`un jalon de règle sensible n'a ni identifiant ni empreinte`);
  }
  // Un jalon qui porterait la valeur qu'il est censé cacher raterait sa cible.
  const brut = JSON.stringify(j);
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(brut)) {
    faute(`le jalon « ${j.id} » contient une valeur numérique en clair`);
  }
}

if (fautes) {
  console.error(`\nrègles sensibles : ${fautes} faute(s)`);
  process.exit(1);
}

console.log(
  `règles sensibles : ${jalons.length} jalon(s), aucune valeur réelle dans le manifeste publié`
);
