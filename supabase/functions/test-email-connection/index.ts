import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const encoder = new TextEncoder()
const decoder = new TextDecoder()

type EmailAccountCredentials = {
  email_address: string
  password: string
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// Minimal IMAP Client for connection testing
class IMAPClient {
  private conn: Deno.TlsConn | null = null
  private tagCounter = 0
  private buffer = ''

  async connect(hostname: string, port: number): Promise<string> {
    const rawConn = await Deno.connect({ hostname, port, transport: 'tcp' })
    this.conn = await Deno.startTls(rawConn, { hostname })
    const greeting = await this.readResponse()
    return greeting
  }

  async login(username: string, password: string): Promise<string> {
    return await this.sendCommand(`LOGIN "${username}" "${password}"`)
  }

  async selectMailbox(mailbox: string): Promise<{ raw: string; exists: number; uidNext: number }> {
    const response = await this.sendCommand(`SELECT ${mailbox}`)
    const existsMatch = response.match(/\*\s+(\d+)\s+EXISTS/i)
    const uidNextMatch = response.match(/UIDNEXT (\d+)/i)
    return {
      raw: response,
      exists: existsMatch ? parseInt(existsMatch[1], 10) : 0,
      uidNext: uidNextMatch ? parseInt(uidNextMatch[1], 10) : 1,
    }
  }

  async listMailboxes(): Promise<string[]> {
    const response = await this.sendCommand('LIST "" "*"')
    const mailboxes: string[] = []
    const lines = response.split('\r\n')
    for (const line of lines) {
      const match = line.match(/\* LIST \([^)]*\) "[^"]+" "?([^"]+)"?/)
      if (match) {
        mailboxes.push(match[1])
      }
    }
    return mailboxes
  }

  async logout(): Promise<void> {
    try {
      await this.sendCommand('LOGOUT')
    } catch {
      // The socket may already have been closed by a failed IMAP operation.
    }
    try {
      this.conn?.close()
    } catch {
      // Closing an already-closed connection is safe to ignore.
    }
  }

  private async sendCommand(command: string): Promise<string> {
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`
    const fullCommand = `${tag} ${command}\r\n`

    await this.conn!.write(encoder.encode(fullCommand))
    return await this.readResponse(tag)
  }

  private async readResponse(expectedTag?: string): Promise<string> {
    let response = this.buffer
    this.buffer = ''
    const timeout = 10000 // 10s timeout
    const startTime = Date.now()

    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error('IMAP response timeout')
      }

      const buf = new Uint8Array(4096)
      const n = await this.conn!.read(buf)
      if (n === null) break

      response += decoder.decode(buf.subarray(0, n))

      if (expectedTag) {
        if (
          response.includes(`${expectedTag} OK`) ||
          response.includes(`${expectedTag} NO`) ||
          response.includes(`${expectedTag} BAD`)
        ) {
          break
        }
      } else {
        if (response.includes('* OK')) break
      }
    }

    // Check for failures
    if (expectedTag) {
      if (response.includes(`${expectedTag} NO`) || response.includes(`${expectedTag} BAD`)) {
        throw new Error(`IMAP command failed: ${response.substring(0, 200)}`)
      }
    }

    return response
  }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    steps: [],
  }
  let client: IMAPClient | undefined

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { account_id } = await req.json()
    if (!account_id) {
      return new Response(JSON.stringify({ success: false, error: 'account_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    diagnostics.account_id = account_id

    // Step 1: Fetch account details
    const step1Start = Date.now()
    const { data: account, error: accountError } = await supabase
      .from('user_email_accounts')
      .select(
        'id, email_address, imap_host, imap_port, is_active, sync_enabled, is_shared, last_sync_at'
      )
      .eq('id', account_id)
      .single()

    ;(diagnostics.steps as unknown[]).push({
      step: 1,
      name: 'Fetch account',
      duration_ms: Date.now() - step1Start,
      success: !accountError,
      error: accountError?.message,
    })

    if (accountError || !account) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Account not found',
          diagnostics,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    diagnostics.account = {
      email_address: account.email_address,
      imap_host: account.imap_host,
      imap_port: account.imap_port,
      is_active: account.is_active,
      sync_enabled: account.sync_enabled,
      is_shared: account.is_shared,
      last_sync_at: account.last_sync_at,
    }

    // Step 2: Get account with decrypted password
    const step2Start = Date.now()
    const encryptionKey = Deno.env.get('EMAIL_ENCRYPTION_KEY')

    if (!encryptionKey) {
      ;(diagnostics.steps as unknown[]).push({
        step: 2,
        name: 'Get encryption key',
        duration_ms: Date.now() - step2Start,
        success: false,
        error: 'EMAIL_ENCRYPTION_KEY not configured',
      })
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error: EMAIL_ENCRYPTION_KEY missing',
          diagnostics,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: accountWithPassword, error: passwordError } = await supabase
      .rpc('get_email_account_with_password', {
        account_uuid: account_id,
        encryption_key: encryptionKey,
      })
      .maybeSingle()
    const credentials = accountWithPassword as EmailAccountCredentials | null

    ;(diagnostics.steps as unknown[]).push({
      step: 2,
      name: 'Decrypt password',
      duration_ms: Date.now() - step2Start,
      success: !passwordError && !!credentials?.password,
      error: passwordError?.message,
      has_password: !!credentials?.password,
    })

    if (passwordError || !credentials?.password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to decrypt password - may need to re-enter credentials',
          diagnostics,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Test IMAP connection
    client = new IMAPClient()
    const step3Start = Date.now()

    try {
      const greeting = await client.connect(account.imap_host, account.imap_port)
      ;(diagnostics.steps as unknown[]).push({
        step: 3,
        name: 'IMAP connect',
        duration_ms: Date.now() - step3Start,
        success: true,
        greeting: greeting.substring(0, 100),
      })
    } catch (connError) {
      ;(diagnostics.steps as unknown[]).push({
        step: 3,
        name: 'IMAP connect',
        duration_ms: Date.now() - step3Start,
        success: false,
        error: errorMessage(connError),
      })
      return new Response(
        JSON.stringify({
          success: false,
          error: `IMAP connection failed: ${errorMessage(connError)}`,
          diagnostics,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: Test login
    const step4Start = Date.now()
    try {
      await client.login(credentials.email_address, credentials.password)
      ;(diagnostics.steps as unknown[]).push({
        step: 4,
        name: 'IMAP login',
        duration_ms: Date.now() - step4Start,
        success: true,
      })
    } catch (loginError) {
      ;(diagnostics.steps as unknown[]).push({
        step: 4,
        name: 'IMAP login',
        duration_ms: Date.now() - step4Start,
        success: false,
        error: errorMessage(loginError),
      })
      await client.logout()
      return new Response(
        JSON.stringify({
          success: false,
          error: `IMAP login failed - invalid credentials: ${errorMessage(loginError)}`,
          diagnostics,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 5: List mailboxes
    const step5Start = Date.now()
    let mailboxes: string[] = []
    try {
      mailboxes = await client.listMailboxes()
      ;(diagnostics.steps as unknown[]).push({
        step: 5,
        name: 'List mailboxes',
        duration_ms: Date.now() - step5Start,
        success: true,
        mailboxes_count: mailboxes.length,
        mailboxes: mailboxes.slice(0, 10),
      })
    } catch (listError) {
      ;(diagnostics.steps as unknown[]).push({
        step: 5,
        name: 'List mailboxes',
        duration_ms: Date.now() - step5Start,
        success: false,
        error: errorMessage(listError),
      })
    }

    // Step 6: Select INBOX and count messages
    const step6Start = Date.now()
    let inboxInfo = { exists: 0, uidNext: 0 }
    try {
      inboxInfo = await client.selectMailbox('INBOX')
      ;(diagnostics.steps as unknown[]).push({
        step: 6,
        name: 'Select INBOX',
        duration_ms: Date.now() - step6Start,
        success: true,
        messages_count: inboxInfo.exists,
        uid_next: inboxInfo.uidNext,
      })
    } catch (selectError) {
      ;(diagnostics.steps as unknown[]).push({
        step: 6,
        name: 'Select INBOX',
        duration_ms: Date.now() - step6Start,
        success: false,
        error: errorMessage(selectError),
      })
    }

    // Cleanup
    await client.logout()

    diagnostics.total_duration_ms = Date.now() - startTime
    diagnostics.success = true
    diagnostics.summary = {
      connection: 'OK',
      authentication: 'OK',
      inbox_messages: inboxInfo.exists,
      mailboxes_found: mailboxes.length,
      last_sync: account.last_sync_at || 'Never',
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Connection successful! Found ${inboxInfo.exists} messages in INBOX`,
        diagnostics,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return buildErrorResponse('test-email-connection', error, corsHeaders, 500)
  } finally {
    // A failed TLS handshake or IMAP command can otherwise leave a socket open.
    await client?.logout()
  }
}

if (import.meta.main) Deno.serve(handler)
