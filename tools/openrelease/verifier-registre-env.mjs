#!/usr/bin/env node
/**
 * Vérifie que chaque variable du registre d'environnement est réellement lue
 * là où le registre le prétend.
 *
 * POURQUOI CET OUTIL EXISTE
 * `docs/CONFIGURATION.md` est engendré depuis `scripts/env-registry.mjs`. Le
 * registre portait douze variables déclarées « requises » que plus aucun
 * fichier ne lisait : héritées d'une composition abandonnée, elles survivaient
 * parce que rien ne reliait la déclaration au code. La documentation
 * d'adoption demandait donc de renseigner — secrets compris — des valeurs sans
 * effet, et l'exploitant qui ne voyait rien fonctionner cherchait au mauvais
 * endroit.
 *
 * La comparaison est insensible à la casse : les services Python lisent leurs
 * variables en minuscules via pydantic, `DRIVE_ENV` s'y écrit `drive_env`.
 *
 * Usage : node verifier-registre-env.mjs [racine]
 * Sortie : code 1 s'il reste une déclaration sans lecteur.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
const { REGISTRE } = await import(new URL(`file://${join(process.cwd(), racine, 'scripts/env-registry.mjs')}`).href);

const constats = [];
const cache = new Map();

for (const entree of REGISTRE) {
  for (const source of entree.lu || []) {
    const fichier = String(source).split(':')[0];
    const chemin = join(racine, fichier);

    if (!existsSync(chemin)) {
      constats.push({ nom: entree.nom, fichier, raison: 'fichier inexistant' });
      continue;
    }
    if (!cache.has(chemin)) cache.set(chemin, readFileSync(chemin, 'utf8').toLowerCase());
    if (!cache.get(chemin).includes(entree.nom.toLowerCase())) {
      constats.push({ nom: entree.nom, fichier, raison: 'variable absente du fichier' });
    }
  }
}

if (constats.length === 0) {
  console.log(`registre d'environnement : ${REGISTRE.length} variables, toutes lues là où elles le déclarent`);
  process.exit(0);
}

console.log(`DÉCLARATIONS SANS LECTEUR : ${constats.length}\n`);
for (const c of constats) console.log(`  ${c.nom} → ${c.fichier} (${c.raison})`);
console.log('\nUne variable que rien ne lit ne doit pas figurer dans la documentation');
console.log("d'adoption : corrigez la source citée, ou retirez la déclaration.");
process.exit(1);
