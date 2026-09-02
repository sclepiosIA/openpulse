#!/usr/bin/env node
/**
 * Le dépôt est-il prêt à être PARTAGÉ, puis PUBLIÉ ?
 *
 * POURQUOI CET OUTIL EST SÉPARÉ DES AUTRES
 * Les neuf contrôles de `gate.sh` répondent à « le code est-il sain ? » : pas de
 * secret, pas de marque résiduelle, pas de réécriture à moitié faite. Ils
 * peuvent tous être verts sur un dépôt qu'il serait pourtant irresponsable
 * d'ouvrir — parce que sa politique de sécurité renvoie dans le vide, ou parce
 * qu'un document promet une adresse que personne ne relève.
 *
 * Celui-ci répond à une autre question : « quelqu'un peut-il utiliser ce dépôt,
 * et signaler un problème à quelqu'un ? » — et il la pose à deux niveaux.
 *
 * DEUX SEUILS, ET LA DIFFÉRENCE COMPTE
 * Remettre le dépôt à un partenaire n'est pas l'ouvrir au monde, et les deux
 * n'exigent pas la même chose :
 *
 *   PARTAGE — le dépôt peut être remis à un tiers : rien n'y fuit, il se
 *   construit, et il porte sa licence, ses attributions et ses documents
 *   d'entrée. Le tiers est identifié ; s'il trouve une faille, il sait à qui
 *   écrire.
 *
 *   PUBLICATION — le dépôt est ouvert à des inconnus. Il faut alors un canal
 *   de signalement que quelqu'un relève réellement. Un dépôt public dont la
 *   politique de sécurité renvoie dans le vide est pire qu'un dépôt sans
 *   politique : il laisse croire qu'un signalement a été reçu.
 *
 * L'outil rend le détail des deux. Le code de sortie porte sur le PARTAGE, qui
 * est le seuil atteignable aujourd'hui ; `--publication` le fait porter sur le
 * seuil supérieur.
 *
 * Il n'est pas dans `gate.sh` : un contrôle rouge en permanence finit par
 * n'être plus lu, et entraînerait les autres dans son discrédit.
 *
 * Usage : node verifier-pret-a-publier.mjs [racine] [--publication]
 * Sortie : code 1 si un prérequis du seuil demandé n'est pas tenu.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const seuilPublication = args.includes('--publication');
const racine = args.find((a) => !a.startsWith('--')) || '.';

const prerequis = [];
const tenu = (quoi, seuil = 'partage') => prerequis.push({ ok: true, quoi, seuil });
const manque = (quoi, pourquoi, seuil = 'partage') =>
  prerequis.push({ ok: false, quoi, pourquoi, seuil });

const lire = (rel) => {
  const p = join(racine, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

// --- 1. une adresse de signalement réellement relevée -----------------------

const securite = lire('SECURITY.md');
if (!securite) {
  manque('SECURITY.md', 'le fichier est absent');
} else if (/à renseigner|a renseigner/i.test(securite)) {
  manque(
    "l'adresse de signalement de SECURITY.md",
    "elle porte encore « à renseigner ». Un dépôt PUBLIC dont la politique de " +
    "sécurité renvoie dans le vide est pire qu'un dépôt sans politique : il " +
    "laisse croire qu'un signalement a été reçu. L'adresse doit être relevée " +
    "par une personne, pas seulement configurée.\n" +
    "          Pour un partage à un tiers identifié, ce point n'est pas " +
    "bloquant : il sait à qui écrire.",
    'publication',
  );
} else {
  tenu("adresse de signalement de SECURITY.md", 'publication');
}

// --- 2. une licence, et un fichier qui la porte -----------------------------

const licence = lire('LICENSE');
if (!licence || licence.trim().length < 100) {
  manque('LICENSE', 'absent ou trop court pour porter un texte de licence');
} else {
  tenu('LICENSE');
}

// --- 3. package.json doit dire ce qu'est ce paquet --------------------------
//
// Un lecteur qui arrive par npm ne lit pas le README en premier : il lit les
// métadonnées. `private: true` sans licence ni dépôt déclaré ne lui apprend
// rien, et l'empêche même de savoir sous quelles conditions il peut s'en servir.

const paquet = lire('package.json');
if (!paquet) {
  manque('package.json', 'absent');
} else {
  const p = JSON.parse(paquet);
  const attendus = ['license', 'description', 'repository'];
  const absents = attendus.filter((c) => !p[c]);
  if (absents.length) {
    manque(
      `métadonnées de package.json (${absents.join(', ')})`,
      "un lecteur venu du registre de paquets lit ces champs avant le README"
    );
  } else {
    tenu('métadonnées de package.json');
  }
}

// --- 4. les portes d'entrée du dépôt ----------------------------------------

for (const [fichier, role] of [
  ['README.md', "la première page que lit un visiteur"],
  ['CONTRIBUTING.md', "ce qu'un contributeur a le droit de modifier"],
  ['NOTICE', "les attributions dues aux dépendances"],
]) {
  if (lire(fichier)) tenu(fichier);
  else manque(fichier, role);
}

// --- 5. le README doit renvoyer vers la gouvernance -------------------------

const readme = lire('README.md');
if (readme) {
  const renvois = ['CONTRIBUTING', 'SECURITY', 'LICENSE'];
  const oublies = renvois.filter((r) => !readme.includes(r));
  if (oublies.length) {
    manque(
      `renvois du README (${oublies.join(', ')})`,
      "un visiteur qui ne les trouve pas depuis la première page ne les cherchera pas"
    );
  } else {
    tenu('renvois du README vers la gouvernance');
  }
}

// --- rapport ----------------------------------------------------------------

const duPartage = prerequis.filter((p) => p.seuil === 'partage');
const dePublication = prerequis.filter((p) => p.seuil === 'publication');

const rendre = (titre, liste) => {
  console.log(titre);
  for (const p of liste) {
    if (p.ok) console.log(`  OK      ${p.quoi}`);
    else {
      console.log(`  MANQUE  ${p.quoi}`);
      console.log(`          ${p.pourquoi}`);
    }
  }
  console.log();
};

rendre('Prérequis du PARTAGE — remettre le dépôt à un tiers identifié', duPartage);
rendre('Prérequis supplémentaires de la PUBLICATION — ouvrir à des inconnus', dePublication);

const manquePartage = duPartage.filter((p) => !p.ok);
const manquePublication = dePublication.filter((p) => !p.ok);

if (manquePartage.length) {
  console.error(
    `prêt à partager : NON — ${manquePartage.length} prérequis non tenu(s).`
  );
  process.exit(1);
}

console.log(`prêt à partager : OUI — ${duPartage.length} prérequis tenus.`);

if (manquePublication.length) {
  const mot = seuilPublication ? 'NON' : 'pas encore';
  console.log(
    `prêt à publier  : ${mot} — ${manquePublication.length} prérequis ` +
    `supplémentaire(s) à tenir avant d'ouvrir à des inconnus.`
  );
  if (seuilPublication) process.exit(1);
} else {
  console.log(`prêt à publier  : OUI — les deux seuils sont tenus.`);
}
