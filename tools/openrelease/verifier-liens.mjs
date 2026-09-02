#!/usr/bin/env node
/**
 * Verifie que la documentation ne renvoie pas vers des chemins absents.
 *
 * Une partie du contenu de l'amont est deliberement exclue de la distribution :
 * infrastructure privee, corpus de migrations remplace, archives d'audit. La
 * documentation heritee continue pourtant d'y renvoyer. Un chemin mort dans un
 * guide d'installation coute plus cher qu'une phrase en moins : celui qui le
 * suit conclut que la distribution est incomplete.
 *
 * Le PARCOURS D'INSTALLATION est verifie strictement — c'est ce qu'un
 * utilisateur lit vraiment. Le reste de la documentation est compte et affiche,
 * sans faire echouer : c'est de la dette heritee, mesuree plutot que taue.
 *
 * Usage : node tools/openrelease/verifier-liens.mjs [--tout]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
process.chdir(RACINE)

const PARCOURS = [
  'README.md', 'CHANTIER.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SELF_HOSTING.md',
  'docs/DEMARRAGE_RAPIDE.md', 'docs/EXPLOITATION.md', 'docs/ARCHITECTURE.md',
  'docs/IMPORT_EXPORT.md', 'docs/CONFIGURATION.md', 'docs/SECURITE_DEFAUTS.md',
]

// Seuls les vrais chemins sont testes : un nom de fichier cite sans repertoire
// n'est pas une reference resolvable, et le signaler serait du bruit.
//
// « docs » manquait a cette liste : un renvoi vers un document absent du
// repertoire docs/ n'etait donc JAMAIS teste, alors que c'est la cible la plus
// courante des renvois entre documents. Le controle etait vert par
// construction sur toute une famille de liens.
const MOTIF = /`((?:src|supabase|docker|scripts|tools|tests|apps|services|infra|public|e2e|\.github|\.gitea|android|ios|docs)\/[a-zA-Z0-9_./-]+?)(?::\d+(?:-\d+)?)?`/g

function liensMorts(fichier) {
  const s = readFileSync(fichier, 'utf8')
  const morts = new Set()
  for (const m of s.matchAll(MOTIF)) {
    const chemin = m[1].replace(/\/$/, '')
    if (!existsSync(chemin)) morts.add(m[1])
  }
  return [...morts].sort()
}

function tousLesDocuments() {
  const out = []
  const pile = ['docs']
  while (pile.length) {
    const d = pile.pop()
    if (!existsSync(d)) continue
    for (const nom of readdirSync(d)) {
      const p = join(d, nom)
      if (statSync(p).isDirectory()) pile.push(p)
      else if (nom.endsWith('.md')) out.push(p)
    }
  }
  for (const nom of readdirSync('.')) if (nom.endsWith('.md')) out.push(nom)
  return out.sort()
}

const tout = process.argv.includes('--tout')
let echec = 0

console.log("== parcours d'installation ==")
for (const f of PARCOURS) {
  if (!existsSync(f)) {
    console.log(`  ABSENT ${f}`)
    echec = 1
    continue
  }
  const morts = liensMorts(f)
  if (morts.length === 0) {
    console.log(`  OK     ${f}`)
  } else {
    console.log(`  ECHEC  ${f} : ${morts.length} lien(s) mort(s)`)
    for (const m of morts) console.log(`             ${m}`)
    echec = 1
  }
}

const autres = tousLesDocuments().filter((f) => !PARCOURS.includes(f))
let totalAutres = 0
const detail = []
for (const f of autres) {
  const morts = liensMorts(f)
  if (morts.length) {
    totalAutres += morts.length
    detail.push([f, morts])
  }
}
console.log(`\n== reste de la documentation ==`)
console.log(`  ${autres.length} documents, ${totalAutres} lien(s) mort(s) — dette heritee, non bloquante`)
if (tout) for (const [f, morts] of detail) console.log(`      ${f} : ${morts.length}`)

console.log()
if (echec === 0) {
  console.log("LIENS VERIFIES : le parcours d'installation ne renvoie vers aucun chemin absent.")
} else {
  console.error("LIENS NON VERIFIES : voir les echecs ci-dessus.")
}
process.exit(echec)
