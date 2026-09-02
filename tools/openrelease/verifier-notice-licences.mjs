#!/usr/bin/env node
/**
 * Les chiffres de licence écrits dans les documents disent-ils encore la
 * vérité ?
 *
 * POURQUOI CET OUTIL EXISTE
 * `auditer-licences.mjs` mesure l'arbre de production. `NOTICE`,
 * `docs/LICENCES_DEPENDANCES.md` et `CHANTIER.md` en RECOPIENT le résultat, à
 * la main. Rien ne reliait les deux, et ils ont divergé : pendant trois jours,
 * ces documents ont annoncé une dépendance GPL-3.0 dans l'arbre de production,
 * deux paquets sous licence non approuvée par l'OSI et deux sans licence —
 * alors que les quatre paquets avaient été retirés et remplacés.
 *
 * Le sens de la dérive compte. `NOTICE` est la pièce qu'un service juridique
 * lit avant d'autoriser une adoption : un dépôt dont les papiers s'accusent
 * eux-mêmes d'une contamination levée se fait refuser sur sa propre foi. Dans
 * l'autre sens, un dépôt dont les papiers taisent une contamination réelle fait
 * construire dessus des gens qui l'apprendront trop tard. Les deux sont graves,
 * et aucune barrière ne les voyait : celle du dépôt imprime l'audit sans jamais
 * le comparer à ce que les documents en disent.
 *
 * Ce que l'outil vérifie :
 *   1. les quatre nombres de `NOTICE` et le total ;
 *   2. le tableau de `docs/LICENCES_DEPENDANCES.md` ;
 *   3. la ligne de synthèse de `CHANTIER.md` ;
 *   4. que chaque paquet à réciprocité faible mesuré par l'auditeur est bien
 *      nommé dans `NOTICE` — c'est la seule obligation que la MPL fait porter
 *      à qui redistribue.
 *
 * Ce qu'il ne vérifie pas : la prose. Un document peut être exact et illisible.
 *
 * Usage : node verifier-notice-licences.mjs [racine]
 * Sortie : code 1 si un chiffre ou une attribution diverge de la mesure.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
let fautes = 0;
const faute = (m) => { fautes++; console.error(`  MANQUE  ${m}`); };
const tenu = (m) => console.log(`  OK      ${m}`);

// --- la mesure ---------------------------------------------------------------

let sortie;
try {
  sortie = execFileSync('node', [join(racine, 'tools/openrelease/auditer-licences.mjs'), racine], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  // Un contrôle qui ne peut pas mesurer ne doit pas se taire : son silence
  // passerait pour un vert.
  console.error("l'audit des licences n'a pas pu s'exécuter : rien n'a été vérifié");
  console.error(String(e.stderr ?? e.message).split('\n').slice(0, 3).join('\n'));
  process.exit(1);
}

const nombre = (motif) => {
  const m = sortie.match(motif);
  return m ? Number(m[1]) : null;
};

const mesure = {
  total: nombre(/Arbre de production\s*:\s*(\d+)\s+paquets/),
  permissives: nombre(/permissives\s+(\d+)/),
  faible: nombre(/r[ée]ciprocit[ée] faible\s+(\d+)/),
  forte: nombre(/r[ée]ciprocit[ée] forte\s+(\d+)/),
  inconnues: nombre(/non identifi[ée]es\s+(\d+)/),
};

if (Object.values(mesure).some((v) => v === null)) {
  console.error("la sortie de l'auditeur n'a pas le format attendu : rien n'a été vérifié");
  process.exit(1);
}

const paquetsFaibles = [...sortie.matchAll(/^\s{2}(\S+)@\S*\s+—\s+MPL-2\.0/gm)].map((m) => m[1]);

console.log(
  `mesure : ${mesure.total} paquets — ${mesure.permissives} permissives, ` +
  `${mesure.faible} réciprocité faible, ${mesure.forte} forte, ${mesure.inconnues} non identifiées`
);
console.log();

// --- les documents -----------------------------------------------------------

const lire = (rel) => {
  const p = join(racine, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};
// « 1 014 », « 1 014 » (espace insécable), « 1014 » désignent le même nombre.
const chiffres = (t) => t.replace(/(\d)[\s  ](\d)/g, '$1$2');

const controler = (fichier, attendus) => {
  const brut = lire(fichier);
  if (!brut) { faute(`${fichier} est absent`); return; }
  const t = chiffres(brut);
  for (const [quoi, valeur, motif] of attendus) {
    if (motif.test(t)) tenu(`${fichier} — ${quoi} : ${valeur}`);
    else faute(`${fichier} — ${quoi} devrait valoir ${valeur} ; le document dit autre chose`);
  }
};

controler('NOTICE', [
  ['total de l’arbre de production', mesure.total, new RegExp(`compte ${mesure.total} paquets`)],
  ['paquets permissifs', mesure.permissives, new RegExp(`dont ${mesure.permissives} sous licence permissive`)],
]);

// NOTICE doit dire s'il reste, ou non, de la réciprocité forte et des paquets
// sans licence : c'est la phrase que lit un juriste.
const notice = lire('NOTICE');
if (notice) {
  const dit = /Aucun paquet a\s+reciprocite forte, aucun paquet sans licence declaree/.test(chiffres(notice));
  if (mesure.forte === 0 && mesure.inconnues === 0) {
    if (dit) tenu('NOTICE — mention « aucune réciprocité forte, aucune licence absente »');
    else faute("NOTICE — la mesure ne trouve ni réciprocité forte ni licence absente ; NOTICE ne le dit pas");
  } else if (dit) {
    faute(
      `NOTICE affirme qu'il n'y a ni réciprocité forte ni licence absente, alors que la ` +
      `mesure en compte ${mesure.forte} et ${mesure.inconnues}`
    );
  }
}

controler('docs/LICENCES_DEPENDANCES.md', [
  ['permissives du tableau', mesure.permissives, new RegExp(`\\|\\s*${mesure.permissives}\\s*\\|`)],
  ['réciprocité faible du tableau', mesure.faible, new RegExp(`MPL-2\\.0\\)\\s*\\|\\s*${mesure.faible}\\s*\\|`)],
  ['réciprocité forte du tableau', mesure.forte, new RegExp(`R[ée]ciprocit[ée] forte\\s*\\|\\s*\\*{0,2}${mesure.forte}\\*{0,2}\\s*\\|`)],
  ['non identifiées du tableau', mesure.inconnues, new RegExp(`Non identifi[ée]es\\s*\\|\\s*\\*{0,2}${mesure.inconnues}\\*{0,2}\\s*\\|`)],
  ['total annoncé', mesure.total, new RegExp(`Total\\s*:\\s*${mesure.total} paquets`)],
]);

controler('CHANTIER.md', [
  ['ligne de synthèse', mesure.total, new RegExp(`${mesure.total} paquets\\s*:\\s*${mesure.permissives} permissifs`)],
]);

// --- attributions dues -------------------------------------------------------

if (notice) {
  // `lightningcss-darwin-arm64` est couvert par « lightningcss, et ses variantes
  // de plateforme (…, darwin-arm64, …) » : on accepte le nom entier OU son
  // suffixe de plateforme, à condition que la famille soit nommée.
  const absents = paquetsFaibles.filter((nom) => {
    if (notice.includes(nom)) return false;
    const m = nom.match(/^(.*?)-((?:android|darwin|freebsd|linux|win32)[\w-]*)$/);
    return !(m && notice.includes(m[1]) && notice.includes(m[2]));
  });
  if (absents.length) {
    faute(
      `NOTICE ne nomme pas ${absents.length} paquet(s) à réciprocité faible : ` +
      `${absents.slice(0, 5).join(', ')}${absents.length > 5 ? '…' : ''}. ` +
      `La MPL n'impose qu'une chose à qui redistribue : les citer.`
    );
  } else {
    tenu(`NOTICE — les ${paquetsFaibles.length} paquets à réciprocité faible sont tous cités`);
  }
}

console.log();
if (fautes) {
  console.error(
    `licences des documents : ${fautes} écart(s) avec la mesure.\n` +
    `Rejouez « node tools/openrelease/auditer-licences.mjs . » et reportez la sortie.`
  );
  process.exit(1);
}
console.log('licences des documents : conformes à la mesure');
