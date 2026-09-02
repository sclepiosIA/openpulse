#!/usr/bin/env node
/**
 * Vérifie qu'aucun job d'intégration continue ne dépend d'un exécuteur privé
 * sans le dire.
 *
 * POURQUOI CET OUTIL EXISTE
 * Douze des quatorze workflows hérités déclaraient `runs-on: [self-hosted, …]`,
 * et sept d'entre eux se déclenchaient sur `push` ou `pull_request`. Sur une
 * bifurcation, aucun exécuteur ne porte ce nom : les jobs n'échouent pas, ils
 * restent EN ATTENTE, indéfiniment et sans message. Un contributeur externe
 * voit une demande de fusion qui ne conclut jamais et n'a aucun moyen de
 * comprendre pourquoi — c'est pire qu'un échec franc.
 *
 * La convention retenue : tout job sur exécuteur privé porte
 * `if: vars.EXECUTEURS_PRIVES == 'oui'`. La variable n'existe que dans le dépôt
 * d'origine ; ailleurs, le job est sauté proprement, avec sa raison lisible.
 *
 * Usage : node verifier-ci-portable.mjs [racine]
 * Sortie : code 1 s'il reste un job privé sans garde.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
const GARDE = 'EXECUTEURS_PRIVES';

const repertoires = ['.github/workflows', '.gitea/workflows'].filter((d) => existsSync(join(racine, d)));
const constats = [];
let jobsPrives = 0;

for (const repertoire of repertoires) {
  for (const nom of readdirSync(join(racine, repertoire)).filter((f) => /\.ya?ml$/.test(f))) {
    const chemin = join(repertoire, nom);
    const texte = readFileSync(join(racine, chemin), 'utf8');
    const lignes = texte.split('\n');

    // Parcours volontairement textuel : les workflows portent des commentaires
    // et des ancres qu'un aller-retour YAML détruirait.
    let jobCourant = null, condition = null, prive = false;
    const cloturer = () => {
      if (jobCourant && prive) {
        jobsPrives += 1;
        if (!condition || !condition.includes(GARDE)) constats.push({ chemin, job: jobCourant });
      }
      jobCourant = null; condition = null; prive = false;
    };

    for (const ligne of lignes) {
      const debutJob = ligne.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
      if (debutJob) { cloturer(); jobCourant = debutJob[1]; continue; }
      if (!jobCourant) continue;
      if (/^ {4}runs-on:.*self-hosted/.test(ligne)) prive = true;
      const cond = ligne.match(/^ {4}if:\s*(.+)$/);
      if (cond) condition = cond[1];
    }
    cloturer();
  }
}

if (constats.length === 0) {
  console.log(`intégration continue : ${jobsPrives} job(s) sur exécuteur privé, tous conditionnés`);
  process.exit(0);
}

console.log(`JOBS PRIVÉS SANS GARDE : ${constats.length}\n`);
for (const c of constats) console.log(`  ${c.chemin} → ${c.job}`);
console.log(`\nAjoutez « if: vars.${GARDE} == 'oui' » à ces jobs, en combinant`);
console.log("avec la condition existante s'il y en a une.");
process.exit(1);
