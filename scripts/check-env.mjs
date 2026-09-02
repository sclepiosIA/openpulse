#!/usr/bin/env node
/**
 * scripts/check-env.mjs — verification de la configuration OpenPulse.
 *
 * A executer avant tout demarrage et dans l'integration continue. Node 20,
 * aucune dependance. La liste des variables vient d'un seul endroit :
 * scripts/env-registry.mjs.
 *
 * Usage :
 *   node scripts/check-env.mjs                         profil minimal, .env
 *   node scripts/check-env.mjs --profil complet
 *   node scripts/check-env.mjs --fichier docker/.env --profil complet
 *   node scripts/check-env.mjs --portee build,plateforme
 *   node scripts/check-env.mjs --profil complet --strict
 *   node scripts/check-env.mjs --json
 *   node scripts/check-env.mjs --liste                 tableau du registre
 *
 * Codes de sortie :
 *   0  configuration acceptee
 *   1  au moins une variable requise manque ou est invalide
 *   2  erreur d'utilisation
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGISTRE, PROFILS, PORTEES, REMPLISSAGES_INTERDITS, CI_ET_TESTS, OBSOLETES } from './env-registry.mjs';

// --------------------------------------------------------------------------
// Arguments
// --------------------------------------------------------------------------
function lireArguments(argv) {
  const o = { profil: 'minimal', fichier: '.env', portees: PORTEES.slice(), strict: false, json: false, liste: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      if (v === undefined) throw new UsageError(`valeur manquante pour ${a.split('=')[0]}`);
      return v;
    };
    if (a === '--strict') o.strict = true;
    else if (a === '--json') o.json = true;
    else if (a === '--liste') o.liste = true;
    else if (a === '-h' || a === '--aide' || a === '--help') o.aide = true;
    else if (a.startsWith('--profil')) o.profil = val().trim();
    else if (a.startsWith('--fichier')) o.fichier = val().trim();
    else if (a.startsWith('--portee')) o.portees = val().split(',').map((s) => s.trim()).filter(Boolean);
    else throw new UsageError(`argument inconnu : ${a}`);
  }
  if (!PROFILS.includes(o.profil)) throw new UsageError(`profil inconnu : ${o.profil} (attendu : ${PROFILS.join(' ou ')})`);
  const mauvaise = o.portees.find((p) => !PORTEES.includes(p));
  if (mauvaise) throw new UsageError(`portee inconnue : ${mauvaise} (attendu : ${PORTEES.join(', ')})`);
  return o;
}

class UsageError extends Error {}

const AIDE = `Verification de la configuration OpenPulse.

  --profil <minimal|complet>  minimal : le strict necessaire pour demarrer.
                              complet : tout ce qui evite une degradation
                              silencieuse et tout ce qu'exigent les drapeaux
                              actives dans l'environnement. Defaut : minimal.
  --fichier <chemin>          fichier d'environnement a lire. Defaut : .env.
                              Les variables deja presentes dans le processus
                              ont priorite sur le fichier.
  --portee <liste>            restreint la verification a build, plateforme,
                              bord ou service (separes par des virgules).
  --strict                    traite les avertissements comme des erreurs.
  --json                      sortie lisible par une machine.
  --liste                     affiche le registre et sort.
`;

// --------------------------------------------------------------------------
// Lecture du fichier d'environnement
// --------------------------------------------------------------------------
function lireFichierEnv(chemin) {
  const p = resolve(process.cwd(), chemin);
  if (!existsSync(p)) return { present: false, chemin: p, valeurs: {} };
  const valeurs = {};
  const lignes = readFileSync(p, 'utf8').split(/\r?\n/);
  for (const ligne of lignes) {
    const t = ligne.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(t);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
        (v.startsWith("'") && v.endsWith("'") && v.length > 1)) {
      v = v.slice(1, -1);
    }
    valeurs[m[1]] = v;
  }
  return { present: true, chemin: p, valeurs };
}

// --------------------------------------------------------------------------
// Validation d'une valeur
// --------------------------------------------------------------------------
function valider(entree, brut) {
  const v = String(brut).trim();
  const r = entree.valide;
  const interdit = REMPLISSAGES_INTERDITS.find((x) => v.toLowerCase() === x.toLowerCase());
  if (interdit) return `valeur de remplissage non remplacee (${interdit})`;
  if (!r) return null;
  switch (r.type) {
    case 'url':
      try {
        const u = new URL(v);
        if (!['http:', 'https:'].includes(u.protocol)) return 'doit etre une URL http ou https';
      } catch { return `n'est pas une URL absolue valide : ${apercu(v)}`; }
      return null;
    case 'urlpg':
      if (!/^postgres(ql)?:\/\/[^\s]+$/.test(v)) return 'doit etre une URL postgresql://...';
      if (/:(MOT_DE_PASSE|password|CHANGE_ME)@/i.test(v)) return 'contient encore le mot de passe modele';
      return null;
    case 'mailto':
      if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return 'doit avoir la forme mailto:adresse@domaine';
      return null;
    case 'origines': {
      const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
      if (!parts.length) return 'liste vide';
      for (const p of parts) {
        const noyau = p.replace(/\/\*\*$/, '');
        try { new URL(noyau); } catch { return `origine invalide : ${apercu(p)}`; }
      }
      return null;
    }
    case 'jwt':
      if (v.split('.').length !== 3) return 'doit etre un jeton a trois segments separes par des points';
      return null;
    case 'sha40':
      if (!/^[0-9a-f]{40}$/i.test(v)) return 'doit etre un SHA Git complet de 40 caracteres hexadecimaux';
      if (/^0+$/.test(v)) return 'ne peut pas etre un SHA nul';
      return null;
    case 'secret':
      if (v.length < (r.min ?? 32)) return `doit faire au moins ${r.min ?? 32} caracteres (actuel : ${v.length})`;
      return null;
    case 'booleen':
      if (!['true', 'false'].includes(v.toLowerCase())) return 'doit valoir true ou false';
      return null;
    case 'interrupteur':
      if (!['on', 'off', 'true', 'false', '0', '1'].includes(v.toLowerCase())) return 'doit valoir on ou off';
      return null;
    case 'entier': {
      if (!/^-?\d+$/.test(v)) return 'doit etre un entier';
      const n = Number(v);
      if (r.min !== undefined && n < r.min) return `doit etre superieur ou egal a ${r.min}`;
      if (r.max !== undefined && n > r.max) return `doit etre inferieur ou egal a ${r.max}`;
      return null;
    }
    case 'enum':
      if (!r.valeurs.map((x) => x.toLowerCase()).includes(v.toLowerCase())) {
        return `doit valoir l'une des valeurs : ${r.valeurs.join(', ')}`;
      }
      return null;
    default:
      return null;
  }
}

/** N'expose jamais plus que le strict necessaire d'une valeur suspecte. */
function apercu(v) {
  const s = String(v);
  return s.length <= 12 ? s : `${s.slice(0, 8)}...(${s.length} caracteres)`;
}

// --------------------------------------------------------------------------
// Coherences croisees : les pieges a deux variables
// --------------------------------------------------------------------------
function coherences(env) {
  const out = [];
  const r = (k) => String(env[k] ?? '').trim();
  const ajoute = (gravite, message) => out.push({ gravite, message });

  if (r('VITE_SUPABASE_PUBLISHABLE_KEY') && r('ANON_KEY') &&
      r('VITE_SUPABASE_PUBLISHABLE_KEY') !== r('ANON_KEY')) {
    ajoute('erreur',
      "VITE_SUPABASE_PUBLISHABLE_KEY et ANON_KEY diffèrent. Le navigateur presentera un jeton que la passerelle ne reconnait pas : la connexion echouera pour tous les comptes.");
  }
  if (r('VITE_SUPABASE_ANON_KEY') && !r('VITE_SUPABASE_PUBLISHABLE_KEY')) {
    ajoute('erreur',
      "VITE_SUPABASE_ANON_KEY est definie mais aucun code ne la lit : le nom attendu est VITE_SUPABASE_PUBLISHABLE_KEY. C'est exactement la confusion qui produisait un ecran blanc en production.");
  }
  if (r('VITE_MATOMO_SITE_ID') && !r('VITE_MATOMO_TRACKER_URL')) {
    ajoute('erreur',
      "VITE_MATOMO_SITE_ID active le traceur d'audience, mais VITE_MATOMO_TRACKER_URL est vide : le traceur tournera avec une URL vide, sans collecter ni signaler quoi que ce soit. Renseignez les deux, ou aucune.");
  }
  if (r('VITE_PLAUSIBLE_DOMAIN') && !r('VITE_PLAUSIBLE_API_HOST')) {
    ajoute('avertissement',
      "VITE_PLAUSIBLE_DOMAIN est defini sans VITE_PLAUSIBLE_API_HOST : la mesure d'audience sortira vers l'hote public par defaut de la bibliotheque, donc hors de votre infrastructure.");
  }
  for (const [prefixe, libelle] of [['DRIVE', 'Drive'], ['EMAIL', 'Courriel'], ['MEETINGS', 'Reunions'], ['PULSE', 'Discussion']]) {
    const envSrv = r(`${prefixe}_ENV`).toLowerCase();
    const mode = r(`${prefixe}_AUTH_MODE`).toLowerCase();
    if (envSrv && !['prod', 'production'].includes(envSrv)) {
      ajoute('erreur',
        `${prefixe}_ENV vaut "${envSrv}" : la validation de configuration du service ${libelle} ne s'executera pas. Le service demarrera avec l'authentification desactivee et un depot en memoire, sans avertissement. Mettez "prod" sur une instance reelle.`);
    }
    if (mode === 'disabled') {
      ajoute('erreur', `${prefixe}_AUTH_MODE=disabled ouvre l'API ${libelle} a tout appelant. Utilisez jwt.`);
    }
  }
  if (!String(env.DATABASE_URL ?? '').trim()) {
    ajoute('erreur',
      "DATABASE_URL est vide : les quatre services HTTP demarreront avec un depot EN MEMOIRE. Aucune erreur ne sera levee et toutes les donnees seront perdues au redemarrage.");
  }
  if (String(env.VERIFY_JWT ?? '').trim().toLowerCase() === 'false') {
    ajoute('avertissement',
      "VERIFY_JWT=false : la passerelle des fonctions n'exigera aucun jeton. Chaque fonction devra se defendre seule. Passez a true, apres avoir verifie que CRON_SECRET et INTERNAL_FUNCTION_SECRET sont renseignes pour les declencheurs planifies.");
  }
  if (!String(env.AZURE_STORAGE_CONNECTION_STRING ?? '').trim() &&
      !(String(env.AZURE_STORAGE_ACCOUNT ?? '').trim() && String(env.AZURE_STORAGE_ACCOUNT_KEY ?? '').trim())) {
    ajoute('avertissement',
      "Aucun stockage objet n'est configure pour les services Drive et Reunions : ils produiront des URL signees factices. Les envois de fichiers sembleront reussir sans qu'aucun octet ne soit ecrit.");
  }
  for (const nom of OBSOLETES) {
    if (String(env[nom] ?? '').trim()) {
      ajoute('avertissement',
        `${nom} est definie mais n'est lue par aucun code livre : la regler n'a aucun effet. A retirer pour eviter de croire qu'un comportement est configurable alors qu'il est code en dur.`);
    }
  }
  const ci = CI_ET_TESTS.filter((n) => String(env[n] ?? '').trim() && n !== 'CI');
  if (ci.length) {
    ajoute('avertissement',
      `Variables reservees aux tests presentes dans la configuration : ${ci.join(', ')}. Elles n'ont aucun effet sur une instance en service.`);
  }
  return out;
}

// --------------------------------------------------------------------------
// Evaluation
// --------------------------------------------------------------------------
function evaluer(env, options) {
  const manquantes = [];
  const invalides = [];
  const parDefaut = [];

  for (const entree of REGISTRE) {
    if (!options.portees.includes(entree.portee)) continue;
    const brut = env[entree.nom];
    const presente = String(brut ?? '').trim() !== '';

    let exigee = entree.profils.includes(options.profil);
    if (!exigee && options.profil === 'complet' && typeof entree.requisSi === 'function') {
      try { exigee = Boolean(entree.requisSi(env)); } catch { exigee = false; }
    }
    if (options.profil === 'complet' && !exigee && entree.absence === 'silence' && entree.niveau === 'requis') {
      exigee = true;
    }

    if (!presente) {
      if (exigee) manquantes.push(entree);
      else if (entree.absence === 'silence') parDefaut.push(entree);
      continue;
    }
    const probleme = valider(entree, brut);
    if (probleme) invalides.push({ entree, probleme });
  }
  return { manquantes, invalides, parDefaut, croisees: coherences(env) };
}

// --------------------------------------------------------------------------
// Rapport
// --------------------------------------------------------------------------
function bloc(titre) { return `\n${titre}\n${'-'.repeat(titre.length)}`; }

function rapporter(res, options, fichier) {
  const erreursCroisees = res.croisees.filter((c) => c.gravite === 'erreur');
  const avertsCroises = res.croisees.filter((c) => c.gravite === 'avertissement');
  const lignes = [];

  lignes.push(`OpenPulse — verification de la configuration`);
  lignes.push(`profil : ${options.profil}   portees : ${options.portees.join(', ')}`);
  lignes.push(fichier.present
    ? `fichier : ${fichier.chemin}`
    : `fichier : ${fichier.chemin} (absent — seules les variables du processus sont prises en compte)`);

  if (res.manquantes.length) {
    lignes.push(bloc(`${res.manquantes.length} variable(s) requise(s) manquante(s)`));
    for (const e of res.manquantes) {
      lignes.push(`  ${e.nom}  [${e.portee}]`);
      lignes.push(`      debloque : ${e.debloque}.`);
      lignes.push(`      absente  : ${{ demarrage: "l'instance ne demarre pas ou est inutilisable", fonctionnalite: 'une fonctionnalite est indisponible', silence: 'DEGRADATION SILENCIEUSE — rien n echoue, le comportement est faux' }[e.absence]}.`);
      if (e.defaut) lignes.push(`      suggere  : ${e.nom}=${e.defaut}`);
      lignes.push(`      lue dans : ${e.lu.join(', ')}`);
    }
  }
  if (res.invalides.length) {
    lignes.push(bloc(`${res.invalides.length} variable(s) invalide(s)`));
    for (const { entree, probleme } of res.invalides) {
      lignes.push(`  ${entree.nom}  ${probleme}`);
      lignes.push(`      debloque : ${entree.debloque}.`);
      lignes.push(`      lue dans : ${entree.lu.join(', ')}`);
    }
  }
  if (erreursCroisees.length) {
    lignes.push(bloc(`${erreursCroisees.length} incoherence(s) bloquante(s)`));
    for (const c of erreursCroisees) lignes.push(`  ${c.message}`);
  }
  if (res.parDefaut.length) {
    lignes.push(bloc(`${res.parDefaut.length} variable(s) absente(s) a effet silencieux`));
    lignes.push('  Rien ne cassera. Un comportement sera simplement faux ou muet.');
    for (const e of res.parDefaut) lignes.push(`  ${e.nom} — ${e.debloque}.`);
  }
  if (avertsCroises.length) {
    lignes.push(bloc(`${avertsCroises.length} avertissement(s)`));
    for (const c of avertsCroises) lignes.push(`  ${c.message}`);
  }

  const bloquant = res.manquantes.length + res.invalides.length + erreursCroisees.length;
  const avertissements = res.parDefaut.length + avertsCroises.length;
  lignes.push('');
  if (bloquant) {
    lignes.push(`ECHEC : ${bloquant} probleme(s) bloquant(s). Corrigez le fichier d'environnement puis relancez.`);
    if (options.profil === 'minimal') {
      lignes.push("Une fois le profil minimal accepte, relancez avec --profil complet : c'est la passe qui detecte les degradations silencieuses.");
    }
  } else if (avertissements && options.strict) {
    lignes.push(`ECHEC (--strict) : ${avertissements} avertissement(s) traite(s) comme bloquant(s).`);
  } else if (avertissements) {
    lignes.push(`ACCEPTEE avec ${avertissements} avertissement(s).`);
  } else {
    lignes.push('ACCEPTEE : aucune anomalie.');
  }
  return { texte: lignes.join('\n'), bloquant, avertissements };
}

function listerRegistre() {
  const l = ['nom\tportee\tniveau\tprofils\tabsence\tlu'];
  for (const e of REGISTRE) {
    l.push([e.nom, e.portee, e.niveau, e.profils.join('+') || '-', e.absence, e.lu[0]].join('\t'));
  }
  l.push('');
  l.push(`total : ${REGISTRE.length} variables`);
  for (const p of PROFILS) {
    l.push(`profil ${p} : ${REGISTRE.filter((e) => e.profils.includes(p)).length} variables exigees inconditionnellement`);
  }
  l.push(`a effet silencieux : ${REGISTRE.filter((e) => e.absence === 'silence').length} variables`);
  return l.join('\n');
}

// --------------------------------------------------------------------------
// Point d'entree
// --------------------------------------------------------------------------
function principal(argv) {
  let options;
  try {
    options = lireArguments(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n\n${AIDE}`);
      return 2;
    }
    throw err;
  }
  if (options.aide) { process.stdout.write(AIDE); return 0; }
  if (options.liste) { process.stdout.write(`${listerRegistre()}\n`); return 0; }

  const fichier = lireFichierEnv(options.fichier);
  const env = { ...fichier.valeurs, ...process.env };
  const res = evaluer(env, options);
  const rapport = rapporter(res, options, fichier);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      profil: options.profil,
      portees: options.portees,
      fichier: fichier.chemin,
      fichierPresent: fichier.present,
      manquantes: res.manquantes.map((e) => ({ nom: e.nom, portee: e.portee, absence: e.absence, debloque: e.debloque, lu: e.lu })),
      invalides: res.invalides.map((x) => ({ nom: x.entree.nom, probleme: x.probleme })),
      silencieuses: res.parDefaut.map((e) => e.nom),
      incoherences: res.croisees,
      bloquant: rapport.bloquant,
      avertissements: rapport.avertissements,
    }, null, 2)}\n`);
  } else {
    process.stdout.write(`${rapport.texte}\n`);
  }

  if (rapport.bloquant) return 1;
  if (options.strict && rapport.avertissements) return 1;
  return 0;
}

process.exit(principal(process.argv.slice(2)));
