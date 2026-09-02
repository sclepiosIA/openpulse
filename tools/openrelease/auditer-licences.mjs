#!/usr/bin/env node
/**
 * Audite les licences des dépendances embarquées dans le produit livré.
 *
 * POURQUOI CET OUTIL EXISTE
 * Publier sous licence MIT n'engage que le code écrit ici. Les dépendances
 * arrivent avec les leurs, et une seule licence à réciprocité forte dans
 * l'arbre de production suffit à contaminer la distribution — un adoptant qui
 * s'en aperçoit après coup a déjà construit dessus. Le contrôle se fait donc
 * avant la publication, et se rejoue à chaque mise à jour de dépendances.
 *
 * Seul l'arbre de PRODUCTION est jugé : ce qui ne part pas dans le paquet livré
 * n'impose rien à l'adoptant. Les licences y sont classées en trois niveaux.
 *
 * Usage : node auditer-licences.mjs [racine]
 * Sortie : code 1 si une licence interdite ou inconnue est présente.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const racine = process.argv[2] || '.';

/** Licences permissives : aucune contrainte pour l'adoptant. */
const PERMISSIVES = [
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0',
  'Unlicense', 'CC0-1.0', 'BlueOak-1.0.0', 'Python-2.0', 'WTFPL', 'Zlib',
  'CC-BY-4.0', 'CC-BY-3.0', 'MIT-0', 'BSD', 'Artistic-2.0', 'UPL-1.0',
];

/**
 * Réciprocité faible : la contrainte porte sur le fichier modifié, pas sur
 * l'œuvre qui l'utilise. Tolérées, mais listées — un adoptant qui redistribue
 * doit savoir qu'elles sont là.
 */
// `OFL-1.1` (licence libre SIL pour les fontes) est classee ici, et non parmi
// les permissives : elle n'impose rien au LOGICIEL, mais une fonte derivee doit
// rester sous OFL et ne peut pas etre vendue seule. C'est exactement la forme
// « la contrainte porte sur le fichier modifie » — un adoptant qui redistribue
// doit le savoir, donc elle est mentionnee dans NOTICE comme les MPL.
const RECIPROCITE_FAIBLE = ['MPL-2.0', 'LGPL-3.0', 'LGPL-2.1', 'LGPL-3.0-or-later', 'EPL-2.0', 'CDDL-1.0', 'OFL-1.1'];

/** Réciprocité forte : contaminent la distribution. Interdites en production. */
const INTERDITES = [
  'GPL-2.0', 'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later', 'AGPL-3.0',
  'AGPL-3.0-only', 'AGPL-3.0-or-later', 'SSPL-1.0', 'BUSL-1.1', 'Commons-Clause',
];

const normaliser = (l) => String(l || '').replace(/^\(|\)$/g, '').trim();

/** Une expression « A OR B » est acceptable si UNE des branches l'est. */
function classer(expression) {
  const brut = normaliser(expression);
  if (!brut) return 'inconnue';
  const branches = brut.split(/\s+OR\s+/i).map(normaliser);
  const classes = branches.map((b) => {
    const parties = b.split(/\s+AND\s+/i).map(normaliser);
    if (parties.some((p) => INTERDITES.includes(p))) return 'interdite';
    if (parties.some((p) => RECIPROCITE_FAIBLE.includes(p))) return 'faible';
    if (parties.every((p) => PERMISSIVES.includes(p))) return 'permissive';
    return 'inconnue';
  });
  if (classes.includes('permissive')) return 'permissive';
  if (classes.includes('faible')) return 'faible';
  if (classes.includes('inconnue')) return 'inconnue';
  return 'interdite';
}

let arbre;
try {
  arbre = JSON.parse(execSync('npm ls --all --json --omit=dev --long', {
    cwd: racine, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }));
} catch (e) {
  // npm ls sort en code non nul dès qu'il signale une extranéité : la sortie
  // reste exploitable, et l'ignorer masquerait tout l'arbre.
  try { arbre = JSON.parse(e.stdout); } catch { console.error("npm ls illisible"); process.exit(2); }
}

const paquets = new Map();
(function parcourir(noeud, chemin) {
  for (const [nom, dep] of Object.entries(noeud.dependencies || {})) {
    const cle = `${nom}@${dep.version || '?'}`;
    if (paquets.has(cle)) continue;
    paquets.set(cle, { nom, version: dep.version, chemin: dep.path || chemin, licence: dep.license });
    parcourir(dep, dep.path || chemin);
  }
})(arbre, join(racine, 'node_modules'));

const parClasse = { permissive: [], faible: [], interdite: [], inconnue: [] };
const parLicence = new Map();

// Troisieme recours : le fichier de verrouillage.
//
// POURQUOI IL EST NECESSAIRE
// Certains paquets publient une archive dont le `package.json` ne porte aucun
// champ `license`, alors que le registre en declare un — `@mapbox/jsonlint-lines-primitives`
// est dans ce cas, et il est en production via `maplibre-gl`. Les deux recours
// precedents dependent alors de ce que `npm ls` veut bien resoudre, ce qui varie
// d'une reconstruction a l'autre : le meme arbre rendait tantot « 1000
// permissives, 0 inconnue », tantot une inconnue bloquante, sans qu'aucune
// dependance n'ait bouge. Un controle de publication qui oscille ne mesure rien.
//
// `package-lock.json` est versionne et fige la metadonnee du registre au moment
// de l'installation : c'est la source la plus stable dont on dispose.
/**
 * Deduit la licence du texte livre, quand aucune metadonnee ne la porte.
 *
 * On ne reconnait que des en-tetes canoniques et non ambigus. Toute autre
 * formulation rend la chaine vide : le paquet est alors signale comme
 * « a qualifier a la main », ce qui est le comportement sur.
 */
function licenceDepuisLeTexte(chemin, racine, nom) {
  const dossier = chemin || join(racine, 'node_modules', nom);
  const EMPREINTES = [
    [/\bMIT License\b/i, 'MIT'],
    [/\bApache License\b[\s\S]{0,200}\bVersion 2\.0\b/i, 'Apache-2.0'],
    [/\bISC License\b/i, 'ISC'],
    [/\bBSD 3-Clause\b/i, 'BSD-3-Clause'],
    [/\bBSD 2-Clause\b/i, 'BSD-2-Clause'],
    [/\bMozilla Public License\b[\s\S]{0,120}\b2\.0\b/i, 'MPL-2.0'],
  ];
  for (const nomFichier of ['LICENSE', 'license', 'LICENSE.md', 'license.md', 'LICENCE', 'licence']) {
    const fichier = join(dossier, nomFichier);
    if (!existsSync(fichier)) continue;
    let texte = '';
    try { texte = readFileSync(fichier, 'utf8').slice(0, 4000); } catch { continue; }
    for (const [motif, spdx] of EMPREINTES) if (motif.test(texte)) return spdx;
    return '';
  }
  return '';
}

const licencesDuVerrou = (() => {
  const table = new Map();
  const chemin = join(racine, 'package-lock.json');
  if (!existsSync(chemin)) return table;
  try {
    const verrou = JSON.parse(readFileSync(chemin, 'utf8'));
    for (const [emplacement, entree] of Object.entries(verrou.packages || {})) {
      if (!emplacement || typeof entree?.license !== 'string') continue;
      // « node_modules/a/node_modules/b » -> « b »
      const nom = emplacement.split('node_modules/').pop();
      if (nom) table.set(`${nom}@${entree.version || '?'}`, entree.license);
    }
  } catch { /* verrou illisible : on s'en passe */ }
  return table;
})();

for (const [cle, info] of paquets) {
  // --long porte deja la licence ; la lecture du package.json ne sert que de
  // repli quand npm ne la resout pas.
  let licence = typeof info.licence === 'string' ? info.licence
    : info.licence?.type || '';
  const pj = join(info.chemin || join(racine, 'node_modules', info.nom), 'package.json');
  if (!licence && existsSync(pj)) {
    try {
      const m = JSON.parse(readFileSync(pj, 'utf8'));
      licence = typeof m.license === 'string' ? m.license
        : m.license?.type || (Array.isArray(m.licenses) ? m.licenses.map((l) => l.type).join(' OR ') : '');
    } catch { /* métadonnées illisibles : traité comme inconnu */ }
  }
  if (!licence) licence = licencesDuVerrou.get(cle) || '';
  // Quatrieme recours : le TEXTE de licence livre avec le paquet.
  //
  // Beaucoup de paquets omettent le champ `license` mais livrent un fichier
  // `LICENSE` (ou `license`, sans majuscules). Sans ce recours, ils sont
  // rapportes « a qualifier a la main » alors que la reponse est dans l'archive
  // — `khroma` est dans ce cas, et il arrive en production via la bibliotheque
  // de canevas. On ne reconnait que les en-tetes canoniques, et on s'abstient
  // au moindre doute : mal qualifier une licence coute plus cher que d'en
  // signaler une inconnue.
  if (!licence) licence = licenceDepuisLeTexte(info.chemin, racine, info.nom);
  const classe = classer(licence);
  parClasse[classe].push({ cle, licence: licence || '(absente)' });
  parLicence.set(licence || '(absente)', (parLicence.get(licence || '(absente)') || 0) + 1);
}

console.log(`Arbre de production : ${paquets.size} paquets\n`);
console.log('Répartition par licence :');
for (const [lic, n] of [...parLicence].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(n).padStart(5)}  ${lic}`);
}
console.log(`\n  permissives            ${parClasse.permissive.length}`);
console.log(`  réciprocité faible     ${parClasse.faible.length}`);
console.log(`  réciprocité forte      ${parClasse.interdite.length}`);
console.log(`  non identifiées        ${parClasse.inconnue.length}`);

if (parClasse.faible.length) {
  console.log('\nRéciprocité faible — à mentionner dans NOTICE :');
  for (const p of parClasse.faible) console.log(`  ${p.cle} — ${p.licence}`);
}
if (parClasse.interdite.length) {
  console.log('\nRÉCIPROCITÉ FORTE dans l\'arbre de production :');
  for (const p of parClasse.interdite) console.log(`  ${p.cle} — ${p.licence}`);
}
if (parClasse.inconnue.length) {
  console.log('\nLicences non identifiées — à qualifier à la main :');
  for (const p of parClasse.inconnue.slice(0, 40)) console.log(`  ${p.cle} — ${p.licence}`);
  if (parClasse.inconnue.length > 40) console.log(`  … et ${parClasse.inconnue.length - 40} autres`);
}

process.exit(parClasse.interdite.length || parClasse.inconnue.length ? 1 : 0);
