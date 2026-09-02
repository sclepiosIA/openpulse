#!/usr/bin/env node
/**
 * Quels fichiers de `src/` la distribution livre-t-elle sans que rien ne les
 * atteigne ?
 *
 * POURQUOI CET OUTIL EXISTE
 * Retirer un module retire ses pages et ses composants propres, mais laisse
 * derrière lui tout ce qui n'était importé QUE par eux. Le compilateur ne dit
 * rien : un fichier sans importeur compile parfaitement. Les tests non plus,
 * puisqu'ils l'importent, eux — et un fichier mort accompagné de ses épreuves
 * se lit comme du code vivant et couvert.
 *
 * Le forum en est l'exemple : vingt-deux composants livrés, aucune route
 * `/forum`, aucune entrée de menu, et le composant qui affiche la liste des
 * sujets monté nulle part depuis le retrait des espaces de formation.
 *
 * CE QUE « ATTEIGNABLE » VEUT DIRE ICI
 * On part de `src/main.tsx` et on suit les imports statiques et dynamiques.
 * Les fichiers de test ne comptent pas comme des importeurs : un fichier que
 * seul son test importe est mort, et son test avec lui.
 *
 * Ce n'est pas une preuve d'inutilité : une page atteinte seulement par une
 * URL directe est légitime. L'outil dit ce qu'il mesure, et distingue les
 * trois cas plutôt que de prononcer une sentence.
 *
 * CE QUE LE RELEVÉ NE DIT PAS, ET QU'IL FAUT SAVOIR
 * Un fichier sans chemin d'accès n'est pas pour autant retirable. Mesuré sur
 * l'îlot le plus gros — 108 fichiers de l'assistant, qu'aucun montage
 * n'atteint : vingt-cinq épreuves touchent À LA FOIS ce code mort et du code
 * vivant, et par leurs imports elles retiennent l'îlot entier. Retirer le mort
 * suppose donc de trancher ces vingt-cinq épreuves, une par une. Le calcul du
 * retirable, avec fermeture transitive des protections, rend zéro.
 *
 * Le relevé sert à voir, pas à décider seul.
 *
 * Usage : node verifier-code-atteignable.mjs [racine]
 * Sortie : toujours 0 — c'est un relevé, pas une barrière.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';

// Tout est normalise en ABSOLU : `resolve()` rend un chemin absolu la ou
// `join('./src', …)` en rend un relatif, et les deux ne se rejoignaient jamais
// dans la table des liens — le parcours s'arretait alors au premier import
// par alias, en annoncant 158 fichiers atteints sur 2299.
const racine = resolve(process.argv[2] || '.');
const src = join(racine, 'src');
if (!existsSync(src)) { console.log('src/ est absent'); process.exit(0); }

const EXT = ['.ts', '.tsx', '.js', '.jsx'];
const estTest = (f) => /\.test\.|\.spec\.|__tests__|__mocks__|test-utils|setupTests/.test(f);

const tous = [];
(function parcourir(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) parcourir(p);
    else if (EXT.some((e) => n.endsWith(e))) tous.push(p);
  }
})(src);

const rel = (p) => relative(racine, p).split(sep).join('/');
const production = tous.filter((f) => !estTest(rel(f)));

/** Résout un spécificateur d'import vers un fichier du dépôt, ou null. */
function resoudre(depuis, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(src, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(depuis), spec);
  else return null; // dépendance externe

  const candidats = [
    base,
    ...EXT.map((e) => base + e),
    ...EXT.map((e) => join(base, 'index' + e)),
  ];
  for (const c of candidats) {
    try { if (statSync(c).isFile()) return c; } catch { /* suivant */ }
  }
  return null;
}

// La clause d'import PEUT s'etendre sur plusieurs lignes -- c'est meme la
// forme courante des a partir de trois symboles. Interdire le saut de ligne
// faisait manquer ces imports-la : le parcours annoncait alors les composants
// de la page de confidentialite comme inatteignables, alors que la page les
// importe en bloc. La borne evite qu'une clause non fermee avale le fichier.
const MOTIF_IMPORT = /(?:^|\n)\s*(?:import|export)[^'"]{0,600}?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

const liens = new Map();
for (const f of tous) {
  let texte;
  try { texte = readFileSync(f, 'utf8'); } catch { continue; }
  const cibles = new Set();
  for (const m of texte.matchAll(MOTIF_IMPORT)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    const r = resoudre(f, spec);
    if (r) cibles.add(r);
  }
  liens.set(f, cibles);
}

// Parcours depuis les points d'entrée réels.
const ENTREES = ['src/main.tsx', 'src/App.tsx', 'src/index.css'].map((p) => join(racine, p)).filter((p) => existsSync(p));
const atteints = new Set();
const pile = [...ENTREES];
while (pile.length) {
  const f = pile.pop();
  if (atteints.has(f)) continue;
  atteints.add(f);
  for (const c of liens.get(f) ?? []) pile.push(c);
}

const morts = production.filter((f) => !atteints.has(f));

/** Un fichier mort dont un TEST dépend traîne son test avec lui. */
const testsOrphelins = tous.filter((f) => estTest(rel(f)) && [...(liens.get(f) ?? [])].some((c) => morts.includes(c)));

const parRepertoire = morts.reduce((acc, f) => {
  const d = rel(f).split('/').slice(0, 3).join('/');
  acc[d] = (acc[d] ?? 0) + 1;
  return acc;
}, {});

const lignes = (f) => { try { return readFileSync(f, 'utf8').split('\n').length; } catch { return 0; } };
const totalLignes = morts.reduce((s, f) => s + lignes(f), 0);

console.log(`fichiers de production : ${production.length} | atteints depuis les points d'entrée : ${production.filter((f) => atteints.has(f)).length}`);
console.log(`SANS AUCUN CHEMIN D'ACCÈS : ${morts.length} fichier(s), ${totalLignes} lignes`);
console.log(`épreuves qui n'existent que pour eux : ${testsOrphelins.length}`);

if (morts.length) {
  console.log('\nPar répertoire :');
  for (const [d, n] of Object.entries(parRepertoire).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(4)}  ${d}`);
  }
  console.log(
    "\nUn fichier sans chemin d'accès n'est pas forcément inutile : une page\n" +
    "atteinte par URL directe est légitime. Mais il est livré, lu, et ses\n" +
    'épreuves le font passer pour vivant.',
  );
}
