import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from '@supabase/supabase-js'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Edge Functions are short-lived, server-side requests. Avoid browser-oriented
// session persistence and refresh timers that can outlive the request lifecycle.
const edgeClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Simple SMTP client with robust timeout and error handling
class SMTPClient {
  private conn: Deno.TlsConn | null = null
  private readonly TIMEOUT_MS = 30000
  private readonly DATA_TIMEOUT_MS = 120000 // 120s for DATA response

  async connect(hostname: string, port: number) {
    try {
      const rawConn = await this.withTimeout(
        Deno.connect({ hostname, port, transport: 'tcp' }),
        'TCP connection'
      )

      this.conn = await this.withTimeout(
        Deno.startTls(rawConn, { hostname, alpnProtocols: [] }),
        'TLS handshake'
      )

      await this.readResponse()
      console.log('SMTP connected successfully')
    } catch (error) {
      console.error('Connection failed:', error.message)
      throw new Error(`Failed to connect to ${hostname}:${port} - ${error.message}`)
    }
  }

  async login(username: string, password: string) {
    try {
      await this.sendCommand('EHLO exploitant.example.org')
      await this.sendCommand('AUTH LOGIN')
      await this.sendCommand(btoa(username))
      await this.sendCommand(btoa(password))
      console.log('SMTP authentication successful')
    } catch (error) {
      console.error('Login failed:', error.message)
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  async sendEmail(from: string, to: string[], subject: string, body: string) {
    try {
      await this.sendCommand(`MAIL FROM:<${from}>`)

      for (const recipient of to) {
        await this.sendCommand(`RCPT TO:<${recipient}>`)
      }

      await this.sendCommand('DATA')

      const emailData = [
        `From: ${from}`,
        `To: ${to.join(', ')}`,
        `Subject: ${subject}`,
        `Content-Type: text/html; charset=UTF-8`,
        `MIME-Version: 1.0`,
        ``,
        body,
        `.`,
      ]

      await this.conn!.write(encoder.encode(emailData.join('\r\n') + '\r\n'))
      // Use longer timeout for DATA response (large forwarded bodies)
      await this.readResponse(this.DATA_TIMEOUT_MS)
      console.log('Email sent successfully via SMTP')
    } catch (error) {
      console.error('Send email failed:', error.message)
      throw new Error(`Failed to send email: ${error.message}`)
    }
  }

  async quit() {
    try {
      if (this.conn) {
        await this.sendCommand('QUIT')
        this.conn.close()
        this.conn = null
      }
    } catch (error) {
      console.warn('Error during quit:', error.message)
      try {
        this.conn?.close()
      } catch {}
      this.conn = null
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) throw new Error('Not connected to SMTP server')

    const displayCmd = command.length > 50 ? command.substring(0, 50) + '...' : command
    console.log(`> ${displayCmd}`)

    await this.conn.write(encoder.encode(command + '\r\n'))
    return await this.readResponse()
  }

  private async readResponse(customTimeoutMs?: number): Promise<string> {
    if (!this.conn) throw new Error('Not connected to SMTP server')

    const effectiveTimeout = customTimeoutMs || this.TIMEOUT_MS
    let response = ''
    const buf = new Uint8Array(4096)
    const startTime = Date.now()

    try {
      while (true) {
        if (Date.now() - startTime > effectiveTimeout) {
          throw new Error(`Read timeout after ${effectiveTimeout}ms`)
        }

        const readPromise = this.conn.read(buf)
        const n = await this.withTimeout(
          readPromise,
          'read operation',
          Math.min(effectiveTimeout, 60000)
        )

        if (n === null) {
          if (response.length > 0) break
          throw new Error('Connection closed without response')
        }

        response += decoder.decode(buf.subarray(0, n))

        const lines = response.split('\r\n')
        const lastLine = lines[lines.length - 2] || lines[lines.length - 1]

        if (lastLine && /^\d{3} /.test(lastLine)) break
        if (response.length > 100000) break
      }
    } catch (error) {
      if (error.message.includes('UnexpectedEof') || error.message.includes('connection')) {
        if (response.length > 0 && /^2\d{2}/.test(response)) {
          console.log('Treating as success despite connection close')
          return response
        }
        throw new Error(`Connection error: ${error.message}`)
      }
      throw error
    }

    const firstLine = response.split('\r\n')[0]
    if (firstLine && /^[45]\d{2}/.test(firstLine)) {
      throw new Error(`SMTP error: ${firstLine}`)
    }

    return response
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    operation: string,
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs || this.TIMEOUT_MS
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeout}ms`)), timeout)
    })
    return Promise.race([promise, timeoutPromise])
  }
}

interface ForwardEmailRequest {
  message_id: string
  to_addresses: string[]
  additional_content?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, edgeClientOptions)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    console.log('========================================')
    console.log('FORWARD-EMAIL REQUEST RECEIVED')
    console.log('========================================')

    const { message_id, to_addresses, additional_content }: ForwardEmailRequest = await req.json()

    console.log(
      'Request payload:',
      JSON.stringify({
        message_id,
        to_addresses,
        has_additional_content: !!additional_content,
      })
    )

    // Get the original message with thread and account info
    const { data: message, error: messageError } = await supabase
      .from('email_messages')
      .select(
        `
        *,
        thread:email_threads!inner(
          id,
          user_email_account_id
        )
      `
      )
      .eq('id', message_id)
      .single()

    if (messageError || !message) {
      console.error('Message not found:', messageError?.message)
      throw new Error('Message not found')
    }

    // SECURITY: verify the caller owns (or the account is shared) the mailbox tied to this thread.
    // Without this check, any authenticated user could forward mail through another user's
    // mailbox by supplying a message_id belonging to that thread (service-role client bypasses RLS).
    const forwardAccountId = message.thread?.user_email_account_id
    if (!forwardAccountId) {
      throw new Error('Message not linked to an email account')
    }
    {
      const { data: ownedAccount, error: ownErr } = await supabase
        .from('user_email_accounts')
        .select('id, profile_id, is_shared')
        .eq('id', forwardAccountId)
        .maybeSingle()
      if (ownErr || !ownedAccount) {
        return new Response(JSON.stringify({ error: 'Email account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      const isOwner =
        ownedAccount.profile_id === user.id ||
        (callerProfile?.id && ownedAccount.profile_id === callerProfile.id)
      const isSharedAccount = ownedAccount.is_shared === true
      if (!isOwner && !isSharedAccount) {
        console.warn(
          `[forward-email] Forbidden: user ${user.id} attempted to forward from account ${forwardAccountId}`
        )
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    console.log('Original message found:', {
      subject: message.subject,
      from: message.from_address,
      thread_id: message.thread?.id,
    })

    // Get encryption key for decrypting email password
    const encryptionKey = Deno.env.get('EMAIL_ENCRYPTION_KEY')
    if (!encryptionKey) {
      console.error('EMAIL_ENCRYPTION_KEY not configured')
      throw new Error('Configuration serveur manquante')
    }

    // Get email account with decrypted password using RPC (correct parameters)
    const { data: accountData, error: accountError } = await supabase
      .rpc('get_email_account_with_password', {
        account_uuid: message.thread.user_email_account_id,
        encryption_key: encryptionKey,
      })
      .maybeSingle()

    if (accountError || !accountData) {
      console.error('Account not found:', accountError?.message)
      throw new Error('Email account not found')
    }

    console.log('Using account:', accountData.email_address)

    // Validate we have SMTP credentials
    if (!accountData.smtp_host || !accountData.smtp_port || !accountData.password) {
      throw new Error('Email account missing SMTP configuration')
    }

    // Build forward subject
    const forwardSubject =
      message.subject?.startsWith('Fwd:') || message.subject?.startsWith('TR:')
        ? message.subject
        : `Fwd: ${message.subject || '(Sans objet)'}`

    // Build forward body HTML
    const originalDate = message.sent_date
      ? new Date(message.sent_date).toLocaleString('fr-FR', {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : 'Date inconnue'

    const originalBody = message.body_html || message.body_text?.replace(/\n/g, '<br>') || ''

    let forwardBodyHtml = ''

    if (additional_content) {
      forwardBodyHtml += `<div style="margin-bottom: 20px;">${additional_content.replace(/\n/g, '<br>')}</div>`
    }

    forwardBodyHtml += `
      <div style="border-left: 2px solid #0066cc; padding-left: 15px; margin-top: 20px; color: #555;">
        <p style="margin-bottom: 10px;"><strong>---------- Message transféré ----------</strong></p>
        <p style="font-size: 13px; margin-bottom: 5px;"><strong>De :</strong> ${message.from_name || ''} &lt;${message.from_address}&gt;</p>
        <p style="font-size: 13px; margin-bottom: 5px;"><strong>Date :</strong> ${originalDate}</p>
        <p style="font-size: 13px; margin-bottom: 5px;"><strong>Objet :</strong> ${message.subject || '(Sans objet)'}</p>
        <p style="font-size: 13px; margin-bottom: 15px;"><strong>À :</strong> ${
          Array.isArray(message.to_addresses)
            ? message.to_addresses.map((a: any) => a.email || a).join(', ')
            : message.to_addresses || ''
        }</p>
        <div style="margin-top: 15px;">${originalBody}</div>
      </div>
    `

    // Send email via SMTP
    const smtp = new SMTPClient()
    let smtpSent = false

    try {
      console.log(`Connecting to SMTP ${accountData.smtp_host}:${accountData.smtp_port}`)
      await smtp.connect(accountData.smtp_host, accountData.smtp_port)
      await smtp.login(accountData.email_address, accountData.password)
      await smtp.sendEmail(accountData.email_address, to_addresses, forwardSubject, forwardBodyHtml)
      smtpSent = true
      console.log('SMTP send successful')
    } catch (smtpError: any) {
      console.error('SMTP error:', smtpError.message)
      throw new Error(`Échec de l'envoi SMTP: ${smtpError.message}`)
    } finally {
      await smtp.quit()
    }

    // Store the forwarded message in database
    if (smtpSent) {
      try {
        const { error: insertError } = await supabase.from('email_messages').insert({
          thread_id: message.thread.id,
          message_id: `forward-${Date.now()}-${crypto.randomUUID()}@exploitant.example.org`,
          imap_uid: Math.floor(Math.random() * 900000000) + 100000000,
          from_address: accountData.email_address,
          from_name: accountData.display_name || accountData.email_address.split('@')[0],
          to_addresses: to_addresses.map((email) => ({ email, name: null })),
          subject: forwardSubject,
          body_html: forwardBodyHtml,
          body_text: forwardBodyHtml.replace(/<[^>]*>/g, ''),
          sent_date: new Date().toISOString(),
          is_sent: true,
          is_draft: false,
          is_read: true,
        })

        if (insertError) {
          console.warn('Failed to store forwarded message in DB:', insertError.message)
          // Don't fail the whole operation - email was sent
        } else {
          console.log('Forwarded message stored in database')
        }
      } catch (dbError: any) {
        console.warn('Database storage error:', dbError.message)
      }
    }

    // Log the forward action
    await supabase.from('security_logs').insert({
      log_type: 'email_forwarded',
      user_id: user.id,
      risk_level: 'low',
      metadata: {
        message_id,
        to_addresses,
        smtp_sent: smtpSent,
        timestamp: new Date().toISOString(),
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email transféré avec succès',
        smtp_sent: smtpSent,
        forwarded_to: to_addresses,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error forwarding email:', error.message)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
