#!/usr/bin/env node
/**
 * Extracteur de la distribution ouverte.
 *
 * Lit un snapshot en amont (jamais un repo git vivant), applique le manifeste,
 * et ecrit l'arbre public dans un repertoire de sortie. L'operation est
 * strictement unidirectionnelle : rien n'est jamais ecrit en amont.
 *
 * Usage :
 *   node tools/openrelease/extract.mjs \
 *     --upstream <chemin-du-snapshot> \
 *     --out <chemin-de-sortie> \
 *     [--profil open-core|full] \
 *     [--rapport <chemin.json>] \
 *     [--dry-run] [--purge-sortie]
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { estTexte } from './fichiers-texte.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))

// --- arguments -------------------------------------------------------------

function lireArgs(argv) {
  const a = { profil: null, dryRun: false, purgeSortie: false }
  for (let i = 2; i < argv.length; i++) {
    const cle = argv[i]
    const suivant = () => {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`valeur manquante pour ${cle}`)
      return v
    }
    switch (cle) {
      case '--upstream': a.upstream = suivant(); break
      case '--out': a.out = suivant(); break
      case '--profil': case '--profile': a.profil = suivant(); break
      case '--rapport': case '--report': a.rapport = suivant(); break
      case '--manifeste': case '--manifest': a.manifeste = suivant(); break
      case '--dry-run': a.dryRun = true; break
      case '--purge-sortie': a.purgeSortie = true; break
      default: throw new Error(`argument inconnu : ${cle}`)
    }
  }
  if (!a.upstream) throw new Error('--upstream est requis')
  if (!a.out) throw new Error('--out est requis')
  a.upstream = resolve(a.upstream)
  a.out = resolve(a.out)
  a.manifeste = resolve(a.manifeste ?? join(ICI, 'manifest.json'))
  return a
}

// --- garde-fous ------------------------------------------------------------

function verifierGardeFous(a) {
  if (!existsSync(a.upstream)) throw new Error(`amont introuvable : ${a.upstream}`)
  if (!statSync(a.upstream).isDirectory()) throw new Error(`l'amont doit etre un repertoire : ${a.upstream}`)

  const dedans = (parent, enfant) => {
    const rel = relative(parent, enfant)
    return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^\.\.[/\\]/.test(rel))
  }
  if (dedans(a.upstream, a.out)) throw new Error('la sortie ne peut pas etre dans l\'amont')
  if (dedans(a.out, a.upstream)) throw new Error('l\'amont ne peut pas etre dans la sortie')

  // L'amont doit etre un snapshot inerte : un .git signifie qu'on lit un repo
  // vivant, ce qui expose a une modification accidentelle.
  if (existsSync(join(a.upstream, '.git'))) {
    throw new Error(
      'l\'amont contient un .git : passe par un snapshot inerte.\n' +
      '  git -C <repo-amont> archive HEAD | tar -x -C <snapshot>'
    )
  }
}

// --- correspondance de motifs ---------------------------------------------

function globVersRegExp(glob) {
  let re = ''
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 3; continue }
        re += '.*'; i += 2; continue
      }
      re += '[^/]*'; i++; continue
    }
    if (c === '?') { re += '[^/]'; i++; continue }
    if ('\\^$.|+()[]{}'.includes(c)) { re += '\\' + c; i++; continue }
    re += c; i++
  }
  return new RegExp('^' + re + '$')
}

function compilerMotifs(entrees) {
  return entrees.map((e) => ({ ...e, re: globVersRegExp(e.pattern) }))
}

// --- parcours --------------------------------------------------------------

const IGNORE_TOUJOURS = new Set(['.git', 'node_modules', 'dist', 'build', '.turbo', 'coverage',
  'playwright-report', 'test-results', '.vite', '.next', '.venv', '__pycache__'])

function listerFichiers(racine) {
  const out = []
  const pile = ['']
  while (pile.length) {
    const rel = pile.pop()
    const abs = rel ? join(racine, rel) : racine
    for (const nom of readdirSync(abs)) {
      if (IGNORE_TOUJOURS.has(nom)) continue
      const relEnfant = rel ? `${rel}/${nom}` : nom
      const st = statSync(join(abs, nom))
      if (st.isDirectory()) pile.push(relEnfant)
      else if (st.isFile()) out.push({ chemin: relEnfant, taille: st.size })
    }
  }
  return out.sort((x, y) => x.chemin.localeCompare(y.chemin))
}

// --- reecritures -----------------------------------------------------------

// Faut-il reecrire ce fichier ? La regle est PARTAGEE avec la barriere de
// publication (voir tools/openrelease/fichiers-texte.mjs) : ce que l'extraction
// reecrit et ce que la barriere relit doivent former le MEME ensemble, sinon un
// fichier peut etre publie sans avoir ete ni reecrit ni verifie.
//
// C'etait le cas. Les deux outils tenaient chacun leur liste blanche
// d'extensions, et elles avaient diverge. Aucune ne reconnaissait les
// « Dockerfile.<suffixe> » -- l'extension y vaut « backend » ou « frontend » :
// docker/Dockerfile.backend et docker/Dockerfile.frontend portaient le nom de
// l'editeur d'origine ligne 2, sans que rien ne le signale.
//
// Le module partage inverse le sens : on nomme les binaires, on traite tout le
// reste. Un type de fichier inconnu est desormais reecrit par defaut.

function compilerReecritures(reecritures) {
  return (reecritures ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    cibles: (r.cibles ?? ['**/*']).map(globVersRegExp),
    regles: (r.regles ?? []).map((g) => ({
      re: new RegExp(g.chercher, g.drapeaux ?? 'g'),
      remplacer: g.remplacer,
      source: g.chercher,
    })),
  }))
}

// --- programme principal ---------------------------------------------------

function principal() {
  const a = lireArgs(process.argv)
  verifierGardeFous(a)

  const manifeste = JSON.parse(readFileSync(a.manifeste, 'utf8'))
  const profilNom = a.profil ?? manifeste.profil_par_defaut
  const profil = manifeste.profils?.[profilNom]
  if (!profil) throw new Error(`profil inconnu : ${profilNom} (connus : ${Object.keys(manifeste.profils ?? {}).join(', ')})`)

  const categoriesExclues = new Set(profil.exclut_categories ?? [])
  const exclusions = compilerMotifs(manifeste.exclusions ?? [])

  // `conserves_explicitement` etait declare dans le manifeste, documente dans
  // son README, et LU PAR PERSONNE : aucune ligne d'extract.mjs ne s'en servait.
  // Quatre entrees y dormaient, dont « LICENSE » et « docker/** ». Elles ne
  // protegeaient rien -- si une exclusion les avait attrapees, les fichiers
  // seraient partis quand meme.
  //
  // Une clef que le manifeste declare et qu'aucun outil n'applique est pire
  // qu'une clef absente : elle donne l'illusion d'une protection. Elle est
  // desormais appliquee, et elle l'emporte sur les exclusions.
  const conserves = compilerMotifs(manifeste.conserves_explicitement ?? [])

  // --- regles a contenu sensible -------------------------------------------
  //
  // Certaines regles ne peuvent pas vivre dans le manifeste public : pour dire
  // « remplace cette adresse IP », il faut l'ecrire, et ce fichier est publie
  // avec le depot. Le manifeste public ne porte donc que des JALONS -- un
  // identifiant et une empreinte -- et les definitions vivent dans
  // manifest-prive.json, jamais versionne.
  //
  // L'ABSENCE DU FICHIER EST UNE ERREUR, PAS UN DEFAUT SILENCIEUX. Continuer
  // sans lui produirait un arbre ou ces valeurs sont restees en clair, et
  // l'extraction se terminerait sur un succes. C'est exactement le genre de
  // faux vert que la barriere existe pour empecher.
  // Les jalons vivent a deux endroits : poses A LEUR PLACE dans `reecritures`,
  // ce qui preserve l'ordre d'application, et dans le tableau historique
  // `reecritures_privees`. Ne regarder que le second faisait echouer
  // l'extraction sur « regle presente dans le fichier prive sans jalon
  // public » -- et cet echec, mal filtre par l'appelant, passait pour un
  // succes : l'arbre n'etait plus regenere, sans que rien ne le dise.
  const jalons = [
    ...(manifeste.reecritures ?? []).filter((r) => r.prive),
    ...(manifeste.reecritures_privees ?? []),
  ]
  const cheminPrive = join(dirname(a.manifeste), 'manifest-prive.json')
  let reecrituresPrivees = []

  if (jalons.length > 0) {
    if (!existsSync(cheminPrive)) {
      throw new Error(
        `${jalons.length} regle(s) a contenu sensible sont declarees dans le manifeste, ` +
        `mais ${cheminPrive} est introuvable.\n` +
        `Sans lui, l'arbre extrait garderait en clair les adresses, domaines et ` +
        `numeros que ces regles doivent masquer. Extraction refusee.`
      )
    }
    const prive = JSON.parse(readFileSync(cheminPrive, 'utf8'))
    reecrituresPrivees = prive.reecritures ?? []

    // Chaque jalon doit trouver sa definition, et l'inverse : une regle privee
    // sans jalon serait appliquee sans que le manifeste public l'annonce.
    const parId = new Map(reecrituresPrivees.map((r) => [r.id, r]))
    const manquantes = jalons.filter((j) => !parId.has(j.id)).map((j) => j.id)
    if (manquantes.length) {
      throw new Error(
        `regle(s) sensible(s) declaree(s) mais absente(s) du fichier prive : ${manquantes.join(', ')}`
      )
    }
    const idsJalons = new Set(jalons.map((j) => j.id))
    const orphelines = reecrituresPrivees.filter((r) => !idsJalons.has(r.id)).map((r) => r.id)
    if (orphelines.length) {
      throw new Error(
        `regle(s) presente(s) dans le fichier prive sans jalon public : ${orphelines.join(', ')}`
      )
    }

    console.log(`extract: ${reecrituresPrivees.length} regle(s) a contenu sensible chargee(s)`)
  }

  // L'ORDRE COMPTE, ET IL EST DECLARE DANS LE MANIFESTE PUBLIC.
  //
  // Chaque regle voit le texte que les precedentes ont produit. Une regle
  // sensible deplacee en fin de tableau ne rencontre donc plus le meme texte :
  // en poussant les regles de neutralisation de domaines apres celles de
  // marque, le domaine de l'editeur devenait « marque-ia.com » avant d'etre
  // neutralise -- un domaine plausible, publie tel quel. Le commentaire qui
  // tenait ici affirmait respecter l'ordre des jalons ; le code les ajoutait
  // tous a la fin.
  //
  // Un jalon pose DANS `reecritures` est donc resolu A SA PLACE. Le tableau
  // `reecritures_privees` reste accepte pour les jalons historiques, appliques
  // ensuite -- c'est l'ordre dans lequel ils ont toujours tourne.
  const parIdPrivees = new Map(reecrituresPrivees.map((r) => [r.id, r]))
  const posees = new Set()
  const enPlace = (manifeste.reecritures ?? []).map((r) => {
    if (!r.prive) return r
    const definition = parIdPrivees.get(r.id)
    if (!definition) {
      throw new Error(`jalon « ${r.id} » pose dans reecritures sans definition privee`)
    }
    posees.add(r.id)
    return definition
  })
  const reecritures = compilerReecritures([
    ...enPlace,
    ...reecrituresPrivees.filter((r) => !posees.has(r.id)),
  ])

  // Ce qui appartient au depot aval : ni purge, ni ecrase par l'amont.
  // Les substituts obeissent a la meme regle : ce sont des fichiers produits
  // pour la distribution, qui remplacent leur homologue de l'amont.
  const possedeParAval = [...(manifeste.possede_par_aval ?? []), ...(manifeste.substituts ?? [])]
    .map(globVersRegExp)
  const estPossedeParAval = (chemin) => possedeParAval.some((re) => re.test(chemin))

  const fichiers = listerFichiers(a.upstream)

  const gardes = []
  const exclus = []
  const inconnus = []
  const refusesCarAval = []

  for (const f of fichiers) {
    // Un fichier amont homonyme d'un fichier possede par l'aval est ignore :
    // sinon le README public serait remplace par celui de l'amont.
    if (estPossedeParAval(f.chemin)) { refusesCarAval.push(f); continue }
    // Une conservation explicite l'emporte sur toute exclusion : c'est le seul
    // moyen de retirer un sous-arbre en epargnant les quelques fichiers qui y
    // vivent sans lui appartenir.
    const conserve = conserves.find((c) => c.re.test(f.chemin))
    if (conserve) { gardes.push(f); continue }

    const regle = exclusions.find((e) => e.re.test(f.chemin))
    if (!regle) { gardes.push(f); continue }
    if (!manifeste.categories?.[regle.categorie]) inconnus.push({ ...f, categorie: regle.categorie })
    if (categoriesExclues.has(regle.categorie)) {
      exclus.push({ ...f, categorie: regle.categorie, motif: regle.motif, pattern: regle.pattern })
    } else {
      gardes.push(f)
    }
  }

  // Copie et reecriture
  let octetsGardes = 0
  let fichiersReecrits = 0
  const detailReecritures = []

  if (a.purgeSortie && !a.dryRun && existsSync(a.out)) {
    // La purge opere FICHIER PAR FICHIER, jamais par repertoire de premier
    // niveau. Une premiere version supprimait les entrees racine non protegees :
    // elle emportait alors src/, supabase/, docker/ et scripts/ en entier, donc
    // les substituts qu'ils contiennent, alors que ces repertoires melangent
    // fichiers venus de l'amont et fichiers propres a la distribution.
    const supprimes = []
    const aSupprimer = []
    const parcourir = (rel) => {
      const abs = rel ? join(a.out, rel) : a.out
      for (const nom of readdirSync(abs)) {
        const relEnfant = rel ? `${rel}/${nom}` : nom
        if (relEnfant === '.git' || relEnfant.startsWith('.git/')) continue
        // Les repertoires jamais extraits ne sont jamais purges non plus :
        // sans cette garde, chaque extraction detruisait node_modules et
        // obligeait a tout reinstaller.
        if (IGNORE_TOUJOURS.has(nom)) continue
        if (estPossedeParAval(relEnfant)) continue
        const st = statSync(join(abs, nom))
        if (st.isDirectory()) {
          // Un repertoire protege en bloc (tools/**) n'est pas parcouru.
          if (possedeParAval.some((re) => re.test(`${relEnfant}/`))) continue
          parcourir(relEnfant)
          // On retire le repertoire s'il est devenu vide.
          try { if (readdirSync(join(abs, nom)).length === 0) rmSync(join(abs, nom), { recursive: true }) } catch { /* laisse */ }
        } else {
          // On ne supprime rien avant d'avoir verifie : la premiere version de
          // cette garde refusait APRES coup, si bien que le fichier etait deja
          // perdu et qu'au passage suivant elle ne le voyait plus du tout.
          aSupprimer.push({ rel: relEnfant, abs: join(abs, nom) })
        }
      }
    }
    parcourir('')

    // Un fichier SUIVI PAR GIT que l'amont ne fournit pas est un fichier propre
    // a la distribution : le purger, c'est detruire du travail deja commite.
    // C'est arrive quatre fois en une seule extraction -- une barriere
    // d'integration continue, un certificat d'origine, un audit de licences et
    // le schema des espaces de stockage -- tous rattrapes par git, ce qui n'a
    // rien d'une garantie. La purge s'arrete desormais net, en nommant ce
    // qu'elle refuse de detruire.
    const nonDeclares = []
    try {
      const suivis = new Set(
        execFileSync('git', ['ls-files'], { cwd: a.out, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
          .split('\n').filter(Boolean),
      )
      // Une cible de renommage n'existe JAMAIS en amont : c'est sa definition.
      // La confondre avec du travail propre a l'aval ferait crier la garde a
      // chaque extraction, et on finirait par la desarmer.
      const cibleDeRenommage = (rel) =>
        (manifeste.renommages ?? []).some((r) => rel === r.vers || rel.startsWith(r.vers))

      for (const { rel } of aSupprimer) {
        if (!suivis.has(rel)) continue
        if (existsSync(join(a.upstream, rel))) continue
        if (cibleDeRenommage(rel)) continue
        nonDeclares.push(rel)
      }
    } catch { /* hors depot git : le controle ne s'applique pas */ }

    if (nonDeclares.length) {
      // Rien n'a encore ete supprime : le depot est intact.
      console.error(`\nEXTRACTION INTERROMPUE : ${nonDeclares.length} fichier(s) suivi(s) par git`)
      console.error("absent(s) de l'amont ont ete purge(s). Ils appartiennent a la distribution.\n")
      for (const f of nonDeclares) console.error(`  ${f}`)
      console.error('\nRestaurez-les (git checkout HEAD -- <fichiers>), puis declarez-les')
      console.error('dans « possede_par_aval » du manifeste avant de relancer.')
      process.exit(1)
    }

    // Verification passee : la suppression peut avoir lieu.
    for (const { rel, abs } of aSupprimer) {
      rmSync(abs, { force: true })
      supprimes.push(rel)
    }

    // Les repertoires devenus vides partent apres leurs fichiers.
    const nettoyerVides = (rel) => {
      const abs = rel ? join(a.out, rel) : a.out
      let noms
      try { noms = readdirSync(abs) } catch { return }
      for (const nom of noms) {
        const relEnfant = rel ? `${rel}/${nom}` : nom
        if (relEnfant === '.git' || IGNORE_TOUJOURS.has(nom)) continue
        if (estPossedeParAval(relEnfant)) continue
        try {
          if (statSync(join(abs, nom)).isDirectory()) {
            nettoyerVides(relEnfant)
            if (readdirSync(join(abs, nom)).length === 0) rmSync(join(abs, nom), { recursive: true })
          }
        } catch { /* deja parti */ }
      }
    }
    nettoyerVides('')

    console.log(`purge            : ${supprimes.length} fichier(s) retire(s)`)
  }

  // Renommages : le chemin de DESTINATION differe de celui de l'amont. Sans
  // cela, les reecritures corrigent les imports mais pas les fichiers vises, et
  // le projet ne compile plus.
  const renommages = (manifeste.renommages ?? []).map((r) => ({ de: r.de, vers: r.vers, utilise: false }))

  // Un renommage ECRIT sur son chemin de DESTINATION, alors que la protection
  // « possede_par_aval » s'evalue sur le chemin AMONT. Un renommage pouvait donc
  // contourner la protection et ecraser un fichier propre a la distribution :
  // c'est arrive au logo de l'application, remplace a chaque extraction par
  // l'icone de l'editeur d'origine que la LICENSE exclut pourtant du droit
  // accorde. Le defaut etait muet -- le fichier gardait son nom.
  const renommagesInterdits = renommages.filter(
    (r) => estPossedeParAval(r.vers) || estPossedeParAval(`${r.vers.replace(/\/$/, '')}/`),
  )
  if (renommagesInterdits.length) {
    console.error(`\nEXTRACTION REFUSEE : ${renommagesInterdits.length} renommage(s) visent`)
    console.error('une destination declaree « possede_par_aval ». Ils ecraseraient du')
    console.error("travail propre a la distribution. Excluez la SOURCE plutot que de la renommer.\n")
    for (const r of renommagesInterdits) console.error(`  ${r.de} -> ${r.vers}`)
    process.exit(1)
  }
  const renommer = (chemin) => {
    for (const r of renommages) {
      // Un prefixe de repertoire DOIT se terminer par « / » : sans lui, seul un
      // chemin exactement egal serait renomme, ce qui n'arrive jamais. Une
      // declaration « services/gsi- » est ainsi restee sans effet, et les
      // documents reecrits renvoyaient vers des repertoires inexistants.
      if (r.de.endsWith('/') && chemin.startsWith(r.de)) { r.utilise = true; return r.vers + chemin.slice(r.de.length) }
      if (chemin === r.de) { r.utilise = true; return r.vers }
    }
    return chemin
  }
  let fichiersRenommes = 0

  for (const f of gardes) {
    octetsGardes += f.taille
    if (a.dryRun) continue
    const src = join(a.upstream, f.chemin)
    const cheminSortie = renommer(f.chemin)
    if (cheminSortie !== f.chemin) fichiersRenommes++
    const dst = join(a.out, cheminSortie)
    mkdirSync(dirname(dst), { recursive: true })

    const applicables = estTexte(f.chemin.split('/').pop(), src)
      ? reecritures.filter((r) => r.cibles.some((c) => c.test(f.chemin)))
      : []

    if (applicables.length === 0) { copyFileSync(src, dst); continue }

    let contenu = readFileSync(src, 'utf8')
    const avant = contenu
    const appliquees = []
    for (const r of applicables) {
      for (const g of r.regles) {
        g.re.lastIndex = 0
        const n = (contenu.match(g.re) ?? []).length
        if (n > 0) { contenu = contenu.replace(g.re, g.remplacer); appliquees.push({ regle: r.id, motif: g.source, occurrences: n }) }
      }
    }
    if (contenu !== avant) {
      // Une reecriture ne doit jamais rendre invalide un fichier qui ne l'etait
      // pas. Le cas s'est produit : une regle a insere un saut de ligne
      // litteral dans package.json, qui n'etait plus analysable — et la
      // barriere, qui ne juge que le contenu, restait verte sur un depot
      // pourtant inutilisable.
      //
      // On verifie qu'on n'a pas CASSE, pas qu'on a REPARE : certains fichiers
      // de configuration sont du JSON commente, deja invalide pour un
      // analyseur strict avant toute reecriture.
      if (f.chemin.endsWith('.json')) {
        let etaitValide = true
        try { JSON.parse(avant) } catch { etaitValide = false }
        if (etaitValide) {
          try {
            JSON.parse(contenu)
          } catch (e) {
            throw new Error(
              `reecriture invalide : ${f.chemin} etait analysable et ne l'est plus (${e.message}).\n` +
                `  regles appliquees : ${appliquees.map((x) => x.regle).join(', ')}`
            )
          }
        }
      }
      fichiersReecrits++
      detailReecritures.push({ chemin: f.chemin, appliquees })
    }
    writeFileSync(dst, contenu)
  }

  // Rapport
  const parCategorie = {}
  for (const e of exclus) {
    parCategorie[e.categorie] ??= { fichiers: 0, octets: 0, motifs: new Set() }
    parCategorie[e.categorie].fichiers++
    parCategorie[e.categorie].octets += e.taille
    parCategorie[e.categorie].motifs.add(e.pattern)
  }

  const rapport = {
    genere_par: 'tools/openrelease/extract.mjs',
    profil: profilNom,
    dry_run: a.dryRun,
    amont: { chemin: a.upstream, head: manifeste.upstream?.head_extrait ?? null, repo: manifeste.upstream?.repo ?? null },
    sortie: a.out,
    totaux: {
      fichiers_amont: fichiers.length,
      fichiers_gardes: gardes.length,
      fichiers_exclus: exclus.length,
      fichiers_ignores_car_possedes_par_aval: refusesCarAval.length,
      octets_gardes: octetsGardes,
      octets_exclus: exclus.reduce((s, e) => s + e.taille, 0),
      fichiers_reecrits: fichiersReecrits,
    },
    ignores_car_possedes_par_aval: refusesCarAval.map((f) => f.chemin),
    par_categorie: Object.fromEntries(
      Object.entries(parCategorie).map(([k, v]) => [k, { fichiers: v.fichiers, octets: v.octets, motifs: [...v.motifs].sort() }])
    ),
    conservations_sans_correspondance: conserves
      .filter((c) => !fichiers.some((f) => c.re.test(f.chemin)))
      .map((c) => c.pattern),
    motifs_sans_correspondance: exclusions
      .filter((e) => !fichiers.some((f) => e.re.test(f.chemin)))
      .map((e) => e.pattern),
    categories_inconnues: inconnus.map((i) => ({ chemin: i.chemin, categorie: i.categorie })),
    reecritures: detailReecritures,
    exclus: exclus.map((e) => ({ chemin: e.chemin, categorie: e.categorie, octets: e.taille })),
  }

  if (a.rapport) {
    mkdirSync(dirname(resolve(a.rapport)), { recursive: true })
    writeFileSync(resolve(a.rapport), JSON.stringify(rapport, null, 2))
  }

  const mo = (n) => (n / 1024 / 1024).toFixed(1) + ' Mo'
  console.log(`profil            : ${profilNom}${a.dryRun ? ' (dry-run)' : ''}`)
  console.log(`amont             : ${a.upstream}`)
  console.log(`sortie            : ${a.out}`)
  console.log(`fichiers amont    : ${fichiers.length}`)
  console.log(`  gardes          : ${gardes.length} (${mo(octetsGardes)})`)
  console.log(`  exclus          : ${exclus.length} (${mo(rapport.totaux.octets_exclus)})`)
  console.log(`  reecrits        : ${fichiersReecrits}`)
  console.log(`  ignores (aval)  : ${refusesCarAval.length}`)
  console.log(`  renommes        : ${fichiersRenommes}`)

  // Un renommage declare qui ne s'applique jamais est un piege silencieux : le
  // manifeste affirme un deplacement que la sortie ne fait pas, et les
  // reecritures de chemins pointent alors dans le vide.
  const renommagesMorts = renommages.filter((r) => !r.utilise)
  if (renommagesMorts.length) {
    console.log(`\n  ATTENTION : ${renommagesMorts.length} renommage(s) declare(s) sans effet`)
    for (const r of renommagesMorts) console.log(`    ${r.de} -> ${r.vers}`)
    console.log('    Verifiez le chemin, et la barre oblique finale pour un repertoire.')
  }
  for (const [cat, v] of Object.entries(rapport.par_categorie).sort((x, y) => y[1].fichiers - x[1].fichiers)) {
    console.log(`    ${cat.padEnd(22)} ${String(v.fichiers).padStart(6)} fichiers  ${mo(v.octets).padStart(10)}`)
  }
  if (rapport.motifs_sans_correspondance.length) {
    console.log(`\nmotifs sans correspondance (a corriger dans le manifeste) :`)
    for (const p of rapport.motifs_sans_correspondance) console.log(`  - ${p}`)
  }
  if (rapport.categories_inconnues.length) {
    console.log(`\nATTENTION categories inconnues : ${rapport.categories_inconnues.length}`)
  }
  if (a.rapport) console.log(`\nrapport : ${resolve(a.rapport)}`)
}

try {
  principal()
} catch (e) {
  console.error(`extract: ${e.message}`)
  process.exit(1)
}
