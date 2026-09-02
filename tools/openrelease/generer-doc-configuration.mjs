#!/usr/bin/env node
/**
 * Genere docs/CONFIGURATION.md depuis le registre des variables.
 *
 * La reference de configuration est DERIVEE du registre, jamais ecrite a la
 * main : c'est la seule facon qu'elle ne diverge pas du controle execute au
 * demarrage. Un document de configuration faux est pire qu'absent.
 */
import { REGISTRE, PORTEES, PROFILS } from '../../scripts/env-registry.mjs'
import { writeFileSync } from 'node:fs'

const LIBELLE_PORTEE = {
  build: 'Construction du frontend',
  plateforme: "Plateforme (base, authentification, stockage, passerelle)",
  bord: 'Fonctions de bord',
  service: 'Services annexes',
}
const LIBELLE_NIVEAU = { requis: 'requis', conditif: 'conditionnel', option: 'optionnel' }

const echapper = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

let md = `# Configuration d'une instance OpenPulse

Référence exhaustive des variables d'environnement. Elle est **dérivée du
registre** \`scripts/env-registry.mjs\`, qui est la source unique : ce document
ne peut donc pas diverger du contrôle exécuté au démarrage.

Vérifier une configuration :

\`\`\`bash
node scripts/check-env.mjs --profil minimal   # le strict nécessaire pour démarrer
node scripts/check-env.mjs --profil complet   # toutes les fonctionnalités
\`\`\`

## Lecture des tableaux

| Colonne | Sens |
|---|---|
| Niveau | \`requis\` : sans elle, rien ne démarre. \`conditionnel\` : requise si la fonctionnalité qu'elle ouvre est activée. \`optionnel\` : une valeur par défaut sûre existe. |
| Si absente | Ce qui se produit concrètement. |
| Débloque | Ce que la variable rend possible. |

`

const total = REGISTRE.length
const parProfil = Object.fromEntries(PROFILS.map((p) => [p, REGISTRE.filter((v) => v.profils?.includes(p)).length]))
md += `## Vue d'ensemble\n\n`
md += `${total} variables au total.\n\n`
md += `| Profil | Variables |\n|---|---|\n`
for (const [p, n] of Object.entries(parProfil)) md += `| ${p} | ${n} |\n`
md += `\n| Niveau | Variables |\n|---|---|\n`
for (const n of ['requis', 'conditif', 'option']) {
  md += `| ${LIBELLE_NIVEAU[n]} | ${REGISTRE.filter((v) => v.niveau === n).length} |\n`
}

const silencieuses = REGISTRE.filter((v) => v.absence === 'silencieuse' || /silenc/i.test(v.absence ?? ''))
if (silencieuses.length) {
  md += `\n## Dégradations silencieuses\n\n`
  md += `Ces variables ne font échouer personne quand elles manquent : la fonctionnalité disparaît sans bruit. Ce sont celles qu'il faut vérifier en premier.\n\n`
  md += `| Variable | Débloque |\n|---|---|\n`
  for (const v of silencieuses) md += `| \`${v.nom}\` | ${echapper(v.debloque)} |\n`
}

for (const portee of PORTEES) {
  const vars = REGISTRE.filter((v) => v.portee === portee)
  if (!vars.length) continue
  md += `\n## ${LIBELLE_PORTEE[portee] ?? portee}\n\n`
  md += `| Variable | Niveau | Défaut | Si absente | Débloque |\n|---|---|---|---|---|\n`
  for (const v of vars.sort((a, b) => a.nom.localeCompare(b.nom))) {
    const defaut = v.defaut === undefined || v.defaut === '' ? '—' : `\`${echapper(v.defaut)}\``
    md += `| \`${v.nom}\` | ${LIBELLE_NIVEAU[v.niveau] ?? v.niveau} | ${defaut} | ${echapper(v.absence)} | ${echapper(v.debloque)} |\n`
  }
}

md += `\n## Valeurs interdites\n\nLe contrôle refuse certaines valeurs, même syntaxiquement correctes : gabarits laissés en place, secrets d'exemple, origines ouvertes à tous. Voir \`REMPLISSAGES_INTERDITS\` dans le registre.\n`

writeFileSync(new URL('../../docs/CONFIGURATION.md', import.meta.url), md)
console.log(`  docs/CONFIGURATION.md ecrit : ${total} variables, ${md.length} caracteres`)
