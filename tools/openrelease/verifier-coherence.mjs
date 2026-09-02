#!/usr/bin/env node
/**
 * Détecte les réécritures partielles.
 *
 * POURQUOI CET OUTIL EXISTE
 * La barrière de publication vérifie qu'aucune trace de l'éditeur ne subsiste.
 * Elle ne dit rien d'un défaut plus discret : une règle de réécriture dont
 * l'ancre est trop étroite transforme une partie des occurrences et laisse
 * l'autre en place. Le fichier devient incohérent avec lui-même — une fixture
 * écrite `jean@clinique.example.org` et l'assertion correspondante restée
 * `clinique.fr`. Rien n'est divulgué, la barrière reste verte, et le test
 * échoue pour une raison qui n'a aucun rapport apparent avec la publication.
 *
 * Le contrôle est intra-fichier : un même libellé de domaine ne doit pas
 * apparaître à la fois sous un TLD de gabarit (réservé par la RFC 2606/6761)
 * et sous un TLD réel. Ce voisinage signe une transformation incomplète.
 *
 * Usage : node verifier-coherence.mjs [racine]
 * Sortie : code 1 s'il reste une incohérence.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const racine = process.argv[2] || '.';

const TLD_GABARIT = new Set(['example.org', 'example.com', 'example.net', 'test', 'invalid', 'localhost']);
const TLD_REEL = ['fr', 'com', 'org', 'net', 'io', 'ai', 'eu', 'be', 'ch', 'ca'];

/**
 * Domaines réels dont la mention est volontaire : ce sont des services tiers
 * que l'application désigne nommément (un lien, un espace réservé de
 * formulaire), pas des traces de l'éditeur.
 */
const LIBELLES_ATTENDUS = new Set([
  'linkedin', 'github', 'gitlab', 'google', 'microsoft', 'apple', 'gmail',
  'outlook', 'example', 'localhost', 'supabase', 'jitsi', 'nextcloud',
]);

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.sql', '.md', '.json', '.yml', '.yaml'];

/**
 * L'outillage de publication porte par construction la forme d'origine et la
 * forme réécrite côte à côte — le manifeste parce que c'est sa raison d'être,
 * les vérificateurs parce qu'ils documentent le motif qu'ils traquent. Ce
 * répertoire ne part pas dans le produit livré : l'exclure ne relâche rien.
 */
const PREFIXE_HORS_CHAMP = 'tools/openrelease/';

const motifDomaine = new RegExp(
  String.raw`\b([a-z0-9][a-z0-9-]{2,})\.(` +
    [...TLD_GABARIT, ...TLD_REEL].map((t) => t.replace('.', '\\.')).join('|') +
  String.raw`)\b`,
  'gi',
);

function fichiersSuivis() {
  return execFileSync('git', ['ls-files'], { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .filter((f) => f && EXTENSIONS.some((e) => f.endsWith(e)));
}

const constats = [];

for (const relatif of fichiersSuivis()) {
  if (relatif.startsWith(PREFIXE_HORS_CHAMP)) continue;
  let texte;
  try {
    texte = readFileSync(join(racine, relatif), 'utf8');
  } catch {
    continue; // fichier illisible ou binaire : hors du champ de ce contrôle
  }

  const parLibelle = new Map();
  for (const m of texte.matchAll(motifDomaine)) {
    const libelle = m[1].toLowerCase();
    if (LIBELLES_ATTENDUS.has(libelle)) continue;
    // Précédé d'un point, le libellé est un sous-domaine d'un nom plus long :
    // « sante » dans chu-centre.sante.example.org n'est pas le même objet que
    // le domaine « sante.fr ». Les confondre produit un faux constat.
    if (m.index > 0 && texte[m.index - 1] === '.') continue;
    if (!parLibelle.has(libelle)) parLibelle.set(libelle, new Set());
    parLibelle.get(libelle).add(m[2].toLowerCase());
  }

  for (const [libelle, tlds] of parLibelle) {
    const gabarit = [...tlds].filter((t) => TLD_GABARIT.has(t));
    const reel = [...tlds].filter((t) => !TLD_GABARIT.has(t));
    if (gabarit.length && reel.length) {
      constats.push({ fichier: relatif, libelle, gabarit, reel });
    }
  }
}

if (constats.length === 0) {
  console.log('cohérence des réécritures : aucune transformation partielle détectée');
  process.exit(0);
}

console.log(`RÉÉCRITURES PARTIELLES : ${constats.length} constat(s)\n`);
for (const c of constats) {
  console.log(`  ${c.fichier}`);
  console.log(`    « ${c.libelle} » apparaît en ${c.gabarit.join(', ')} ET en ${c.reel.join(', ')}`);
  console.log(`    → une règle a transformé une partie des occurrences seulement.\n`);
}
process.exit(1);
