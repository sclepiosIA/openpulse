import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

// Simple IMAP client for validation
class SimpleIMAPClient {
  private host: string
  private port: number
  private conn: Deno.TlsConn | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private commandCounter = 0
  private buffer = ''
  private decoder = new TextDecoder()
  private encoder = new TextEncoder()

  constructor(host: string, port: number) {
    this.host = host
    this.port = port
  }

  async connect(): Promise<string> {
    this.conn = await Deno.connectTls({
      hostname: this.host,
      port: this.port,
    })
    this.reader = this.conn.readable.getReader()
    return await this.readResponse()
  }

  async login(username: string, password: string): Promise<string> {
    return await this.sendCommand(`LOGIN "${username}" "${password}"`)
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand('LOGOUT')
    } catch {
      // Ignore logout errors
    }
  }

  async close(): Promise<void> {
    try {
      this.reader?.releaseLock()
      this.conn?.close()
    } catch {
      // Ignore close errors
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) throw new Error('Not connected')
    const tag = `A${String(this.commandCounter++).padStart(4, '0')}`
    const fullCommand = `${tag} ${command}\r\n`
    await this.conn.write(this.encoder.encode(fullCommand))
    return await this.waitForTaggedResponse(tag)
  }

  private async readResponse(): Promise<string> {
    if (!this.reader) throw new Error('No reader')
    const result = await this.reader.read()
    if (result.done) throw new Error('Connection closed')
    return this.decoder.decode(result.value)
  }

  private async waitForTaggedResponse(tag: string): Promise<string> {
    let fullResponse = ''
    const maxIterations = 50
    let iterations = 0

    while (iterations++ < maxIterations) {
      const chunk = await this.readResponse()
      this.buffer += chunk
      fullResponse += chunk

      const lines = this.buffer.split('\r\n')
      for (const line of lines) {
        if (line.startsWith(tag)) {
          this.buffer = ''
          if (line.includes('OK')) return fullResponse
          throw new Error(`IMAP command failed: ${line}`)
        }
      }
    }
    throw new Error('IMAP response timeout')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Resolve caller identity from the JWT before touching credentials.
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const callerUserId = userData.user.id

    // Get encryption key
    const encryptionKey = Deno.env.get('EMAIL_ENCRYPTION_KEY')
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'EMAIL_ENCRYPTION_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { account_id, new_password } = await req.json()

    if (!account_id || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: 'account_id et new_password requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch account details + verify ownership (or shared account status).
    // Prevents any authenticated user from overwriting another user's mailbox credentials.
    const { data: account, error: accountError } = await supabase
      .from('user_email_accounts')
      .select('id, email_address, imap_host, imap_port, profile_id, is_shared')
      .eq('id', account_id)
      .maybeSingle()

    if (accountError || !account) {
      return new Response(JSON.stringify({ success: false, error: 'Compte non trouvé' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isOwner = account.profile_id === callerUserId
    const isSharedAccount = account.is_shared === true
    if (!isOwner && !isSharedAccount) {
      console.warn(
        `[update-email-password] Forbidden: user ${callerUserId} attempted to update account ${account_id} owned by ${account.profile_id}`
      )
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Test IMAP connection with new password
    console.log(`Testing IMAP for ${account.email_address}...`)
    const client = new SimpleIMAPClient(account.imap_host, account.imap_port || 993)

    try {
      await client.connect()
      await client.login(account.email_address, new_password)
      await client.logout()
      await client.close()
    } catch (imapError: unknown) {
      const errorMessage = imapError instanceof Error ? imapError.message : String(imapError)
      console.error('IMAP login failed:', errorMessage)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Échec de connexion IMAP: ${errorMessage}`,
          hint: 'Vérifiez le mot de passe et réessayez',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // IMAP login successful - encrypt and store the new password
    console.log('IMAP login successful, encrypting password...')

    const { data: encryptedPassword, error: encryptError } = await supabase.rpc(
      'encrypt_email_password',
      {
        plain_password: new_password,
        encryption_key: encryptionKey,
      }
    )

    if (encryptError || !encryptedPassword) {
      console.error('Encryption failed:', encryptError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur de chiffrement du mot de passe' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the account with the new encrypted password
    const { error: updateError } = await supabase
      .from('user_email_accounts')
      .update({
        encrypted_password: encryptedPassword,
        last_sync_at: null, // Reset sync to force full resync
      })
      .eq('id', account_id)

    if (updateError) {
      console.error('Update failed:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur de mise à jour du compte' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Password updated successfully for ${account.email_address}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Mot de passe mis à jour pour ${account.email_address}`,
        email: account.email_address,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return buildErrorResponse('update-email-password', error, corsHeaders, 500)
  }
})
