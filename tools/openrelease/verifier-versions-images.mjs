#!/usr/bin/env node
/**
 * Compare les versions d'images citées dans la documentation à celles que la
 * composition déclare réellement.
 *
 * POURQUOI CET OUTIL EXISTE
 * La documentation annonçait six versions d'images, toutes différentes de
 * celles du fichier de composition — et l'une d'elles désignait un service que
 * la composition ne monte pas du tout. Un tiers qui installe suit la
 * documentation : il diagnostique alors des écarts de comportement contre une
 * version qu'il ne fait pas tourner. C'est le genre d'erreur qu'on ne voit
 * jamais en relisant, parce que les deux fichiers sont justes séparément.
 *
 * Usage : node verifier-versions-images.mjs [racine]
 * Sortie : code 1 s'il reste un écart.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
const COMPOSE = 'docker/docker-compose.openpulse.yml';

/**
 * Images qu'un document peut nommer sans que la composition les monte : elles
 * illustrent un choix d'hébergement laissé à l'exploitant.
 */
const CITATIONS_HORS_COMPOSITION = new Set([
  'caddy',   // terminaison TLS : à la charge de l'exploitant
  'nginx',   // idem
  'traefik', // idem
]);

const compose = readFileSync(join(racine, COMPOSE), 'utf8');

/** dépôt -> étiquette réellement déclarée */
const declarees = new Map();
for (const m of compose.matchAll(/^\s+image:\s*([^\s:]+):(\S+)\s*$/gm)) {
  declarees.set(m[1], m[2]);
}

// Les images CONSTRUITES par la distribution déclarent leur base dans un
// Dockerfile, pas dans la composition. Sans cette lecture, déplacer un service
// de `image:` vers `build:` le faisait sortir du contrôle sans que rien ne le
// signale : c'est exactement ce qui est arrivé à la base de données le jour où
// elle a eu besoin d'un greffon supplémentaire. Le compte d'images surveillées
// est passé de sept à six, et `FROM postgres:latest` restait vert.
for (const fichier of readdirSync(join(racine, 'docker')).filter((f) => f.startsWith('Dockerfile'))) {
  const contenu = readFileSync(join(racine, 'docker', fichier), 'utf8');
  for (const m of contenu.matchAll(/^FROM\s+([^\s:]+):(\S+)/gm)) {
    declarees.set(m[1], m[2]);
  }
}

// Une base non épinglée rend la construction irreproductible : deux
// installations faites à un mois d'écart n'ont pas le même serveur.
const NON_EPINGLEES = ['latest', 'stable', 'edge', 'main', 'master'];
const flottantes = [...declarees].filter(([, tag]) => NON_EPINGLEES.includes(tag));
if (flottantes.length > 0) {
  for (const [depot, tag] of flottantes) {
    console.error(`  version flottante : ${depot}:${tag} — épingler une version précise`);
  }
  process.exit(1);
}

const docs = [
  'README.md',
  ...readdirSync(join(racine, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`),
];

// Un dépôt d'image tel qu'il apparaît dans une phrase : `kong:3.9.1`,
// `supabase/gotrue:v2.170.0`, `postgrest/postgrest:v12.2.3`.
const motif = /`((?:[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*):([a-zA-Z0-9][a-zA-Z0-9._-]*)`/g;

const ecarts = [];
for (const relatif of docs) {
  let texte;
  try {
    texte = readFileSync(join(racine, relatif), 'utf8');
  } catch {
    continue;
  }
  const lignes = texte.split('\n');
  lignes.forEach((ligne, i) => {
    for (const m of ligne.matchAll(motif)) {
      const [, depot, etiquette] = m;
      // Toute image citée doit se retrouver dans la composition. Un tableau
      // décrivait ainsi une pile héritée — caddy, imgproxy, un pont S3 — sous
      // un titre qui nommait la composition OpenPulse : chaque ligne était
      // juste isolément, et l'ensemble décrivait un déploiement inexistant.
      // Les exceptions se déclarent ici, avec leur raison.
      if (CITATIONS_HORS_COMPOSITION.has(depot)) continue;
      // Une citation qui correspond exactement à la composition est juste :
      // rien à dire, y compris pour une étiquette aussi courte que `15`.
      if (declarees.get(depot) === etiquette) continue;
      // Sinon, on n'accuse que ce qui a la forme d'une version d'image. Sans
      // ce filtre, `dark:text-blue-400`, `has:file` ou `kong:8000` sont lus
      // comme des images — l'outil crie alors sur du texte ordinaire, et on
      // finit par ne plus le lire.
      const formeVersion = /^v?\d+(?:\.\d+)+[\w.-]*$/.test(etiquette)
        || ['latest', 'alpine', 'stable', 'edge'].includes(etiquette);
      if (!formeVersion) continue;
      // Un dernier segment porteur d'une extension est un chemin de fichier,
      // pas un dépôt d'image : `supabase/config.toml`, `docker/kong.yml`.
      if (/\.[a-z]{2,5}$/.test(depot.split('/').pop())) continue;

      if (!declarees.has(depot)) {
        ecarts.push({ relatif, ligne: i + 1, depot, cite: etiquette, reel: null });
      } else if (declarees.get(depot) !== etiquette) {
        ecarts.push({ relatif, ligne: i + 1, depot, cite: etiquette, reel: declarees.get(depot) });
      }
    }
  });
}

if (ecarts.length === 0) {
  console.log(`versions d'images : documentation alignée sur ${COMPOSE} (${declarees.size} image(s))`);
  process.exit(0);
}

console.log(`ÉCARTS DE VERSION : ${ecarts.length}\n`);
for (const e of ecarts) {
  const attendu = e.reel ? `la composition déclare ${e.depot}:${e.reel}` : `la composition ne monte pas ${e.depot}`;
  console.log(`  ${e.relatif}:${e.ligne}`);
  console.log(`    cité « ${e.depot}:${e.cite} » — ${attendu}\n`);
}
process.exit(1);
