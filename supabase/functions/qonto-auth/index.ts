import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { code, state } = await req.json()

    // Vérifier que l'utilisateur est admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Non authentifié')
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Utilisateur non authentifié')
    }

    // Vérifier le rôle admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roles?.role !== 'admin') {
      throw new Error('Accès non autorisé - Admin uniquement')
    }

    // Échanger le code d'autorisation contre un access token
    const qontoClientId = Deno.env.get('QONTO_CLIENT_ID')
    const qontoClientSecret = Deno.env.get('QONTO_CLIENT_SECRET')
    const qontoRedirectUri = Deno.env.get('QONTO_REDIRECT_URI')

    if (!qontoClientId || !qontoClientSecret || !qontoRedirectUri) {
      throw new Error('Configuration Qonto manquante')
    }

    const tokenResponse = await fetch('https://oauth.qonto.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: qontoClientId,
        client_secret: qontoClientSecret,
        redirect_uri: qontoRedirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Erreur OAuth Qonto:', error)
      throw new Error("Échec de l'authentification Qonto")
    }

    const tokenData = await tokenResponse.json()

    // Récupérer les informations de l'organisation
    const orgResponse = await fetch('https://thirdparty.qonto.com/v2/organization', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (!orgResponse.ok) {
      throw new Error('Échec de la récupération des infos organisation')
    }

    const orgData = await orgResponse.json()

    // Récupérer les comptes bancaires
    const accountsResponse = await fetch('https://thirdparty.qonto.com/v2/bank_accounts', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    let bankAccounts = []
    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json()
      bankAccounts = accountsData.bank_accounts || []
    }

    // Calculer la date d'expiration du token
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

    // Chiffrer les tokens avant stockage : AES-256-GCM obligatoire.
    const encryptionKey = Deno.env.get('QONTO_ENCRYPTION_KEY')
    if (!encryptionKey || encryptionKey.length < 16) {
      console.error('QONTO_ENCRYPTION_KEY manquante ou trop courte — refus de stocker des tokens')
      return new Response(
        JSON.stringify({ error: 'Configuration de chiffrement manquante côté serveur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fonction de chiffrement AES-256-GCM (clé obligatoire)
    async function encryptToken(token: string): Promise<string> {
      const encoder = new TextEncoder()
      const data = encoder.encode(token)
      const keyData = encoder.encode(encryptionKey!.padEnd(32, '0').slice(0, 32))
      const key = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
      // Format: iv (base64) + '.' + encrypted (base64)
      const ivB64 = btoa(String.fromCharCode(...iv))
      const encB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)))
      return `${ivB64}.${encB64}`
    }

    const accessTokenEncrypted = await encryptToken(tokenData.access_token)
    const refreshTokenEncrypted = await encryptToken(tokenData.refresh_token)

    // Stocker la connexion dans la base de données
    const { data: connection, error: dbError } = await supabaseClient
      .from('tresorerie_qonto_connections')
      .upsert(
        {
          organization_id: orgData.organization.slug,
          organization_slug: orgData.organization.slug,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: expiresAt.toISOString(),
          is_active: true,
          bank_accounts: bankAccounts,
          last_error: null,
        },
        {
          onConflict: 'organization_id',
        }
      )
      .select()
      .single()

    if (dbError) {
      console.error('Erreur DB:', dbError)
      throw new Error("Échec de l'enregistrement de la connexion")
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection,
        message: 'Connexion Qonto établie avec succès',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return buildErrorResponse('qonto-auth', error, corsHeaders, 400)
  }
}

Deno.serve(handler)
