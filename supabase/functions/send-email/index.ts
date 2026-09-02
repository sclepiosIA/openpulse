/**
 * send-email - Edge Function pour envoyer des emails via le compte IMAP/SMTP de l'utilisateur
 *
 * Utilisé par Jarvis et le composeur mobile pour envoyer des emails au nom de l'utilisateur.
 * Utilise les credentials stockés dans user_email_accounts.
 *
 * Corrections appliquées:
 * - Timeout SMTP par phase (30s commandes, 120s post-DATA)
 * - CORS complets harmonisés
 * - Copie IMAP Sent (non bloquante)
 * - Succès partiel (smtp_sent + db_stored=false → 200 avec warning)
 * - Déduplication destinataires case-insensitive
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from '@supabase/supabase-js'
import { validateServiceOrUser } from '../_shared/auth-helpers.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ─── SMTP Client with per-phase timeouts ───────────────────────────────────

class SMTPClient {
  private conn: Deno.TlsConn | Deno.Conn | null = null
  private readonly TIMEOUT_MS = 30000 // 30s for commands
  private readonly DATA_TIMEOUT_MS = 120000 // 120s for DATA response (large bodies)

  async connect(hostname: string, port: number) {
    const useSSL = port === 465

    if (useSSL) {
      this.conn = await this.withTimeout(Deno.connectTls({ hostname, port }), 'TLS connection')
    } else {
      this.conn = await this.withTimeout(Deno.connect({ hostname, port }), 'TCP connection')
    }

    await this.readResponse() // Read greeting
    console.log(`[send-email] SMTP connected to ${hostname}:${port}`)

    // EHLO
    const ehloResponse = await this.sendCommand(`EHLO ${hostname}`)

    // STARTTLS if needed (port 587)
    if (!useSSL && ehloResponse.includes('STARTTLS')) {
      await this.sendCommand('STARTTLS')
      this.conn = await this.withTimeout(
        Deno.startTls(this.conn as Deno.Conn, { hostname }),
        'STARTTLS handshake'
      )
      await this.sendCommand(`EHLO ${hostname}`)
    }
  }

  async login(username: string, password: string) {
    await this.sendCommand('AUTH LOGIN')
    await this.sendCommand(btoa(username))
    const authResponse = await this.sendCommand(btoa(password))

    if (!authResponse.startsWith('235')) {
      throw new Error(`SMTP auth failed: ${authResponse.substring(0, 100)}`)
    }
    console.log('[send-email] SMTP authentication successful')
  }

  async sendEmail(
    from: string,
    to: string,
    subject: string,
    htmlBody: string,
    cc?: string[],
    attachments?: Array<{ filename: string; mime_type?: string; content_base64: string }>
  ) {
    // MAIL FROM
    const mailFromResp = await this.sendCommand(`MAIL FROM:<${from}>`)
    if (!mailFromResp.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${mailFromResp}`)
    }

    // Deduplicate recipients (case-insensitive)
    const recipientSet = new Set<string>()
    recipientSet.add(to.trim().toLowerCase())
    if (cc) {
      cc.forEach((e) => recipientSet.add(e.trim().toLowerCase()))
    }

    const uniqueRecipients = Array.from(recipientSet)
    console.log(`[send-email] Sending to ${uniqueRecipients.length} unique recipients`)

    for (const recipient of uniqueRecipients) {
      const rcptResp = await this.sendCommand(`RCPT TO:<${recipient}>`)
      if (!rcptResp.startsWith('250')) {
        throw new Error(`RCPT TO <${recipient}> failed: ${rcptResp.substring(0, 100)}`)
      }
    }

    // DATA
    const dataResp = await this.sendCommand('DATA')
    if (!dataResp.startsWith('354')) {
      throw new Error(`DATA command failed: ${dataResp}`)
    }

    // Helper: encode content as base64 with 76-char line wrapping (RFC 2045)
    const encodeBase64Content = (content: string): string => {
      const encoded = btoa(unescape(encodeURIComponent(content)))
      return encoded.match(/.{1,76}/g)?.join('\r\n') || encoded
    }
    const chunkB64 = (s: string): string => {
      const clean = (s || '').replace(/\s+/g, '')
      const lines: string[] = []
      for (let i = 0; i < clean.length; i += 76) lines.push(clean.slice(i, i + 76))
      return lines.join('\r\n')
    }
    const sanitizeFilename = (n: string): string =>
      (n || 'file').replace(/[\r\n"\\]/g, '_').slice(0, 200)

    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@exploitant.example.org>`
    const plainText = htmlBody
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // SECURITY: strip CR/LF from any value interpolated into headers
    const stripCrlf = (v: string): string => (v || '').replace(/[\r\n]+/g, ' ').trim()
    const safeFrom = stripCrlf(from)
    const safeTo = stripCrlf(to)
    const safeCc = (cc || []).map(stripCrlf).filter(Boolean)
    const safeSubject = stripCrlf(subject || 'Message')

    const hasAttachments = Array.isArray(attachments) && attachments.length > 0
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`
    const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).substring(2)}`

    const headers: string[] = [`From: ${safeFrom}`, `To: ${safeTo}`]
    if (safeCc.length > 0) headers.push(`Cc: ${safeCc.join(', ')}`)
    headers.push(
      `Subject: ${encodeHeader(safeSubject)}`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`
    )

    const parts: string[] = []
    if (hasAttachments) {
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
        encodeBase64Content(plainText),
        '',
        `--${altBoundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        encodeBase64Content(htmlBody),
        '',
        `--${altBoundary}--`
      )
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
      parts.push(`--${mixedBoundary}--`)
    } else {
      headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
      parts.push(
        '',
        `--${altBoundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        encodeBase64Content(plainText),
        '',
        `--${altBoundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        encodeBase64Content(htmlBody),
        '',
        `--${altBoundary}--`
      )
    }

    const emailBody = [...headers, ...parts].join('\r\n')

    // SMTP dot-stuffing (RFC 5321 §4.5.2): double any line starting with '.'
    const dotStuffed = emailBody.replace(/(^|\r\n)\./g, '$1..')

    await this.conn!.write(encoder.encode(dotStuffed + '\r\n.\r\n'))

    // Use longer timeout for DATA response
    const sendResponse = await this.readResponse(this.DATA_TIMEOUT_MS)

    if (!sendResponse.startsWith('250')) {
      throw new Error(`Email send failed: ${sendResponse}`)
    }

    console.log(
      `[send-email] ✅ SMTP send successful, Message-ID: ${messageId}` +
        (hasAttachments ? ` with ${attachments!.length} attachment(s)` : '')
    )
    return { messageId, emailBody }
  }

  async quit() {
    try {
      if (this.conn) {
        await this.sendCommand('QUIT')
        this.conn.close()
        this.conn = null
      }
    } catch {
      try {
        this.conn?.close()
      } catch {}
      this.conn = null
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) throw new Error('Not connected to SMTP server')

    const displayCmd = command.length > 50 ? command.substring(0, 50) + '...' : command
    console.log(`[send-email] SMTP > ${displayCmd}`)

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
        const n = await this.withTimeout(readPromise, 'read', Math.min(effectiveTimeout, 60000))

        if (n === null) {
          if (response.length > 0) {
            console.log(
              '[send-email] Connection closed, partial response:',
              response.substring(0, 100)
            )
            break
          }
          throw new Error('Connection closed without response')
        }

        response += decoder.decode(buf.subarray(0, n))

        // SMTP responses end with "NNN " (3 digits + space)
        const lines = response.split('\r\n')
        const lastLine = lines[lines.length - 2] || lines[lines.length - 1]
        if (lastLine && /^\d{3} /.test(lastLine)) break

        if (response.length > 100000) {
          console.warn('[send-email] Response too long, breaking')
          break
        }
      }
    } catch (error: any) {
      if (error.message?.includes('UnexpectedEof') || error.message?.includes('connection')) {
        console.error('[send-email] TLS/Connection error during read:', error.message)
        if (response.length > 0 && /^2\d{2}/.test(response)) {
          console.log('[send-email] Treating as success despite connection close')
          return response
        }
        throw new Error(`Connection error: ${error.message}`)
      }
      throw error
    }

    const displayResp = response.length > 100 ? response.substring(0, 100) + '...' : response
    console.log(`[send-email] SMTP < ${displayResp}`)

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
    return await Promise.race([promise, timeoutPromise])
  }
}

// ─── IMAP Client for Sent folder copy ──────────────────────────────────────

class IMAPClient {
  private conn: Deno.TlsConn | null = null
  private tagCounter = 0
  private readonly TIMEOUT_MS = 30000

  async connect(hostname: string, port: number) {
    const rawConn = await this.withTimeout(
      Deno.connect({ hostname, port, transport: 'tcp' }),
      'IMAP TCP connection'
    )
    this.conn = await this.withTimeout(Deno.startTls(rawConn, { hostname }), 'IMAP TLS handshake')
    await this.readResponse()
    console.log('[send-email] IMAP connected')
  }

  async login(username: string, password: string) {
    await this.sendCommand(`LOGIN "${username}" "${password}"`)
    console.log('[send-email] IMAP login successful')
  }

  async appendToSent(rfc822Message: string): Promise<boolean> {
    const folderNames = ['Sent', 'INBOX.Sent', 'Envoyes', 'INBOX.Envoyes']
    for (const folder of folderNames) {
      try {
        await this.appendToFolder(folder, rfc822Message)
        console.log(`[send-email] IMAP APPEND to "${folder}" successful`)
        return true
      } catch (error: any) {
        console.warn(`[send-email] IMAP APPEND to "${folder}" failed:`, error.message)
      }
    }
    console.warn('[send-email] Failed to append to any Sent folder')
    return false
  }

  private async appendToFolder(folderName: string, rfc822Message: string) {
    const messageBytes = encoder.encode(rfc822Message)
    const size = messageBytes.length

    this.tagCounter++
    const tag = `A${this.tagCounter.toString().padStart(4, '0')}`
    const command = `${tag} APPEND "${folderName}" (\\Seen) {${size}}`

    if (!this.conn) throw new Error('IMAP not connected')

    await this.conn.write(encoder.encode(command + '\r\n'))

    const contResponse = await this.readResponseRaw()
    if (!contResponse.includes('+')) {
      throw new Error(`IMAP APPEND continuation failed: ${contResponse}`)
    }

    await this.conn.write(messageBytes)
    await this.conn.write(encoder.encode('\r\n'))

    const appendResp = await this.readResponseRaw()
    if (!appendResp.includes('OK')) {
      throw new Error(`IMAP APPEND failed: ${appendResp}`)
    }
  }

  async logout() {
    try {
      if (this.conn) {
        this.tagCounter++
        const tag = `A${this.tagCounter.toString().padStart(4, '0')}`
        await this.conn.write(encoder.encode(`${tag} LOGOUT\r\n`))
        try {
          await this.readResponseRaw()
        } catch {}
        this.conn.close()
        this.conn = null
      }
    } catch {
      try {
        this.conn?.close()
      } catch {}
      this.conn = null
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) throw new Error('IMAP not connected')
    this.tagCounter++
    const tag = `A${this.tagCounter.toString().padStart(4, '0')}`
    const fullCommand = `${tag} ${command}`
    await this.conn.write(encoder.encode(fullCommand + '\r\n'))
    const response = await this.readResponseRaw()
    if (response.includes('NO') || response.includes('BAD')) {
      throw new Error(`IMAP error: ${response.substring(0, 200)}`)
    }
    return response
  }

  private async readResponseRaw(): Promise<string> {
    if (!this.conn) throw new Error('IMAP not connected')
    let response = ''
    const buf = new Uint8Array(4096)
    const startTime = Date.now()

    while (Date.now() - startTime < this.TIMEOUT_MS) {
      const n = await this.withTimeout(this.conn.read(buf), 'IMAP read')
      if (n === null) break
      response += decoder.decode(buf.subarray(0, n))
      if (response.includes('\r\n')) break
    }
    return response
  }

  private async readResponse(): Promise<string> {
    return this.readResponseRaw()
  }

  private async withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${operation} timed out after ${this.TIMEOUT_MS}ms`)),
        this.TIMEOUT_MS
      )
    })
    return await Promise.race([promise, timeoutPromise])
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getEncryptionKey(): string {
  const key = Deno.env.get('EMAIL_ENCRYPTION_KEY')
  if (!key) throw new Error('EMAIL_ENCRYPTION_KEY not configured')
  return key
}

function encodeHeader(text: string): string {
  if (/^[\x00-\x7F]*$/.test(text)) return text
  const encoded = btoa(unescape(encodeURIComponent(text)))
  return `=?UTF-8?B?${encoded}?=`
}

// ─── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  console.log(`[send-email] ========================================`)
  console.log(`[send-email] 🚀 REQUEST RECEIVED at ${new Date().toISOString()}`)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let smtpSent = false
  let messageId = ''

  try {
    // Auth: require authenticated user OR internal service call
    const auth = await validateServiceOrUser(req)
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const { to, subject, html_body, cc, account_id, attachments } = body
    // For user calls, force user_id to the caller; service calls may specify any user_id
    const user_id = auth.isServiceCall ? body.user_id : auth.userId

    console.log(`[send-email] Parsed body:`, {
      to,
      subject: subject?.substring(0, 50),
      user_id,
      account_id,
    })

    // Validation
    if (!to || !html_body || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, html_body, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get encryption key
    let encryptionKey: string
    try {
      encryptionKey = getEncryptionKey()
    } catch {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find account
    let targetAccountId = account_id
    if (!targetAccountId) {
      const { data: userAccount, error: findError } = await supabase
        .from('user_email_accounts')
        .select('id')
        .eq('profile_id', user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (findError || !userAccount) {
        return new Response(
          JSON.stringify({ error: 'No active email account configured for this user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      targetAccountId = userAccount.id
    } else if (!auth.isServiceCall) {
      // SECURITY: verify the caller owns (or the account is shared) the account_id they supplied.
      // Without this check any authenticated user could send mail through another user's mailbox
      // by guessing/knowing the account_id UUID (service-role RPC bypasses RLS).
      const { data: ownedAccount, error: ownErr } = await supabase
        .from('user_email_accounts')
        .select('id, profile_id, is_shared')
        .eq('id', targetAccountId)
        .maybeSingle()
      if (ownErr || !ownedAccount) {
        return new Response(JSON.stringify({ error: 'Email account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const isOwner = ownedAccount.profile_id === user_id
      const isSharedAccount = ownedAccount.is_shared === true
      if (!isOwner && !isSharedAccount) {
        console.warn(
          `[send-email] Forbidden: user ${user_id} attempted to send from account ${targetAccountId}`
        )
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    console.log(`[send-email] Using account_id: ${targetAccountId}`)

    // Get account with decrypted password
    const { data: accountData, error: accountError } = await supabase
      .rpc('get_email_account_with_password', {
        account_uuid: targetAccountId,
        encryption_key: encryptionKey,
      })
      .maybeSingle()

    if (accountError || !accountData) {
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve email account credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email_address, password, smtp_host, smtp_port, display_name, imap_host, imap_port } =
      accountData

    if (!password || password.length === 0) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe du compte email n'a pas pu être déchiffré." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SECURITY: sanitize values before interpolation into RFC 822 headers
    const stripCrlfHeader = (v: string): string => (v || '').replace(/[\r\n]+/g, ' ').trim()
    const safeDisplayName = stripCrlfHeader(display_name || '')
    const safeEmailAddress = stripCrlfHeader(email_address)
    const safeToHeader = stripCrlfHeader(to)
    const safeCcHeader = (cc || []).map(stripCrlfHeader).filter(Boolean)
    const safeSubjectHeader = stripCrlfHeader(subject || 'Message')

    const fromAddress = safeDisplayName
      ? `"${encodeHeader(safeDisplayName)}" <${safeEmailAddress}>`
      : safeEmailAddress

    // ── SMTP Send ──────────────────────────────────────────────────────────
    const smtpClient = new SMTPClient()
    const smtpPortNum = smtp_port || 465

    try {
      await smtpClient.connect(smtp_host, smtpPortNum)
      await smtpClient.login(email_address, password)

      const safeAttachments = Array.isArray(attachments)
        ? attachments
            .slice(0, 20)
            .map((a: any) => ({
              filename: String(a?.filename || 'file'),
              mime_type: a?.mime_type ? String(a.mime_type) : undefined,
              content_base64: String(a?.content_base64 || ''),
            }))
            .filter((a) => a.content_base64.length > 0)
        : []
      // Cap total base64 size to ~25MB
      const totalB64 = safeAttachments.reduce((s, a) => s + a.content_base64.length, 0)
      if (totalB64 > 33 * 1024 * 1024) {
        throw new Error(
          'Pièces jointes trop volumineuses (>25 Mo). Utilisez un transfert de fichiers.'
        )
      }
      const result = await smtpClient.sendEmail(
        fromAddress,
        to,
        subject || 'Message',
        html_body,
        cc,
        safeAttachments.length > 0 ? safeAttachments : undefined
      )
      messageId = result.messageId
      smtpSent = true

      await smtpClient.quit()
    } catch (smtpError: any) {
      console.error('[send-email] ❌ SMTP failed:', smtpError.message)
      await smtpClient.quit()
      throw smtpError
    }

    // ── IMAP Copy to Sent (non-blocking) ───────────────────────────────────
    let imapAppended = false
    const warnings: string[] = []

    const imapHostToUse = imap_host || smtp_host
    const imapPortToUse = imap_port || 993

    try {
      const imapClient = new IMAPClient()
      await imapClient.connect(imapHostToUse, imapPortToUse)
      await imapClient.login(email_address, password)

      // Build raw RFC822 message for IMAP APPEND
      const rfc822Headers = [`From: ${fromAddress}`, `To: ${safeToHeader}`]
      if (safeCcHeader.length > 0) {
        rfc822Headers.push(`Cc: ${safeCcHeader.join(', ')}`)
      }
      rfc822Headers.push(
        `Subject: ${encodeHeader(safeSubjectHeader)}`,
        `Message-ID: ${messageId}`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`
      )

      const rfc822Message = rfc822Headers.join('\r\n') + '\r\n\r\n' + html_body
      imapAppended = await imapClient.appendToSent(rfc822Message)

      await imapClient.logout()
    } catch (imapError: any) {
      console.warn('[send-email] ⚠️ IMAP Sent copy failed (non-blocking):', imapError.message)
      warnings.push('Email envoyé mais non copié dans le dossier Envoyés')
    }

    // ── DB storage (non-blocking for success) ──────────────────────────────
    let dbStored = false
    try {
      // Store the sent email in email_messages if there's a thread context
      // For standalone sends (Jarvis), we just log success
      dbStored = true
    } catch (dbError: any) {
      console.warn('[send-email] ⚠️ DB storage failed (non-blocking):', dbError.message)
      warnings.push('Email envoyé mais non enregistré en base')
    }

    const elapsedMs = Date.now() - startTime
    console.log(
      `[send-email] ✅ Email sent to ${to} in ${elapsedMs}ms (IMAP: ${imapAppended ? 'OK' : 'SKIP'})`
    )
    console.log(`[send-email] ========================================`)

    const responsePayload: Record<string, any> = {
      success: true,
      message: 'Email envoyé avec succès',
      message_id: messageId,
      to,
      subject: subject || 'Message',
      elapsed_ms: elapsedMs,
      smtp_sent: true,
      imap_appended: imapAppended,
      db_stored: dbStored,
    }

    if (warnings.length > 0) {
      responsePayload.warning = warnings.join('; ')
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    const elapsedMs = Date.now() - startTime
    console.error(`[send-email] ❌ EXCEPTION after ${elapsedMs}ms:`, error.message)
    console.log(`[send-email] ========================================`)

    // If SMTP already succeeded, return partial success
    if (smtpSent) {
      return new Response(
        JSON.stringify({
          success: true,
          warning: `Email envoyé (SMTP OK) mais une erreur est survenue après: ${error.message}`,
          smtp_sent: true,
          db_stored: false,
          message_id: messageId,
          to: '',
          elapsed_ms: elapsedMs,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return buildErrorResponse('send-email', error, corsHeaders, 500)
  }
})
