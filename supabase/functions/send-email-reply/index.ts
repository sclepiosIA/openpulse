import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from '@supabase/supabase-js'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { rewriteLinksForTracking } from '../_shared/rewrite-tracking-links.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Email validation and sanitization
function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim()
  if (!trimmed) return null

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    console.warn('Invalid email format detected')
    return null
  }

  return trimmed
}

function sanitizeEmailList(emails: string[]): string[] {
  return emails
    .map((email) => sanitizeEmail(email))
    .filter((email): email is string => email !== null)
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Simple SMTP client with robust timeout and error handling
class SMTPClient {
  private conn: Deno.TlsConn | null = null
  private readonly TIMEOUT_MS = 30000 // 30 seconds for commands
  private readonly DATA_TIMEOUT_MS = 120000 // 120 seconds for DATA response (large bodies)

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

      await this.readResponse() // Read greeting
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

  async sendEmail(
    from: string,
    to: string | string[],
    subject: string,
    body: string,
    cc?: string[],
    bcc?: string[],
    icsContent?: string,
    inReplyTo?: string,
    referencesIds?: string[],
    attachments?: Array<{ filename: string; mime_type?: string; content_base64: string }>
  ): Promise<{ messageId: string; rfc822Message: string }> {
    try {
      await this.sendCommand(`MAIL FROM:<${(from || '').replace(/[\r\n]+/g, '')}>`)

      // Collect and deduplicate all recipients (case-insensitive)
      const recipientSet = new Set<string>()
      const addRecipients = (list: string | string[]) => {
        const arr = Array.isArray(list) ? list : [list]
        arr.forEach((e) => recipientSet.add(e.trim().toLowerCase()))
      }
      addRecipients(to)
      if (cc) addRecipients(cc)
      if (bcc) addRecipients(bcc)

      const uniqueRecipients = Array.from(recipientSet)
      console.log(`Sending to ${uniqueRecipients.length} unique recipients`)

      for (const recipient of uniqueRecipients) {
        await this.sendCommand(`RCPT TO:<${recipient.replace(/[\r\n]+/g, '')}>`)
      }

      await this.sendCommand('DATA')

      // SECURITY: strip CR/LF from header values to prevent SMTP header injection
      const stripCrlf = (v: string): string => (v || '').replace(/[\r\n]+/g, ' ').trim()
      const safeFrom = stripCrlf(from)
      const toList = Array.isArray(to)
        ? to.map(stripCrlf).filter(Boolean)
        : [stripCrlf(to)].filter(Boolean)
      const toAddresses = toList.join(', ')
      const safeCc = (cc || []).map(stripCrlf).filter(Boolean)
      const rawSubject = stripCrlf(subject)
      // RFC 2047 encoding for non-ASCII subjects
      const safeSubject = /[^\x00-\x7F]/.test(rawSubject)
        ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(rawSubject)))}?=`
        : rawSubject
      const safeInReplyTo = inReplyTo ? stripCrlf(inReplyTo) : ''
      const safeReferences = (referencesIds || []).map(stripCrlf).filter(Boolean)

      const hasAttachments = Array.isArray(attachments) && attachments.length > 0
      const isMultipart = hasAttachments || !!icsContent
      const plainTextBody = body
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()

      const chunkB64 = (s: string): string => {
        const clean = (s || '').replace(/\s+/g, '')
        const lines: string[] = []
        for (let i = 0; i < clean.length; i += 76) lines.push(clean.slice(i, i + 76))
        return lines.join('\r\n')
      }
      // RFC 2045: encode UTF-8 text in base64 with 76-char line wrapping
      const encodeBase64Content = (content: string): string => {
        const encoded = btoa(unescape(encodeURIComponent(content || '')))
        return encoded.match(/.{1,76}/g)?.join('\r\n') || encoded
      }
      const sanitizeFilename = (n: string): string =>
        (n || 'file').replace(/[\r\n"\\]/g, '_').slice(0, 200)

      const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).substring(2)}`
      const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`
      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@exploitant.example.org>`

      const headers: string[] = [`From: ${safeFrom}`, `To: ${toAddresses}`]
      if (safeCc.length > 0) headers.push(`Cc: ${safeCc.join(', ')}`)
      if (safeInReplyTo) headers.push(`In-Reply-To: <${safeInReplyTo.replace(/^<|>$/g, '')}>`)
      if (safeReferences.length > 0) {
        headers.push(
          `References: ${safeReferences.map((id) => `<${id.replace(/^<|>$/g, '')}>`).join(' ')}`
        )
      }
      headers.push(
        `Subject: ${safeSubject}`,
        `Message-ID: ${messageId}`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`
      )

      const parts: string[] = []
      if (isMultipart) {
        headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`)
        parts.push(
          '',
          `--${mixedBoundary}`,
          `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
          '',
          `--${altBoundary}`,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          encodeBase64Content(plainTextBody),
          '',
          `--${altBoundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          encodeBase64Content(body),
          '',
          `--${altBoundary}--`
        )

        if (icsContent) {
          parts.push(
            `--${mixedBoundary}`,
            `Content-Type: text/calendar; method=REQUEST; charset=UTF-8; name="invite.ics"`,
            `Content-Transfer-Encoding: base64`,
            `Content-Disposition: attachment; filename="invite.ics"`,
            '',
            encodeBase64Content(icsContent),
            ''
          )
        }

        if (hasAttachments) {
          for (const att of attachments!) {
            const filename = sanitizeFilename(att.filename)
            const mime = (att.mime_type || 'application/octet-stream').replace(/[\r\n]+/g, '')
            parts.push(
              `--${mixedBoundary}`,
              `Content-Type: ${mime}; name="${filename}"`,
              `Content-Transfer-Encoding: base64`,
              `Content-Disposition: attachment; filename="${filename}"`,
              '',
              chunkB64(att.content_base64 || ''),
              ''
            )
          }
        }

        parts.push(`--${mixedBoundary}--`)
      } else {
        headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
        parts.push(
          '',
          `--${altBoundary}`,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          encodeBase64Content(plainTextBody),
          '',
          `--${altBoundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          encodeBase64Content(body),
          '',
          `--${altBoundary}--`
        )
      }

      const rfc822Message = [...headers, ...parts].join('\r\n')

      // SMTP dot-stuffing (RFC 5321 §4.5.2): any line starting with '.' must be doubled
      const dotStuffed = rfc822Message.replace(/(^|\r\n)\./g, '$1..')

      await this.conn!.write(encoder.encode(dotStuffed + '\r\n.\r\n'))
      // Use longer timeout for DATA response (large bodies take time)
      await this.readResponse(this.DATA_TIMEOUT_MS)
      console.log(
        `Email sent successfully (Message-ID: ${messageId})` +
          (icsContent ? ' with ICS attachment' : '') +
          (hasAttachments ? ` with ${attachments!.length} file attachment(s)` : '')
      )

      return { messageId, rfc822Message }
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
      // Force close connection
      try {
        this.conn?.close()
      } catch {}
      this.conn = null
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) {
      throw new Error('Not connected to SMTP server')
    }

    const displayCmd = command.length > 50 ? command.substring(0, 50) + '...' : command
    console.log(`> ${displayCmd}`)

    await this.conn.write(encoder.encode(command + '\r\n'))
    return await this.readResponse()
  }

  private async readResponse(customTimeoutMs?: number): Promise<string> {
    if (!this.conn) {
      throw new Error('Not connected to SMTP server')
    }

    const effectiveTimeout = customTimeoutMs || this.TIMEOUT_MS
    let response = ''
    const buf = new Uint8Array(4096)
    const startTime = Date.now()

    try {
      while (true) {
        // Check timeout
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
          // Connection closed
          if (response.length > 0) {
            console.log('Connection closed, but got response:', response.substring(0, 100))
            break
          }
          throw new Error('Connection closed without response')
        }

        response += decoder.decode(buf.subarray(0, n))

        // SMTP responses end with code followed by space (e.g., "250 OK")
        // or code with dash for multi-line (e.g., "250-")
        const lines = response.split('\r\n')
        const lastLine = lines[lines.length - 2] || lines[lines.length - 1] // Get last complete line

        if (lastLine && /^\d{3} /.test(lastLine)) {
          // Got complete response
          break
        }

        // Safety check: if we have a very long response, break
        if (response.length > 100000) {
          console.warn('Response too long, breaking')
          break
        }
      }
    } catch (error) {
      if (error.message.includes('UnexpectedEof') || error.message.includes('connection')) {
        // TLS connection issue - log and rethrow with context
        console.error('TLS/Connection error during read:', error.message)
        if (response.length > 0) {
          console.log('Partial response received:', response.substring(0, 200))
          // If we got a partial response that looks like success, use it
          if (/^2\d{2}/.test(response)) {
            console.log('Treating as success despite connection close')
            return response
          }
        }
        throw new Error(`Connection error: ${error.message}`)
      }
      throw error
    }

    const displayResp = response.length > 100 ? response.substring(0, 100) + '...' : response
    console.log(`< ${displayResp}`)

    // Check for error codes
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
    const controller = new AbortController()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        controller.abort()
        reject(new Error(`${operation} timed out after ${timeout}ms`))
      }, timeout)
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } catch (error) {
      controller.abort()
      throw error
    }
  }
}

// Simple IMAP client for APPEND to Sent folder
class IMAPClient {
  private conn: Deno.TlsConn | null = null
  private tagCounter = 0
  private readonly TIMEOUT_MS = 30000

  async connect(hostname: string, port: number) {
    try {
      const rawConn = await this.withTimeout(
        Deno.connect({ hostname, port, transport: 'tcp' }),
        'IMAP TCP connection'
      )

      this.conn = await this.withTimeout(Deno.startTls(rawConn, { hostname }), 'IMAP TLS handshake')

      await this.readResponse() // Read greeting
      console.log('IMAP connected successfully')
    } catch (error) {
      console.error('IMAP connection failed:', error.message)
      throw new Error(`IMAP connect failed: ${error.message}`)
    }
  }

  async login(username: string, password: string) {
    try {
      await this.sendCommand(`LOGIN "${username}" "${password}"`)
      console.log('IMAP login successful')
    } catch (error) {
      console.error('IMAP login failed:', error.message)
      throw new Error(`IMAP login failed: ${error.message}`)
    }
  }

  async appendToSent(
    rfc822Message: string,
    sentFolderNames: string[] = ['Sent', 'INBOX.Sent', 'Envoyes', 'INBOX.Envoyes']
  ) {
    // Try different common folder names
    for (const folderName of sentFolderNames) {
      try {
        await this.appendToFolder(folderName, rfc822Message)
        console.log(`IMAP APPEND to "${folderName}" successful`)
        return true
      } catch (error) {
        console.warn(`IMAP APPEND to "${folderName}" failed:`, error.message)
        // Try next folder name
      }
    }
    console.warn('Failed to append to any Sent folder')
    return false
  }

  private async appendToFolder(folderName: string, rfc822Message: string) {
    const messageBytes = new TextEncoder().encode(rfc822Message)
    const size = messageBytes.length

    // Send APPEND command with literal size
    this.tagCounter++
    const tag = `A${this.tagCounter.toString().padStart(4, '0')}`
    const command = `${tag} APPEND "${folderName}" (\\Seen) {${size}}`

    if (!this.conn) throw new Error('Not connected')

    console.log(`> ${command}`)
    await this.conn.write(encoder.encode(command + '\r\n'))

    // Wait for continuation response (+)
    const contResponse = await this.readResponseRaw()
    if (!contResponse.includes('+')) {
      throw new Error(`IMAP APPEND failed: ${contResponse}`)
    }

    // Send the message data
    await this.conn.write(messageBytes)
    await this.conn.write(encoder.encode('\r\n'))

    // Read final response
    const response = await this.readResponseRaw()
    if (!response.includes(`${tag} OK`)) {
      throw new Error(`IMAP APPEND failed: ${response}`)
    }
  }

  async logout() {
    try {
      if (this.conn) {
        this.tagCounter++
        const tag = `A${this.tagCounter.toString().padStart(4, '0')}`
        await this.conn.write(encoder.encode(`${tag} LOGOUT\r\n`))
        this.conn.close()
        this.conn = null
      }
    } catch (error) {
      console.warn('IMAP logout error:', error.message)
      try {
        this.conn?.close()
      } catch {}
      this.conn = null
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) throw new Error('Not connected')

    this.tagCounter++
    const tag = `A${this.tagCounter.toString().padStart(4, '0')}`
    const fullCommand = `${tag} ${command}`

    // Hide password in logs
    const displayCmd = command.startsWith('LOGIN') ? 'LOGIN *** ***' : command
    console.log(`> ${displayCmd}`)

    await this.conn.write(encoder.encode(fullCommand + '\r\n'))

    const response = await this.readResponseRaw()
    if (response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
      throw new Error(`IMAP error: ${response}`)
    }
    return response
  }

  private async readResponse(): Promise<void> {
    await this.readResponseRaw()
  }

  private async readResponseRaw(): Promise<string> {
    if (!this.conn) throw new Error('Not connected')

    let response = ''
    const buf = new Uint8Array(4096)
    const startTime = Date.now()

    while (Date.now() - startTime < this.TIMEOUT_MS) {
      const n = await this.conn.read(buf)
      if (n === null) break

      response += decoder.decode(buf.subarray(0, n))

      // Check for complete response (ends with tag OK/NO/BAD or continuation +)
      if (/^A\d{4} (OK|NO|BAD)/m.test(response) || response.includes('+ ')) {
        break
      }

      if (response.length > 50000) break // Safety limit
    }

    const displayResp = response.length > 100 ? response.substring(0, 100) + '...' : response.trim()
    console.log(`< ${displayResp}`)

    return response
  }

  private async withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${operation} timed out`)), this.TIMEOUT_MS)
    })
    return Promise.race([promise, timeoutPromise])
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '')

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      thread_id,
      account_id,
      to,
      cc,
      bcc,
      subject,
      body,
      ics_content,
      in_reply_to,
      references,
      attachments,
    } = await req.json()

    // === DIAGNOSTIC LOGGING ===
    console.log('========================================')
    console.log('SEND-EMAIL-REPLY REQUEST RECEIVED')
    console.log('========================================')
    console.log(
      'Request payload:',
      JSON.stringify({
        thread_id: thread_id || 'MISSING',
        account_id: account_id || 'MISSING',
        to: to,
        cc: cc || null,
        subject: subject?.substring(0, 50) || 'MISSING',
        body_length: body?.length || 0,
        has_ics: !!ics_content,
      })
    )

    // Validate and sanitize email addresses
    const toList = sanitizeEmailList(Array.isArray(to) ? to : [to])
    const ccList = cc ? sanitizeEmailList(Array.isArray(cc) ? cc : [cc]) : undefined
    const bccList = bcc ? sanitizeEmailList(Array.isArray(bcc) ? bcc : [bcc]) : undefined

    if (!account_id || toList.length === 0 || !subject || !body) {
      console.error('VALIDATION FAILED:', {
        has_account_id: !!account_id,
        to_count: toList.length,
        has_subject: !!subject,
        has_body: !!body,
      })
      return new Response(
        JSON.stringify({ error: 'Missing required fields or invalid email addresses' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Sending email reply from account ${account_id} to ${toList.join(', ')}...`)
    console.log('ICS content received:', ics_content ? `${ics_content.length} chars` : 'NONE')

    // SECURITY: verify the caller owns (or the account is shared) the account_id they supplied.
    // Without this check any authenticated user could send mail through another user's mailbox
    // (get_email_account_with_password RPC and service-role client bypass RLS).
    {
      const { data: ownedAccount, error: ownErr } = await supabase
        .from('user_email_accounts')
        .select('id, profile_id, is_shared')
        .eq('id', account_id)
        .maybeSingle()
      if (ownErr || !ownedAccount) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // profile_id stores profiles.id, but user.id is auth.users.id.
      // Resolve the caller's profile row to compare correctly.
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
          `[send-email-reply] Forbidden: user ${user.id} attempted to reply from account ${account_id}`
        )
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Session 10 — Lot C: réécriture des liens HTML pour tracking des clics
    let trackedBody = thread_id ? await rewriteLinksForTracking(body, thread_id) : body

    // Session 11 — item 7: injection pixel d'ouverture (1x1 transparent) avant </body>
    // 🔒 Sécurité: l'URL est signée HMAC-SHA256 (param `s`) pour empêcher tout
    // tiers de forger des événements d'ouverture pour un UUID de thread connu.
    if (thread_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const { signOpenPayload } = await import('../_shared/tracking-hmac.ts')
      const sig = await signOpenPayload(thread_id, null)
      const params = new URLSearchParams({ t: thread_id })
      if (sig) params.set('s', sig)
      const pixelUrl = `${supabaseUrl}/functions/v1/track-email-open?${params.toString()}`
      const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px" />`
      trackedBody = /<\/body>/i.test(trackedBody)
        ? trackedBody.replace(/<\/body>/i, `${pixelTag}</body>`)
        : `${trackedBody}${pixelTag}`
    }

    // Get encryption key
    const encryptionKey = Deno.env.get('EMAIL_ENCRYPTION_KEY')
    if (!encryptionKey) {
      console.error('EMAIL_ENCRYPTION_KEY not configured')
      return new Response(
        JSON.stringify({
          error: 'Configuration serveur manquante',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get email account with decrypted password
    const { data: accountData, error: accountError } = await supabase
      .rpc('get_email_account_with_password', {
        account_uuid: account_id,
        encryption_key: encryptionKey,
      })
      .maybeSingle()

    if (accountError || !accountData) {
      console.error('Failed to retrieve account:', accountError)
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email_address, password, smtp_host, smtp_port, imap_host, imap_port } = accountData
    console.log(`Using SMTP: ${smtp_host}:${smtp_port} for ${email_address}`)

    const client = new SMTPClient()
    let emailSent = false
    let rfc822Message = '' // Store for IMAP APPEND

    try {
      console.log(`Attempting SMTP connection to ${smtp_host}:${smtp_port}...`)
      await client.connect(smtp_host, smtp_port)

      console.log('Authenticating...')
      await client.login(email_address, password)

      console.log('Sending email...' + (ics_content ? ' with calendar invitation' : ''))
      // Validate attachments payload size (max 25 MB total base64 ≈ ~33 MB raw)
      let safeAttachments: Array<{
        filename: string
        mime_type?: string
        content_base64: string
        size?: number
      }> = []
      if (Array.isArray(attachments) && attachments.length > 0) {
        const totalB64 = attachments.reduce(
          (s: number, a: any) => s + (a?.content_base64?.length || 0),
          0
        )
        if (totalB64 > 35 * 1024 * 1024) {
          throw new Error(
            'Pièces jointes trop volumineuses (>25 Mo) — utiliser un transfert sécurisé'
          )
        }
        safeAttachments = attachments.slice(0, 20).map((a: any) => ({
          filename: String(a.filename || 'file'),
          mime_type: a.mime_type || 'application/octet-stream',
          content_base64: String(a.content_base64 || ''),
          size: Number(a.size || 0),
        }))
      }
      const sendResult = await client.sendEmail(
        email_address,
        toList,
        subject,
        trackedBody,
        ccList,
        bccList,
        ics_content,
        in_reply_to,
        references,
        safeAttachments.length > 0 ? safeAttachments : undefined
      )

      emailSent = true

      // Reuse the exact MIME message sent via SMTP so the Sent folder
      // includes the full multipart payload (HTML + attachments + ICS).
      rfc822Message = sendResult.rfc822Message

      console.log('Closing SMTP connection...')
      await client.quit()

      // Copy to Sent folder via IMAP (non-blocking, don't fail if this fails)
      if (imap_host && imap_port) {
        try {
          console.log(`Copying to Sent folder via IMAP ${imap_host}:${imap_port}...`)
          const imapClient = new IMAPClient()
          await imapClient.connect(imap_host, imap_port)
          await imapClient.login(email_address, password)
          await imapClient.appendToSent(rfc822Message)
          await imapClient.logout()
          console.log('Email copied to Sent folder successfully')
        } catch (imapError: unknown) {
          const errMsg = imapError instanceof Error ? imapError.message : 'Unknown error'
          console.warn('Failed to copy to Sent folder (non-critical):', errMsg)
        }
      }

      // Store sent message in database if thread_id provided and email was sent
      if (emailSent && thread_id) {
        console.log('Storing sent message in database for thread:', thread_id)
        const messageId = `sent-${Date.now()}-${crypto.randomUUID()}@exploitant.example.org`
        // Use UUID suffix to guarantee uniqueness and prevent UNIQUE constraint violations
        const imapUid = `sent-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

        const { data: insertedMessage, error: insertError } = await supabase
          .from('email_messages')
          .insert({
            thread_id,
            message_id: messageId,
            imap_uid: imapUid, // Required NOT NULL field
            from_address: email_address,
            from_name: null,
            to_addresses: toList.map((email) => ({ email, name: null })),
            cc_addresses:
              ccList && ccList.length > 0 ? ccList.map((email) => ({ email, name: null })) : null,
            bcc_addresses:
              bccList && bccList.length > 0
                ? bccList.map((email) => ({ email, name: null }))
                : null,
            subject,
            body_text: body,
            body_html: body, // Store as HTML too since we send HTML
            sent_date: new Date().toISOString(),
            received_date: new Date().toISOString(),
            is_sent: true, // KEY: marks as sent for hasReply detection
            is_read: true, // Sent messages are already read
            is_draft: false,
            has_attachments: safeAttachments.length > 0,
            attachments_count: safeAttachments.length,

            source_mailbox: 'Sent',
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('========================================')
          console.error('CRITICAL: Email sent via SMTP but FAILED to store in database!')
          console.error('Insert error:', insertError)
          console.error('Thread ID:', thread_id)
          console.error('========================================')

          // Cleanup: Delete orphan thread created by frontend (only if no messages)
          const { error: deleteError } = await supabase
            .from('email_threads')
            .delete()
            .eq('id', thread_id)
            .eq('message_count', 0)

          if (deleteError) {
            console.warn('Failed to delete orphan thread:', deleteError)
          } else {
            console.log('Cleaned up orphan thread:', thread_id)
          }

          // Return SUCCESS with warning - email WAS sent, just not stored
          return new Response(
            JSON.stringify({
              success: true,
              warning: 'Email envoyé mais non enregistré en base de données',
              details: insertError.message,
              smtp_sent: true,
              db_stored: false,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        console.log('Sent message stored successfully with ID:', insertedMessage?.id)

        // Update thread - explicitly set has_sent_messages
        const { data: threadData, error: threadFetchError } = await supabase
          .from('email_threads')
          .select('message_count')
          .eq('id', thread_id)
          .single()

        if (threadFetchError) {
          console.warn('Failed to fetch thread for update:', threadFetchError)
        }

        const { error: threadUpdateError } = await supabase
          .from('email_threads')
          .update({
            last_message_date: new Date().toISOString(),
            message_count: (threadData?.message_count || 0) + 1,
            has_sent_messages: true, // Explicitly set this
          })
          .eq('id', thread_id)

        if (threadUpdateError) {
          console.warn('Failed to update thread:', threadUpdateError)
        } else {
          console.log('Thread updated with has_sent_messages=true')
        }
      } else if (emailSent && !thread_id) {
        console.warn('========================================')
        console.warn('WARNING: Email sent but no thread_id provided - cannot store in database!')
        console.warn('========================================')
      }

      console.log('========================================')
      console.log('EMAIL SENT AND STORED SUCCESSFULLY')
      console.log('========================================')

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email envoyé avec succès',
          smtp_sent: true,
          db_stored: !!thread_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } catch (smtpError) {
      console.error('SMTP error:', smtpError)

      // Ensure connection is closed
      try {
        await client.quit()
      } catch (closeError) {
        console.warn('Error closing connection:', closeError.message)
      }

      // Check if email might have been sent despite error
      if (emailSent) {
        console.log('Email was sent despite error during cleanup')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email envoyé avec succès',
            warning: 'Connection closed with error but email was sent',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      console.error('SMTP error:', smtpError)
      return new Response(
        JSON.stringify({
          error: "Échec de l'envoi de l'email",
          details: sanitizeErrorForClient(smtpError),
          help: 'Vérifiez vos identifiants SMTP et la configuration du serveur',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    console.error('Error in send-email-reply:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
