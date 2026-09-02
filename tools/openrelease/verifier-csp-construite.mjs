#!/usr/bin/env node
/**
 * Refuse une construction dont la politique de sécurité de contenu porte
 * encore un marqueur de substitution.
 *
 * POURQUOI CET OUTIL EXISTE
 * La CSP d'`index.html` reçoit les origines propres à l'installation par
 * substitution Vite : `%VITE_CSP_CONNECT_EXTRA%` et trois autres. Vite ne
 * substitue que ce qui est défini ; une variable absente laisse le marqueur
 * LITTÉRAL dans le HTML produit. La construction réussit, l'application se
 * charge, son titre s'affiche — et le navigateur refuse ensuite chaque appel
 * vers l'API, parce que `connect-src 'self' %VITE_CSP_CONNECT_EXTRA%` n'a
 * jamais autorisé cette origine.
 *
 * Constaté en chargeant réellement le paquet construit : quatorze refus de CSP
 * à l'ouverture, aucune donnée, et pas une seule erreur de construction. Aucun
 * test unitaire ne pouvait le voir : le défaut naît de l'environnement de
 * build, pas du code.
 *
 * Usage : node verifier-csp-construite.mjs [dist]
 * Sortie : code 1 s'il reste un marqueur.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] || 'dist';
const html = join(dist, 'index.html');

if (!existsSync(html)) {
  console.error(`${html} est absent : construisez avant de vérifier.`);
  process.exit(2);
}

const texte = readFileSync(html, 'utf8');
const marqueurs = [...new Set([...texte.matchAll(/%[A-Z0-9_]+%/g)].map((m) => m[0]))];

if (marqueurs.length === 0) {
  const csp = texte.match(/Content-Security-Policy"[^>]*content="([^"]+)"/);
  const connect = csp && csp[1].match(/connect-src ([^;]+)/);
  console.log('CSP construite : aucun marqueur résiduel');
  if (connect) console.log(`  connect-src ${connect[1].trim()}`);
  process.exit(0);
}

console.log(`MARQUEURS NON SUBSTITUÉS : ${marqueurs.length}\n`);
for (const m of marqueurs) console.log(`  ${m}`);
console.log(`\nDéfinissez ces variables avant la construction, même vides.`);
console.log(`Vite ne substitue dans index.html que ce qui existe : une variable`);
console.log(`absente y laisse son marqueur tel quel, et la page part en production`);
console.log(`avec. Selon le marqueur, cela bloque toutes les requêtes vers l'API`);
console.log(`(politique de sécurité) ou affiche « %VITE_… % » dans l'onglet du`);
console.log(`navigateur et dans l'aperçu de tout lien partagé (nom de produit).`);
process.exit(1);
