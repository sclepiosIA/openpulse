#!/usr/bin/env node
/**
 * Barriere de publication.
 *
 * Analyse un arbre et refuse la publication s'il contient un secret, une
 * donnee personnelle reelle, une marque proscrite ou une reference a
 * l'infrastructure privee de l'editeur.
 *
 * Concu pour tourner en pre-commit et en CI : sort en code 1 des qu'une regle
 * bloquante declenche.
 *
 * Usage :
 *   node tools/openrelease/scan.mjs [--cible <chemin>] [--rapport <f.json>]
 *                                   [--severite blocker|high|medium]
 *                                   [--json] [--tout]
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
// Regle unique, partagee avec extract.mjs. Voir fichiers-texte.mjs pour la
// mesure qui a fait abandonner la liste blanche d'extensions.
import { estTexte } from './fichiers-texte.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE_DEFAUT = resolve(ICI, '..', '..')

// --- regles ----------------------------------------------------------------

const REGLES = [
  // --- secrets ---
  {
    id: 'jwt-reel',
    severite: 'blocker',
    libelle: 'jeton JWT complet en clair',
    re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  },
  {
    id: 'cle-privee',
    severite: 'blocker',
    libelle: 'cle privee',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: 'cle-api-fournisseur',
    severite: 'blocker',
    libelle: 'cle d\'API de fournisseur',
    re: /\b(?:sk-[A-Za-z0-9]{20,}|xox[bpas]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/g,
  },
  {
    id: 'chaine-connexion-avec-mdp',
    severite: 'blocker',
    libelle: 'chaine de connexion contenant un mot de passe',
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/'"]+:[^\s@/'"]{6,}@/g,
    // Une substitution — $VAR, ${VAR}, $(cmd), %s — n'est pas un mot de passe :
    // la valeur reelle vit ailleurs, et c'est precisement ce qu'on veut.
    ignorerSi: /(?:password|mot[_ ]?de[_ ]?passe|change[_ ]?me|changeme|remplacer|a[_ ]definir|to[_ ]?replace|xxx+|\*{3,}|postgres:postgres|user:pass|<[^>]+>|\$\w|\$\{|\$\(|%s|\{\{)/i,
  },
  {
    id: 'secret-affecte',
    severite: 'high',
    libelle: 'secret affecte en dur',
    re: /\b(?:JWT_SECRET|ENCRYPTION_KEY|SERVICE_ROLE_KEY|SERVICE_KEY|VAPID_PRIVATE_KEY|API_KEY|APIKEY|ADMIN_PASSWORD|DB_PASSWORD|SMTP_PASS(?:WORD)?)\s*[:=]\s*['"`][^'"`\n]{12,}['"`]/gi,
    // Une valeur GENEREE n'est pas une valeur en dur : openssl rand, uuidgen,
    // crypto.randomBytes et les substitutions de commande produisent un secret
    // different a chaque execution, ce qui est precisement la bonne pratique.
    ignorerSi: /(?:process\.env|Deno\.env|import\.meta\.env|your[-_]|placeholder|changeme|example|exemple|xxx+|\*{3,}|<[^>]+>|\$\{|\$\(|openssl rand|randomBytes|uuidgen|gen_random|dummy|fake|test|mock)/i,
  },

  // --- donnees personnelles reelles ---
  {
    id: 'email-etablissement-reel',
    severite: 'blocker',
    libelle: 'adresse de messagerie d\'un etablissement de sante reel',
    re: /\b[A-Za-z0-9._%+-]+@(?:chu-|ch-|ght-|ght\d|ghef|hopital-|hopitaux-|hospices-|clinique-|polyclinique-|ehpad-|aphp|ap-hm|chru-|ghu-|gh-)[A-Za-z0-9.-]*\.[a-z]{2,}\b/gi,
    ignorerSi: /(?:exemple|example|test|fictif|demo|sample|placeholder|monetablissement|votre)/i,
  },
  {
    id: 'telephone-francais-formate',
    severite: 'high',
    libelle: 'numero de telephone francais formate hors plage de fiction',
    // Le numero doit etre isole : dans « 01 02 04 06 19 20 30 », chaque groupe
    // est un numero d'ordre, pas un numero de telephone. On exige donc qu'aucun
    // groupe de deux chiffres ne suive immediatement.
    re: /\b0[1-9](?:[ .]\d{2}){4}(?![ .]?\d)/g,
    // L'autorite de regulation reserve des plages aux usages de fiction : un
    // numero pris dedans ne peut joindre personne, c'est donc le bon choix pour
    // une fixture. Les reconnaitre evite de signaler du travail bien fait, et
    // permet d'exiger ces plages plutot que des numeros inventes au hasard.
    //   01 99 00-99 · 02 61 91-99 · 03 53 01-99 · 04 65 71-79
    //   05 36 49-99 · 06 39 98-99 · 07 00 99 · 07 55 53-59
    ignorerSi: /(?:0(?:1[ .]99|2[ .]61[ .]9|3[ .]53|4[ .]65[ .]7|5[ .]36[ .][49]|6[ .]39[ .]9|7[ .](?:00[ .]99|55[ .]5))|00 00 00 00|12 34 56 78|11 22 33 44|99 99 99 99|00\.00\.00\.00|12\.34\.56\.78)/,
  },
  {
    id: 'iban',
    severite: 'blocker',
    libelle: 'IBAN',
    re: /\bFR\d{2}[ ]?(?:\d{4}[ ]?){5}\d{3}\b/g,
    ignorerSi: /(?:0000|1234\s?5678|XXXX)/i,
  },

  // --- marques ---
  {
    id: 'chemin-absolu-machine-auteur',
    severite: 'blocker',
    libelle: "chemin absolu d'une machine de developpement",
    // Dix occurrences dans sept fichiers suivis ont ete publiees sous une
    // barriere verte : la regle infra-privee-editeur ne visait que des FQDN.
    // Un chemin de home livre le nom de compte reel de l'auteur, l'arborescence
    // privee de son organisation, et designe chez l'adoptant un repertoire qui
    // n'existe pas -- le script echoue sans dire pourquoi.
    re: /(?:\/Users\/(?!runner\b|vagrant\b)[a-z0-9._-]{2,}|\/home\/(?!runner\b|vagrant\b|node\b|user\b)[a-z0-9._-]{2,}|C:\\\\Users\\\\(?!runner\b)[A-Za-z0-9._-]{2,})\//gi,
    // Les chemins de gabarit et ceux des executeurs d'integration continue ne
    // designent personne.
    // Faux positifs mesures : /home/deno et /home/kong sont des chemins
    // d'images officielles, /home/marque un gabarit de documentation, et
    // « /Home/End/ » designe deux touches de clavier.
    ignorerSi: /\/(?:Users|home)\/(?:runner|vagrant|node|user|deno|kong|app|nginx|postgres|marque|openpulse|exploitant|votre[-_]?nom|nom[-_]?utilisateur|USERNAME|<[a-z]+>)\b|\/Home\/End\b/i,
  },

  {
    id: 'plateforme-edition-heritee',
    severite: 'blocker',
    surChemin: true,
    libelle: "trace de la plateforme d'edition sur laquelle le produit a ete ecrit",
    // Le plus grave n'etait pas le nom : 935 URL des verrous de dependances
    // resolvaient depuis un cache npm PRIVE de cette plateforme. Un adoptant
    // qui lance « npm ci » telechargeait donc ses dependances chez un tiers,
    // et non depuis le registre public -- silencieusement, puisque .npmrc
    // declare pourtant le bon registre : une URL absolue dans un verrou prime
    // sur le registre configure.
    re: /\blovable\b/gi,
  },

  {
    id: 'marque-editeur-nue',
    severite: 'blocker',
    surChemin: true,
    libelle: "nom de l'editeur, hors domaine et hors identifiant de paquet",
    // Vingt-cinq occurrences vivaient dans le schema SQL publie : colonnes,
    // declencheur, et surtout contraintes CHECK qui figeaient le nom comme
    // VALEUR metier obligatoire. Le code applicatif, lui, ecrivait deja la
    // valeur reecrite : chaque insertion etait rejetee par la base. Les regles
    // existantes ne visaient que « sclepios.ai » et « com.sclepios.* », donc
    // jamais le mot nu.
    re: /\bscl[eé]pios\b/gi,
  },

  {
    id: 'marque-proscrite',
    severite: 'blocker',
    surChemin: true,
    libelle: 'marque proscrite dans la distribution',
    re: /\bpulsar\b/gi,
    ignorerSi: /pulsar[-_]?(?:core|js|db)\b/i,
  },

  // --- infrastructure privee ---
  {
    id: 'infra-privee-editeur',
    severite: 'high',
    libelle: 'reference a l\'infrastructure privee de l\'editeur',
    // cloudapp.azure.com etait le trou de la premiere version de cette regle :
    // le FQDN de repli que sept fichiers portaient en dur passait au travers,
    // alors que azurecontainerapps.io etait bien couvert.
    re: /\b(?:[a-z0-9-]+\.(?:francecentral|westeurope|northeurope)\.(?:azurecontainerapps\.io|cloudapp\.azure\.com)|[a-z0-9-]*b7afde[a-z0-9.-]*|gsipointb7afde[a-z0-9.]*|kvgsi[a-z0-9-]+|iqhvfmnrypiblqncjnpm|vm-gsi-[a-z0-9-]+|[a-z0-9-]+\.blob\.core\.windows\.net|[a-z0-9-]*\.azurecr\.io)\b/gi,
  },
  {
    id: 'ip-publique-litterale',
    severite: 'high',
    libelle: 'adresse IP publique en dur',
    // Les plages sont nommees une par une, et non generiques, pour deux raisons :
    // les plages de documentation (RFC 5737) et les fixtures doivent rester hors
    // champ, et les coordonnees de chemins dans les fichiers SVG ressemblent a
    // des IP (4.94.37.81, 1.98.43.43) — aucune ne tombe dans les plages listees.
    re: /\b(?:40\.89\.137\.\d{1,3}|185\.158\.133\.\d{1,3}|20\.111\.\d{1,3}\.\d{1,3}|51\.103\.\d{1,3}\.\d{1,3}|37\.187\.\d{1,3}\.\d{1,3}|90\.110\.\d{1,3}\.\d{1,3})\b/g,
  },
  {
    id: 'second-domaine-editeur',
    severite: 'high',
    libelle: 'second domaine de l\'editeur, invisible a une recherche sur le premier',
    re: /\bsclepios\.ai\b/gi,
  },
  {
    id: 'identifiant-paquet-natif',
    severite: 'medium',
    libelle: 'identifiant de paquet natif portant la marque (exige un deplacement de repertoires)',
    re: /\bcom[./]sclepios[./][a-z0-9_]+/gi,
  },

  // --- defauts non securises ---
  {
    id: 'rls-desactivee',
    severite: 'high',
    libelle: 'desactivation de la securite au niveau ligne',
    re: /ALTER\s+TABLE\s+[^\n;]+DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
  },
  {
    id: 'policy-permissive',
    severite: 'high',
    libelle: 'policy permissive sans restriction de role',
    // « USING (true) » ne dit rien a lui seul : tout depend de A QUI la policy
    // s'applique. Mesure sur le schema reel : 36 sont restreintes a
    // authenticated — un partage interne assume dans une application dont tous
    // les utilisateurs appartiennent a la meme organisation — et 11 a
    // service_role, qui contourne deja la securite au niveau ligne par
    // construction. Une seule n'avait aucune restriction de role, et permettait
    // a un visiteur non authentifie de supprimer les donnees d'autrui.
    //
    // La regle ne signale donc que ce dernier cas, le seul qui soit un defaut
    // en soi. Elle est en severite haute, car c'en est un vrai.
    re: /CREATE\s+POLICY[^;]{0,400}?USING\s*\(\s*true\s*\)/gis,
    ignorerSi: /\bTO\s+(?:authenticated|service_role|supabase_admin|postgres)\b/i,
  },
  {
    id: 'cors-etoile',
    severite: 'medium',
    libelle: 'CORS ouvert a toutes les origines',
    re: /['"`]Access-Control-Allow-Origin['"`]\s*:\s*['"`]\*['"`]/g,
    // Un test qui verifie l'ABSENCE du motif doit forcement l'ecrire, et un
    // contre-exemple documentaire aussi. Les signaler reviendrait a punir
    // precisement le code qui protege de ce defaut.
    ignorerSi: /(?:,\s*false\s*\)|assertNotEquals|not\.toContain|toBeUndefined|a proscrire|contre-exemple|ne pas faire)/i,
  },
]

const ORDRE_SEVERITE = { blocker: 3, high: 2, medium: 1 }

// --- arbre -----------------------------------------------------------------

const IGNORE = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.turbo',
  'playwright-report', 'test-results', '.vite', '.venv', '__pycache__', '.openrelease-report'])

function fichiersAnalysables(racine) {
  const out = []
  const pile = ['']
  while (pile.length) {
    const rel = pile.pop()
    const abs = rel ? join(racine, rel) : racine
    for (const nom of readdirSync(abs)) {
      if (IGNORE.has(nom)) continue
      const relEnfant = rel ? `${rel}/${nom}` : nom
      const st = statSync(join(abs, nom))
      if (st.isDirectory()) { pile.push(relEnfant); continue }
      if (!st.isFile()) continue
      if (!estTexte(nom, join(abs, nom))) continue
      out.push(relEnfant)
    }
  }
  return out.sort()
}

// --- analyse ---------------------------------------------------------------

function lireAllowlist(racine) {
  const p = join(ICI, 'scan-allowlist.json')
  if (!existsSync(p)) return []
  const brut = JSON.parse(readFileSync(p, 'utf8'))
  return (brut.exceptions ?? []).map((e) => ({
    ...e,
    reChemin: new RegExp(e.chemin),
    reExtrait: e.extrait ? new RegExp(e.extrait) : null,
  }))
}

/**
 * Fichiers que git ignore dans la cible.
 *
 * Ils ne seront jamais publies : les analyser reviendrait a bloquer la
 * publication a cause de fichiers locaux — secrets d'une instance de test,
 * configuration generee a l'installation — qui ne quitteront jamais la machine.
 * En revanche, un fichier SUIVI par git est toujours analyse, meme s'il
 * ressemble a un fichier local.
 */
function fichiersIgnoresParGit(racine, fichiers) {
  const ignores = new Set()
  if (!existsSync(join(racine, '.git')) && !existsSync(join(racine, '..', '.git'))) return ignores
  const lot = 400
  for (let i = 0; i < fichiers.length; i += lot) {
    const tranche = fichiers.slice(i, i + lot)
    try {
      const sortie = execFileSync('git', ['check-ignore', '--stdin'], {
        cwd: racine,
        input: tranche.join('\n'),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      })
      for (const l of sortie.split('\n')) if (l.trim()) ignores.add(l.trim())
    } catch (e) {
      // check-ignore sort en 1 quand aucun chemin n'est ignore : ce n'est pas
      // une erreur. Toute autre defaillance laisse la tranche analysee.
      const sortie = e?.stdout
      if (typeof sortie === 'string') {
        for (const l of sortie.split('\n')) if (l.trim()) ignores.add(l.trim())
      }
    }
  }
  return ignores
}

function analyser(racine, seuil) {
  const allowlist = lireAllowlist(racine)
  const tous = fichiersAnalysables(racine)
  const ignores = fichiersIgnoresParGit(racine, tous)
  const fichiers = tous.filter((f) => !ignores.has(f))
  const constats = []

  // Le NOM du fichier est lui aussi publie. Dix-neuf fichiers portaient la
  // marque dans leur chemin -- des logos, un tutoriel, trois fichiers de test --
  // sans qu'aucun constat ne soit leve : la boucle ci-dessous ne lit que des
  // contenus, et saute les binaires, donc leur nom n'etait jamais regarde.
  const fichiersSuivis = (() => {
    try {
      return execFileSync('git', ['ls-files'], { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        .split('\n').filter(Boolean)
    } catch { return fichiers }
  })()

  for (const rel of fichiersSuivis) {
    // git ls-files liste encore ce qui a ete retire du disque mais pas commite.
    // Signaler ces chemins ferait crier la barriere sur un etat intermediaire.
    if (!existsSync(join(racine, rel))) continue
    for (const regle of REGLES) {
      if (!regle.surChemin) continue
      if (ORDRE_SEVERITE[regle.severite] < ORDRE_SEVERITE[seuil]) continue
      regle.re.lastIndex = 0
      const m = regle.re.exec(rel)
      if (!m || m[0].length === 0) continue
      const exception = allowlist.find(
        (e) => e.regle === regle.id && e.reChemin.test(rel) && (!e.reExtrait || e.reExtrait.test(m[0]))
      )
      constats.push({
        regle: regle.id,
        severite: regle.severite,
        libelle: `${regle.libelle} (dans le NOM du fichier)`,
        chemin: rel,
        ligne: 0,
        extrait: m[0].slice(0, 120),
        tolere: Boolean(exception),
      })
    }
  }

  for (const rel of fichiers) {
    let contenu
    try { contenu = readFileSync(join(racine, rel), 'utf8') } catch { continue }
    if (contenu.includes('\u0000')) continue // binaire deguise en extension texte

    const lignes = contenu.split('\n')
    for (const regle of REGLES) {
      if (ORDRE_SEVERITE[regle.severite] < ORDRE_SEVERITE[seuil]) continue
      regle.re.lastIndex = 0
      let m
      const vus = new Set()
      while ((m = regle.re.exec(contenu)) !== null) {
        if (m[0].length === 0) { regle.re.lastIndex++; continue }
        const extrait = m[0].slice(0, 120)
        const ligne = contenu.slice(0, m.index).split('\n').length
        const texteLigne = lignes[ligne - 1] ?? ''

        if (regle.ignorerSi && (regle.ignorerSi.test(texteLigne) || regle.ignorerSi.test(extrait))) continue

        // Les constats toleres sont conserves dans le rapport : une exception
        // qui ne sert plus doit pouvoir etre reperee et retiree.
        const exception = allowlist.find(
          (e) => e.regle === regle.id && e.reChemin.test(rel) && (!e.reExtrait || e.reExtrait.test(extrait))
        )

        const cle = `${regle.id}|${extrait}`
        if (vus.has(cle)) continue
        vus.add(cle)

        constats.push({
          regle: regle.id,
          severite: regle.severite,
          libelle: regle.libelle,
          chemin: rel,
          ligne,
          extrait,
          tolere: Boolean(exception),
        })
      }
    }
  }
  return { fichiers_analyses: fichiers.length, fichiers_ignores_par_git: ignores.size, constats }
}

// --- programme -------------------------------------------------------------

function principal() {
  const argv = process.argv.slice(2)
  const lire = (cle, defaut) => {
    const i = argv.indexOf(cle)
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : defaut
  }
  const racine = resolve(lire('--cible', RACINE_DEFAUT))
  const seuil = lire('--severite', 'medium')
  const cheminRapport = lire('--rapport', null)
  const enJson = argv.includes('--json')
  const tout = argv.includes('--tout')

  if (!ORDRE_SEVERITE[seuil]) throw new Error(`severite inconnue : ${seuil}`)
  if (!existsSync(racine)) throw new Error(`cible introuvable : ${racine}`)

  const r = analyser(racine, seuil)
  const actifs = r.constats.filter((c) => !c.tolere)
  const bloquants = actifs.filter((c) => c.severite === 'blocker')
  const eleves = actifs.filter((c) => c.severite === 'high')

  const rapport = {
    genere_par: 'tools/openrelease/scan.mjs',
    cible: racine,
    seuil,
    fichiers_analyses: r.fichiers_analyses,
    fichiers_ignores_par_git: r.fichiers_ignores_par_git,
    totaux: {
      constats: actifs.length,
      bloquants: bloquants.length,
      eleves: eleves.length,
      moyens: actifs.length - bloquants.length - eleves.length,
      toleres: r.constats.length - actifs.length,
    },
    par_regle: Object.fromEntries(
      [...new Set(actifs.map((c) => c.regle))].map((id) => [id, actifs.filter((c) => c.regle === id).length])
    ),
    constats: r.constats,
  }

  if (cheminRapport) {
    mkdirSync(dirname(resolve(cheminRapport)), { recursive: true })
    writeFileSync(resolve(cheminRapport), JSON.stringify(rapport, null, 2))
  }

  if (enJson) {
    console.log(JSON.stringify(rapport, null, 2))
  } else {
    console.log(`cible            : ${relative(process.cwd(), racine) || '.'}`)
    console.log(`fichiers analyses: ${r.fichiers_analyses} (${r.fichiers_ignores_par_git} ignores par git)`)
    console.log(`constats         : ${actifs.length} (bloquants ${bloquants.length}, eleves ${eleves.length}, moyens ${rapport.totaux.moyens}, toleres ${rapport.totaux.toleres})`)
    const parRegle = Object.entries(rapport.par_regle).sort((a, b) => b[1] - a[1])
    for (const [id, n] of parRegle) {
      const regle = REGLES.find((x) => x.id === id)
      console.log(`\n  [${regle.severite}] ${id} — ${regle.libelle} : ${n}`)
      for (const c of actifs.filter((x) => x.regle === id).slice(0, 8)) {
        console.log(`      ${c.chemin}:${c.ligne}  ${c.extrait.replace(/\s+/g, ' ').slice(0, 90)}`)
      }
      if (n > 8) console.log(`      … et ${n - 8} autres`)
    }
    if (tout && rapport.totaux.toleres > 0) {
      console.log(`\n  toleres par l'allowlist (${rapport.totaux.toleres}) :`)
      for (const c of r.constats.filter((x) => x.tolere)) {
        console.log(`      ${c.regle.padEnd(28)} ${c.chemin}:${c.ligne}`)
      }
    }
    if (cheminRapport) console.log(`\nrapport : ${resolve(cheminRapport)}`)
  }

  // Bloquants et eleves interdisent la publication.
  process.exit(bloquants.length + eleves.length > 0 ? 1 : 0)
}

try {
  principal()
} catch (e) {
  console.error(`scan: ${e.message}`)
  process.exit(2)
}
