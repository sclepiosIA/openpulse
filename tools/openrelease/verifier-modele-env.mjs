#!/usr/bin/env node
/**
 * Vérifie que le modèle de configuration et le registre décrivent la même
 * instance.
 *
 * POURQUOI CET OUTIL EXISTE
 * `.env.example` est ce qu'un adoptant copie ; `docs/CONFIGURATION.md` est
 * engendré depuis `scripts/env-registry.mjs`. Rien ne reliait les deux. Ils ont
 * divergé de dix variables sans que personne s'en aperçoive : six mots de passe
 * de rôles de service que la composition exige mais que la référence de
 * configuration ne mentionnait nulle part, une variable de plateforme déclarée
 * en double sous deux noms, et la variable qui ferme les fonctions de bord —
 * absente du modèle alors qu'elle est celle qu'il faut renseigner en premier.
 *
 * L'écart est silencieux des deux côtés : une variable absente du modèle ne se
 * renseigne pas, une variable absente du registre ne se documente pas.
 *
 * Usage : node verifier-modele-env.mjs [racine]
 * Sortie : code 1 dès qu'une variable manque d'un côté.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
const MODELE = '.env.example';

const { REGISTRE, CI_ET_TESTS } = await import(
  new URL(`file://${join(process.cwd(), racine, 'scripts/env-registry.mjs')}`).href
);

const modele = readFileSync(join(racine, MODELE), 'utf8');
const dansModele = new Set([...modele.matchAll(/^([A-Z][A-Z0-9_]{2,})=/gm)].map((m) => m[1]));
const dansRegistre = new Set(REGISTRE.map((e) => e.nom));

// Les variables d'intégration continue et de test ne servent jamais à une
// instance : le modèle les cite en commentaire, sans ligne assignable.
const horsInstance = new Set((CI_ET_TESTS || []).map((e) => (typeof e === 'string' ? e : e.nom)));

const absentesDuModele = [...dansRegistre].filter((n) => !dansModele.has(n)).sort();
const absentesDuRegistre = [...dansModele].filter((n) => !dansRegistre.has(n) && !horsInstance.has(n)).sort();

console.log(`registre : ${dansRegistre.size} variables | ${MODELE} : ${dansModele.size} lignes`);

if (!absentesDuModele.length && !absentesDuRegistre.length) {
  console.log('modèle et registre décrivent la même instance');
  process.exit(0);
}

if (absentesDuModele.length) {
  console.log(`\nDéclarées au registre, absentes de ${MODELE} (${absentesDuModele.length}) :`);
  for (const n of absentesDuModele) console.log(`  ${n}`);
  console.log("  → un adoptant qui copie le modèle ne les renseignera jamais.");
}
if (absentesDuRegistre.length) {
  console.log(`\nPrésentes dans ${MODELE}, absentes du registre (${absentesDuRegistre.length}) :`);
  for (const n of absentesDuRegistre) console.log(`  ${n}`);
  console.log('  → elles ne figurent pas dans docs/CONFIGURATION.md, qui en est engendré.');
}
process.exit(1);
