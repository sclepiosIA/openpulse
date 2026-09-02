import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// IMAP Client for downloading attachments
class IMAPClient {
  private conn: Deno.TlsConn | null = null
  private tagCounter = 0
  private buffer = ''

  async connect(hostname: string, port: number) {
    const rawConn = await Deno.connect({ hostname, port, transport: 'tcp' })
    this.conn = await Deno.startTls(rawConn, { hostname })
    await this.readResponse()
    console.log('IMAP connected')
  }

  async login(username: string, password: string) {
    await this.sendCommand(`LOGIN "${username}" "${password}"`)
  }

  async selectMailbox(mailbox: string) {
    await this.sendCommand(`SELECT ${mailbox}`)
  }

  async fetchAttachment(uid: string, partId: string): Promise<string> {
    return await this.sendCommand(`UID FETCH ${uid} (BODY[${partId}])`)
  }

  async logout() {
    await this.sendCommand('LOGOUT')
    this.conn?.close()
  }

  private async sendCommand(command: string): Promise<string> {
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`
    const fullCommand = `${tag} ${command}\r\n`

    const logCommand = command.startsWith('LOGIN ') ? 'LOGIN *** ***' : command
    console.log(`> ${tag} ${logCommand}`)

    await this.conn!.write(encoder.encode(fullCommand))
    return await this.readResponse(tag)
  }

  private async readResponse(expectedTag?: string): Promise<string> {
    let response = this.buffer
    this.buffer = ''

    while (true) {
      const buf = new Uint8Array(8192)
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

    return response
  }
}

type AttachmentMessage = {
  imap_uid: string
  thread_id: string
  thread: { user_email_account_id: string }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Authenticate the caller (verify_jwt=true only checks token format, not real user).
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const callerUserId = userData.user.id

    const { attachment_id } = await req.json()

    if (!attachment_id) {
      return new Response(JSON.stringify({ error: 'attachment_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get attachment info
    const { data: attachment, error: attachmentError } = await supabase
      .from('email_attachments')
      .select(
        `
        id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, downloaded, imap_part_id,
        message:email_messages!inner(
          imap_uid,
          thread:email_threads!inner(
            user_email_account_id
          )
        )
      `
      )
      .eq('id', attachment_id)
      .single()

    if (attachmentError || !attachment) {
      return new Response(JSON.stringify({ error: 'Attachment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Ownership check: caller must own the email account tied to the attachment's thread
    const message = attachment.message as unknown as AttachmentMessage
    const attachmentAccountId = message?.thread?.user_email_account_id
    if (!attachmentAccountId) {
      return new Response(JSON.stringify({ error: 'Attachment not linked to an account' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: ownedAccount, error: ownedErr } = await supabase
      .from('user_email_accounts')
      .select('id')
      .eq('id', attachmentAccountId)
      .eq('user_id', callerUserId)
      .maybeSingle()
    if (ownedErr || !ownedAccount) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if already downloaded
    if (attachment.downloaded && attachment.storage_path) {
      return new Response(
        JSON.stringify({
          success: true,
          already_downloaded: true,
          storage_path: attachment.storage_path,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get email account credentials
    const encryptionKey = Deno.env.get('EMAIL_ENCRYPTION_KEY')
    if (!encryptionKey) {
      throw new Error('EMAIL_ENCRYPTION_KEY not configured')
    }

    const accountId = message.thread.user_email_account_id
    const { data: accountDataRaw, error: accountError } = await supabase
      .rpc('get_email_account_with_password', {
        account_uuid: accountId,
        encryption_key: encryptionKey,
      })
      .maybeSingle()

    if (accountError || !accountDataRaw) {
      throw new Error('Failed to get email account')
    }
    const accountData = accountDataRaw as {
      imap_host: string
      imap_port: number
      email_address: string
      password: string
    }

    // Validate file type (security check)
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.vbs']
    const fileExt = attachment.filename
      .toLowerCase()
      .substring(attachment.filename.lastIndexOf('.'))
    if (dangerousExtensions.includes(fileExt)) {
      throw new Error('File type not allowed for security reasons')
    }

    // Check file size limit (50MB)
    const MAX_SIZE = 50 * 1024 * 1024
    if ((attachment.size_bytes || 0) > MAX_SIZE) {
      throw new Error('File too large (max 50MB)')
    }

    // Connect to IMAP and fetch attachment
    const client = new IMAPClient()
    await client.connect(accountData.imap_host, accountData.imap_port)
    await client.login(accountData.email_address, accountData.password)
    await client.selectMailbox('INBOX')

    const messageUid = message.imap_uid
    const rawResponse = await client.fetchAttachment(messageUid, attachment.imap_part_id)
    await client.logout()

    // Extract attachment data from IMAP response
    const bodyMatch = rawResponse.match(/BODY\[[\d.]+\] \{(\d+)\}\r\n([\s\S]+)/)
    if (!bodyMatch) {
      throw new Error('Could not extract attachment data')
    }

    const attachmentData = bodyMatch[2].trim()

    // Decode base64 if needed
    let fileData
    try {
      fileData = Uint8Array.from(atob(attachmentData), (char) => char.charCodeAt(0))
    } catch {
      // If not base64, use as is
      fileData = encoder.encode(attachmentData)
    }

    // Upload to Supabase Storage
    const storagePath = `${accountId}/${message.thread_id}/${attachment.filename}`
    const { error: uploadError } = await supabase.storage
      .from('email-attachments')
      .upload(storagePath, fileData, {
        contentType: attachment.mime_type,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Update attachment record
    const { error: updateError } = await supabase
      .from('email_attachments')
      .update({
        downloaded: true,
        storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attachment_id)

    if (updateError) {
      console.error('Failed to update attachment record:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        storage_path: storagePath,
        filename: attachment.filename,
        size_bytes: attachment.size_bytes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return buildErrorResponse('download-attachment', error, corsHeaders, 500)
  }
}

serve(handler)
