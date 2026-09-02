#!/usr/bin/env node
/**
 * Les fonctions de bord livrées s'analysent-elles ?
 *
 * POURQUOI CE CONTRÔLE EXISTE
 * Cinq fonctions de bord ont été livrées pendant des mois sans jamais pouvoir
 * démarrer : leur fichier est tronqué au milieu d'un bloc, et Deno refuse de
 * l'analyser. Le défaut vient de l'amont, la distribution le portait
 * fidèlement — et rien ne le disait, parce qu'AUCUN contrôle ne compilait ces
 * fichiers. `deno test` lui-même s'arrêtait au premier fichier illisible, ce
 * qui rendait la suite muette au lieu de bruyante.
 *
 * Une réécriture peut aussi casser un fichier : une ancre qui avale une
 * accolade de trop suffit. C'est arrivé une fois, et le seul indice était un
 * test qui refusait de charger le module.
 *
 * Ce contrôle demande à Deno d'analyser chaque fichier. Il ne juge ni le type
 * ni le style : seulement que le fichier est du code.
 *
 * IL N'EST PAS DANS `gate.sh`, ET C'EST DELIBERE
 * Cinq fichiers sont cassés EN AMONT : ce contrôle est donc rouge aujourd'hui,
 * et le restera tant que la décision n'aura pas été prise — réparer les cinq
 * corps manquants, ou retirer ces fonctions de la distribution. Or un contrôle
 * rouge en permanence finit par n'être plus lu, et entraîne les autres dans
 * son discrédit ; c'est la raison pour laquelle `verifier-pret-a-publier.mjs`
 * vit lui aussi hors de la barrière. Il y entrera le jour où il pourra être
 * vert.
 *
 * Usage : node verifier-fonctions-de-bord.mjs [racine]
 * Sortie : code 1 si un fichier ne s'analyse pas.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.argv[2] || '.';
const dossier = join(racine, 'supabase/functions');

if (!existsSync(dossier)) {
  console.log('supabase/functions est absent : rien à analyser');
  process.exit(0);
}

let deno;
try {
  deno = execFileSync('deno', ['--version'], { encoding: 'utf8' }).split('\n')[0];
} catch {
  // Un contrôle qu'on ne peut pas exécuter ne doit pas se taire : il doit dire
  // qu'il n'a rien vérifié, faute de quoi son silence passerait pour un vert.
  console.log('deno est absent : les fonctions de bord N\'ONT PAS été analysées');
  process.exit(0);
}

let sortie = '';
try {
  // La sortie compte AUSSI quand la commande réussit : `deno lint` rend 0
  // lorsqu'il n'a que des avertissements — et une erreur de syntaxe peut n'être
  // qu'un avertissement (voir plus bas). La jeter dans ce cas rendait le
  // contrôle vert sur des fichiers qui ne s'analysent pas.
  // ON GARDE LA CONFIGURATION DU PROJET, ET C'EST ESSENTIEL.
  // Avec `--no-config`, `deno lint` ne signale RIEN sur trois des six fichiers
  // dont le moteur de bord refuse pourtant le démarrage. Lancé depuis
  // `supabase/functions`, il trouve le `deno.json` du projet et les voit tous
  // les six. Le contrôle doit voir ce que voit le moteur, pas moins.
  sortie = execFileSync('deno', ['lint', '.'], {
    cwd: join(racine, 'supabase/functions'),
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  sortie = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}

// `deno lint` signale aussi des règles de style, qui ne nous regardent pas.
// Seule l'incapacité à ANALYSER le fichier compte.
//
// DEUX FORMES, ET LA SECONDE EST PIÉGEUSE
// Quand `deno lint` échoue sur un répertoire, il annonce « Error linting: <chemin> ».
// Mais quand il analyse un fichier dont la syntaxe est invalide APRÈS en avoir lu
// une partie, il rend « warn: SyntaxError: ... » suivi d'une ligne « at file://… ».
// Un avertissement, donc — et le contrôle, qui ne cherchait que la première forme,
// déclarait sains six fichiers que le moteur de bord refusait de démarrer.
const normaliser = (chemin) =>
  decodeURIComponent(chemin)
    .replace(/^file:\/\//, '')
    .replace(new RegExp(`^.*${'supabase/functions'}/`), 'supabase/functions/');

const illisibles = [
  ...new Set([
    ...[...sortie.matchAll(/Error linting:\s*(\S+)/g)].map((m) => normaliser(m[1])),
    ...[...sortie.matchAll(/SyntaxError:[\s\S]{0,400}?at (file:\/\/\/\S+?):\d+:\d+/g)]
      .map((m) => normaliser(m[1])),
  ]),
].sort();

console.log(`fonctions de bord : analysées avec ${deno}`);

if (illisibles.length) {
  console.error(`\nFICHIERS QUI NE S'ANALYSENT PAS (${illisibles.length}) :`);
  for (const f of illisibles) console.error(`  ${f}`);
  console.error(
    '\nUne fonction dont le fichier ne s\'analyse pas ne démarre jamais : la\n' +
    'plateforme refuse de la servir. Réparez le fichier, ou retirez la fonction\n' +
    'de la distribution — la livrer inerte laisse croire qu\'elle existe.',
  );
  process.exit(1);
}

console.log('toutes les fonctions de bord s\'analysent');
