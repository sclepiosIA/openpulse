#!/usr/bin/env node
/**
 * Vérifie que tout espace de stockage utilisé par le code est bien créé par le
 * schéma, et inversement.
 *
 * POURQUOI CET OUTIL EXISTE
 * Douze espaces manquaient au schéma : le premier envoi de fichier d'une
 * instance fraîche échouait sur « Bucket not found ». Une fois les douze
 * ajoutés, deux autres manquaient encore — `entity-logos` et `user-avatars`,
 * pourtant utilisés en production. Le relevé manuel ne les avait pas vus parce
 * qu'il ne cherchait que `from('…')` en apostrophes simples, quand ces deux
 * fichiers écrivent `from("…")`. Un relevé fait à la main rate ce genre de
 * chose, et le rate en silence : rien ne casse avant le premier envoi.
 *
 * Le contrôle vaut dans les deux sens. Un espace créé que personne n'utilise
 * n'est pas anodin non plus : c'est une surface ouverte sans usage.
 *
 * Usage : node verifier-espaces-stockage.mjs [racine]
 * Sortie : code 1 s'il manque un espace au schéma.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
const SCHEMA = 'supabase/schema-05-stockage.sql';

/** Espaces qui n'apparaissent que dans des doublures de test. */
const HORS_PRODUCTION = new Set(['my-bucket', 'test-bucket', 'bucket-test']);

function fichiersSources() {
  return execFileSync('git', ['ls-files', 'src', 'supabase/functions', 'services'], {
    cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f) && !/\.test\.|__tests__|test-utils/.test(f));
}

// Les deux formes de guillemets, et la coupure de ligne entre `.storage` et
// `.from(` que le formateur introduit dès que la chaîne est longue.
const MOTIF = /\.storage\s*(?:\r?\n\s*)?\.from\(\s*['"]([a-z0-9_-]+)['"]\s*\)/g;

/**
 * Le nom de l'espace n'est pas toujours écrit au point d'appel.
 *
 * Ce contrôle a rendu VERT trois fois de suite un dépôt auquel il manquait des
 * espaces, parce qu'il ne voyait qu'un littéral collé à `.storage.from(`.
 * Lui échappaient :
 *   - `storage.from(PULSE_MEDIA_BUCKET)`, où le nom est dans une constante ;
 *   - `uploadPublicFile('feedback-screenshots', …)`, où l'appel au stockage est
 *     dans une fonction d'aide et le nom reste au point d'appel.
 *
 * Un contrôle qui ne peut pas échouer coûte plus cher que pas de contrôle : il
 * fait croire que la question a été posée.
 */

/** `storage.from(CONSTANTE)` puis `const CONSTANTE = 'nom'`, dans tout le dépôt. */
const MOTIF_CONSTANTE = /\.storage\s*(?:\r?\n\s*)?\.from\(\s*([A-Z][A-Z0-9_]*)\s*\)/g;

/** Fonctions d'aide qui prennent le nom de l'espace en premier argument. */
const AIDES = ['uploadPublicFile', 'uploadPrivateFile', 'televerserFichierPublic'];
const MOTIF_AIDE = new RegExp(
  `(?:${AIDES.join('|')})\\(\\s*['"]([a-z0-9_-]+)['"]`, 'g',
);

const sources = fichiersSources();
const textes = new Map();
for (const relatif of sources) {
  try { textes.set(relatif, readFileSync(join(racine, relatif), 'utf8')); } catch { /* illisible */ }
}

/** Valeur d'une constante, cherchée dans TOUS les fichiers : elle est souvent exportée. */
function valeurConstante(nom) {
  const re = new RegExp(`\\b${nom}\\s*(?::[^=]+)?=\\s*['"]([a-z0-9_-]+)['"]`);
  for (const texte of textes.values()) {
    const m = texte.match(re);
    if (m) return m[1];
  }
  return null;
}

const utilises = new Map();
const nonResolues = new Map();
const noter = (nom, relatif) => {
  if (!nom || HORS_PRODUCTION.has(nom)) return;
  if (!utilises.has(nom)) utilises.set(nom, relatif);
};

for (const [relatif, texte] of textes) {
  for (const m of texte.matchAll(MOTIF)) noter(m[1], relatif);
  for (const m of texte.matchAll(MOTIF_AIDE)) noter(m[1], relatif);
  for (const m of texte.matchAll(MOTIF_CONSTANTE)) {
    const valeur = valeurConstante(m[1]);
    if (valeur) noter(valeur, relatif);
    else if (!nonResolues.has(m[1])) nonResolues.set(m[1], relatif);
  }
}

const cheminSchema = join(racine, SCHEMA);
if (!existsSync(cheminSchema)) {
  console.error(`${SCHEMA} est absent.`);
  process.exit(2);
}
const schema = readFileSync(cheminSchema, 'utf8');
const crees = new Set([...schema.matchAll(/^\s*\('([a-z0-9_-]+)',/gm)].map((m) => m[1]));

const manquants = [...utilises.keys()].filter((b) => !crees.has(b)).sort();
const inutilises = [...crees].filter((b) => !utilises.has(b)).sort();

console.log(`espaces utilisés par le code : ${utilises.size} | créés par le schéma : ${crees.size}`);

// Une constante dont la valeur n'a pas été retrouvée est un espace qu'on ne
// sait pas nommer : le taire ramènerait l'angle mort que ce contrôle vient de
// perdre. On le dit sans bloquer, faute de savoir quoi vérifier.
if (nonResolues.size) {
  console.log(`\nConstantes d'espace non résolues (${nonResolues.size}) — à vérifier à la main :`);
  for (const [nom, ou] of nonResolues) console.log(`  ${nom}  (${ou})`);
}

if (inutilises.length) {
  console.log(`\nCréés sans usage repéré (${inutilises.length}) — à confirmer, pas bloquant :`);
  for (const b of inutilises) console.log(`  ${b}`);
}

if (!manquants.length) {
  console.log('\nTout espace utilisé est créé.');
  process.exit(0);
}

console.log(`\nESPACES UTILISÉS MAIS JAMAIS CRÉÉS : ${manquants.length}\n`);
for (const b of manquants) console.log(`  ${b}  (${utilises.get(b)})`);
console.log(`\nAjoutez-les à ${SCHEMA}. Sans eux, le premier envoi de fichier`);
console.log('échoue sur « Bucket not found », et rien ne le laisse prévoir.');
process.exit(1);
