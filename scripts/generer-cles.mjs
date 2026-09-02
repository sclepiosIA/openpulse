#!/usr/bin/env node
/**
 * Génère les deux jetons d'API d'une instance à partir de son secret de
 * signature : la clé publique (rôle anon) et la clé de service (rôle
 * service_role).
 *
 * Ces jetons sont signés par le secret de l'instance : ils ne peuvent donc pas
 * être copiés d'une instance à une autre, et un secret régénéré les invalide
 * tous les deux. C'est voulu.
 *
 * La clé de service contourne la sécurité au niveau ligne. Elle ne doit jamais
 * être exposée à un navigateur, ni figurer dans une variable préfixée VITE_.
 *
 * Sortie : deux lignes, la clé anon puis la clé de service.
 *
 * Usage : node scripts/generer-cles.mjs <secret-de-signature> [annees-validite]
 */

import { createHmac } from 'node:crypto'

const base64url = (entree) =>
  Buffer.from(entree).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function signer(charge, secret) {
  const entete = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const corps = base64url(JSON.stringify(charge))
  const signature = createHmac('sha256', secret)
    .update(`${entete}.${corps}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${entete}.${corps}.${signature}`
}

function principal() {
  const secret = process.argv[2]
  const annees = Number(process.argv[3] ?? 10)

  if (!secret || secret.length < 32) {
    console.error(
      'Un secret de signature d’au moins 32 caractères est requis.\n' +
        'Générez-en un avec : openssl rand -hex 32'
    )
    process.exit(1)
  }
  if (!Number.isFinite(annees) || annees <= 0 || annees > 50) {
    console.error('La durée de validité doit être un nombre d’années entre 1 et 50.')
    process.exit(1)
  }

  // Pas d'horloge figée : la validité part de l'instant de génération.
  const maintenant = Math.floor(Date.now() / 1000)
  const expiration = maintenant + Math.round(annees * 365.25 * 24 * 3600)

  for (const role of ['anon', 'service_role']) {
    console.log(signer({ iss: 'openpulse', role, iat: maintenant, exp: expiration }, secret))
  }
}

principal()
