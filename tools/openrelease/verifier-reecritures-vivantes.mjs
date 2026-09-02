#!/usr/bin/env node
/**
 * Quelles règles de réécriture ne font RIEN ?
 *
 * POURQUOI CET OUTIL EXISTE
 * Une règle dont l'ancre ne correspond pas ne fait rien, et l'extraction ne le
 * signale pas. Elle se termine sur un succès, l'arbre part avec ce que la règle
 * prétendait retirer, et personne ne l'apprend. Sur un lot de cinquante règles
 * écrites à la main, vingt-quatre étaient dans ce cas — toutes pour la même
 * raison : leur ancre avait été relevée sur l'amont BRUT, alors qu'une règle
 * antérieure avait déjà transformé ce texte.
 *
 * TROIS CAUSES, ET ELLES N'APPELLENT PAS LE MÊME GESTE
 *
 *   ancre-sans-correspondance — l'ancre ne se trouve pas dans le texte que la
 *     règle voit réellement, c'est-à-dire l'amont transformé par toutes celles
 *     qui la précèdent. C'est la cause la plus fréquente et la plus trompeuse :
 *     l'ancre est juste, mais elle décrit un état passé du fichier.
 *
 *   fichier-possede-par-aval — l'extraction ne produit pas ce fichier, elle
 *     laisse celui du dépôt. Aucune réécriture ne peut l'atteindre : il faut
 *     modifier le fichier directement.
 *
 *   fichier-exclu — le profil retire ce fichier de la distribution. La règle
 *     décrit un fichier qui ne sera pas livré.
 *
 * Une règle morte n'est pas seulement inutile : quand elle prétend retirer une
 * valeur sensible, elle la PUBLIE, puisque le manifeste est versionné.
 *
 * Usage : node verifier-reecritures-vivantes.mjs <racine> <snapshot-amont> [--profil P]
 * Sortie : code 1 s'il reste des règles mortes.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const racine = args.find((a) => !a.startsWith('--')) ?? '.';
const amont = args.filter((a) => !a.startsWith('--'))[1];
const iProfil = args.indexOf('--profil');
const profilDemande = iProfil >= 0 ? args[iProfil + 1] : null;

if (!amont || !existsSync(amont)) {
  console.error('usage : verifier-reecritures-vivantes.mjs <racine> <snapshot-amont> [--profil P]');
  console.error("le snapshot amont est indispensable : c'est le texte que les règles voient.");
  process.exit(2);
}

const manifeste = JSON.parse(readFileSync(join(racine, 'tools/openrelease/manifest.json'), 'utf8'));
const cheminPrive = join(racine, 'tools/openrelease/manifest-prive.json');
const prive = existsSync(cheminPrive) ? JSON.parse(readFileSync(cheminPrive, 'utf8')) : { reecritures: [] };
const parIdPrive = new Map((prive.reecritures ?? []).map((r) => [r.id, r]));

const profilNom = profilDemande ?? manifeste.profil_par_defaut;
const categoriesExclues = new Set(manifeste.profils?.[profilNom]?.exclut_categories ?? []);

function globVersRegExp(motif) {
  const esc = motif
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  return new RegExp('^' + esc + '$');
}

const proteges = [...(manifeste.possede_par_aval ?? []), ...(manifeste.substituts ?? [])].map(globVersRegExp);
const exclusions = (manifeste.exclusions ?? [])
  .filter((e) => categoriesExclues.has(e.categorie))
  .map((e) => globVersRegExp(e.pattern));

// L'ordre est celui de l'extraction : jalons résolus à leur place, puis les
// règles privées historiques. Une règle voit le texte que les précédentes ont
// produit — c'est toute la difficulté.
const posees = new Set();
const suite = [
  ...(manifeste.reecritures ?? []).map((r) => {
    if (!r.prive) return r;
    posees.add(r.id);
    return parIdPrive.get(r.id);
  }).filter(Boolean),
  ...(prive.reecritures ?? []).filter((r) => !posees.has(r.id)),
];

/** Fichiers de l'amont, une seule fois. */
const fichiersAmont = [];
(function parcourir(d) {
  for (const nom of readdirSync(d)) {
    const p = join(d, nom);
    if (statSync(p).isDirectory()) { if (nom !== '.git') parcourir(p); }
    else fichiersAmont.push(relative(amont, p).split(sep).join('/'));
  }
})(amont);

const textes = new Map();
const lire = (rel) => {
  if (!textes.has(rel)) {
    try { textes.set(rel, readFileSync(join(amont, rel), 'utf8')); } catch { textes.set(rel, null); }
  }
  return textes.get(rel);
};

const morts = [];
let vivantes = 0;

/**
 * UN SEUL PARCOURS PAR FICHIER.
 *
 * La première version rejouait, pour chaque règle, toutes celles qui la
 * précédaient : autant de fois qu'il y a de règles, sur autant de fichiers.
 * Elle ne terminait pas. Ici le texte avance UNE fois, et chaque règle est
 * évaluée juste avant d'être appliquée — c'est exactement ce qu'elle voit à
 * l'extraction.
 */
const compilees = suite.map((r) => ({
  id: r.id,
  cibles: (r.cibles ?? ['**/*']).map(globVersRegExp),
  regles: (r.regles ?? []).map((g) => {
    try { return { re: new RegExp(g.chercher, g.drapeaux ?? 'g'), remplacer: g.remplacer }; }
    catch (e) { return { invalide: e.message }; }
  }),
}));

// { "id::i" -> { touche, protege, exclu } }
const bilan = new Map();
const cle = (id, i) => `${id}::${i}`;
for (const r of compilees) {
  for (const [i, g] of r.regles.entries()) {
    if (g.invalide) { morts.push({ id: r.id, i, cause: 'motif-invalide', detail: g.invalide }); continue; }
    bilan.set(cle(r.id, i), { touche: 0, protege: 0, exclu: 0 });
  }
}

for (const f of fichiersAmont) {
  const applicables = compilees.filter((r) => r.cibles.some((re) => re.test(f)));
  if (!applicables.length) continue;

  let texte = lire(f);
  if (texte === null) continue;

  const estProtege = proteges.some((rx) => rx.test(f));
  const estExclu = !estProtege && exclusions.some((rx) => rx.test(f));

  for (const r of applicables) {
    for (const [i, g] of r.regles.entries()) {
      if (g.invalide) continue;
      g.re.lastIndex = 0;
      if (!g.re.test(texte)) { g.re.lastIndex = 0; continue; }
      g.re.lastIndex = 0;
      const b = bilan.get(cle(r.id, i));
      if (estProtege) b.protege++;
      else if (estExclu) b.exclu++;
      else b.touche++;
      texte = texte.replace(g.re, g.remplacer);
    }
  }
}

for (const [k, b] of bilan) {
  const [id, i] = k.split('::');
  if (b.touche > 0) { vivantes++; continue; }
  morts.push({
    id, i: Number(i),
    cause: b.protege > 0 ? 'fichier-possede-par-aval'
         : b.exclu > 0 ? 'fichier-exclu'
         : 'ancre-sans-correspondance',
  });
}

const parCause = morts.reduce((acc, m) => { acc[m.cause] = (acc[m.cause] ?? 0) + 1; return acc; }, {});

console.log(`réécritures vivantes : ${vivantes} | mortes : ${morts.length}  (profil ${profilNom})`);

if (morts.length) {
  console.error('\nRÈGLES QUI NE FONT RIEN :');
  for (const [cause, n] of Object.entries(parCause).sort((a, b) => b[1] - a[1])) {
    console.error(`\n  ${cause} — ${n}`);
    for (const m of morts.filter((x) => x.cause === cause).slice(0, 12)) {
      console.error(`    ${m.id}${(suite.find((r) => r.id === m.id)?.regles?.length ?? 1) > 1 ? ` [sous-motif ${m.i}]` : ''}${m.detail ? ` : ${m.detail}` : ''}`);
    }
    const reste = morts.filter((x) => x.cause === cause).length - 12;
    if (reste > 0) console.error(`    … et ${reste} autre(s)`);
  }
  console.error(
    "\nUne règle morte n'est pas seulement inutile : quand elle prétend retirer\n" +
    'une valeur sensible, elle la PUBLIE — le manifeste est versionné.',
  );
  process.exit(1);
}

console.log('toutes les règles trouvent leur cible');
