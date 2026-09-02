#!/usr/bin/env node
/**
 * Applique le nom de marque aux manifestes des applications installables.
 *
 * POURQUOI CE SCRIPT EXISTE
 * Les six manifestes de `public/` sont des fichiers JSON servis tels quels : le
 * navigateur les lit au moment d'installer l'application sur l'appareil, avant
 * tout JavaScript. Ni l'assistant de premier lancement ni la configuration en
 * base ne peuvent les atteindre — l'icône installée sur le téléphone d'un
 * utilisateur porterait donc le nom de l'éditeur d'origine, définitivement.
 *
 * Le nom vient de `VITE_MARQUE_NOM_PRODUIT`, la même variable que celle
 * substituée dans `index.html`. Une seule valeur à renseigner pour les deux.
 *
 * Le script est idempotent et ne touche qu'aux champs de nom : il préserve les
 * icônes, les couleurs de thème et les raccourcis propres à chaque application.
 *
 * Usage : node scripts/appliquer-marque-manifestes.mjs [racine]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
const nom = (process.env.VITE_MARQUE_NOM_PRODUIT || '').trim();

if (!nom) {
  // Pas de valeur : on ne devine pas, et on ne casse pas la construction non
  // plus. Les manifestes gardent ce qu'ils contiennent déjà.
  console.log('VITE_MARQUE_NOM_PRODUIT non renseignée : manifestes inchangés.');
  process.exit(0);
}

/**
 * Chaque sous-application garde son propre suffixe : sur un écran d'accueil,
 * cinq icônes portant le même nom seraient indiscernables.
 */
const MANIFESTES = [
  { fichier: 'public/manifest.webmanifest', suffixe: null },
  { fichier: 'public/manifest-mail.json', suffixe: 'Courriel' },
  { fichier: 'public/manifest-calendar.json', suffixe: 'Agenda' },
  { fichier: 'public/manifest-pulse.json', suffixe: 'Discussion' },
  { fichier: 'public/manifest-todos.json', suffixe: 'Tâches' },
  { fichier: 'public/manifest-jarvis.json', suffixe: 'Assistant' },
];

let modifies = 0;
for (const { fichier, suffixe } of MANIFESTES) {
  const chemin = join(racine, fichier);
  if (!existsSync(chemin)) continue;

  let manifeste;
  try {
    manifeste = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (e) {
    console.error(`${fichier} illisible : ${e.message}`);
    process.exitCode = 1;
    continue;
  }

  const complet = suffixe ? `${nom} ${suffixe}` : nom;
  const court = suffixe ? suffixe : nom;

  const avant = JSON.stringify(manifeste);
  manifeste.name = complet;
  manifeste.short_name = court;
  const apres = JSON.stringify(manifeste);

  if (avant !== apres) {
    writeFileSync(chemin, `${JSON.stringify(manifeste, null, 2)}\n`, 'utf8');
    modifies += 1;
    console.log(`  ${fichier} → « ${complet} »`);
  }
}

console.log(`${modifies} manifeste(s) mis à jour pour « ${nom} »`);
