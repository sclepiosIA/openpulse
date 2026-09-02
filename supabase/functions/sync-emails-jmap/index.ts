import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-function-secret

// ============================================
// Validation
// ============================================
const RequestSchema = z.object({
  account_id: z.string().uuid(),
  historical_backfill: z.boolean().default(false),
})

// ============================================
// JMAP Client Helper
// ============================================
class JMAPClient {
  private apiUrl: string
  private authHeader: string
  private accountId: string | null = null

  constructor(stalwartUrl: string, username: string, password: string) {
    this.apiUrl = `${stalwartUrl}/jmap`
    this.authHeader = `Basic ${btoa(`${username}:${password}`)}`
  }

  /** Discover JMAP session and extract primary accountId */
  async discover(stalwartUrl: string): Promise<void> {
    const resp = await fetch(`${stalwartUrl}/.well-known/jmap`, {
      headers: { Authorization: this.authHeader },
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`JMAP session discovery failed (${resp.status}): ${text}`)
    }
    const session = await resp.json()
    this.apiUrl = session.apiUrl || this.apiUrl

    // Extract primary mail account
    const accounts = session.accounts || session.primaryAccounts
    if (session.primaryAccounts?.['urn:ietf:params:jmap:mail']) {
      this.accountId = session.primaryAccounts['urn:ietf:params:jmap:mail']
    } else if (accounts && typeof accounts === 'object') {
      this.accountId = Object.keys(accounts)[0] || null
    }

    if (!this.accountId) {
      throw new Error('No JMAP account found in session')
    }
    console.log(`📧 JMAP session OK, accountId: ${this.accountId}`)
  }

  /** Execute a JMAP method call */
  private async call(methodCalls: unknown[][]): Promise<Record<string, unknown>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    try {
      const resp = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({
          using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
          methodCalls,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`JMAP call failed (${resp.status}): ${text}`)
      }
      return await resp.json()
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('JMAP request timeout (60s)')
      }
      throw error
    }
  }

  /** Get current mailbox state for incremental sync */
  async getState(): Promise<string> {
    const result = await this.call([['Email/get', { accountId: this.accountId, ids: [] }, 'state']])
    const responses = (result as { methodResponses?: unknown[][] }).methodResponses || []
    for (const [, response] of responses) {
      if (
        response &&
        typeof response === 'object' &&
        'state' in (response as Record<string, unknown>)
      ) {
        return (response as Record<string, unknown>).state as string
      }
    }
    throw new Error('Could not get JMAP state')
  }

  /** Query new emails since a given state, or fetch recent emails */
  async queryEmails(opts: {
    sinceState?: string | null
    sinceDate?: string | null
    limit?: number
  }): Promise<{ emailIds: string[]; newState: string; hasMore: boolean }> {
    // If we have a previous state, use Email/changes for incremental sync
    if (opts.sinceState) {
      const result = await this.call([
        [
          'Email/changes',
          {
            accountId: this.accountId,
            sinceState: opts.sinceState,
            maxChanges: opts.limit || 50,
          },
          'changes',
        ],
      ])
      const responses = (result as { methodResponses?: unknown[][] }).methodResponses || []
      for (const [method, response] of responses) {
        if (method === 'Email/changes') {
          const r = response as Record<string, unknown>
          return {
            emailIds: ((r.created as string[]) || []).concat((r.updated as string[]) || []),
            newState: r.newState as string,
            hasMore: (r.hasMoreChanges as boolean) || false,
          }
        }
      }
    }

    // Fallback: query by date
    const filter: Record<string, unknown> = {}
    if (opts.sinceDate) {
      filter.after = opts.sinceDate
    }

    const result = await this.call([
      [
        'Email/query',
        {
          accountId: this.accountId,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: opts.limit || 50,
        },
        'query',
      ],
    ])
    const responses = (result as { methodResponses?: unknown[][] }).methodResponses || []
    for (const [method, response] of responses) {
      if (method === 'Email/query') {
        const r = response as Record<string, unknown>
        return {
          emailIds: (r.ids as string[]) || [],
          newState: (r.queryState as string) || '',
          hasMore: ((r.total as number) || 0) > ((r.ids as string[])?.length || 0),
        }
      }
    }
    return { emailIds: [], newState: '', hasMore: false }
  }

  /** Fetch full email data by IDs */
  async getEmails(emailIds: string[]): Promise<JMAPEmail[]> {
    if (emailIds.length === 0) return []

    const result = await this.call([
      [
        'Email/get',
        {
          accountId: this.accountId,
          ids: emailIds,
          properties: [
            'id',
            'blobId',
            'threadId',
            'mailboxIds',
            'from',
            'to',
            'cc',
            'bcc',
            'replyTo',
            'subject',
            'sentAt',
            'receivedAt',
            'textBody',
            'htmlBody',
            'hasAttachment',
            'attachments',
            'messageId',
            'inReplyTo',
            'references',
            'keywords',
            'size',
          ],
          fetchTextBodyValues: true,
          fetchHTMLBodyValues: true,
          maxBodyValueBytes: 256000,
        },
        'emails',
      ],
    ])
    const responses = (result as { methodResponses?: unknown[][] }).methodResponses || []
    for (const [method, response] of responses) {
      if (method === 'Email/get') {
        return ((response as Record<string, unknown>).list as JMAPEmail[]) || []
      }
    }
    return []
  }
}

// ============================================
// Types
// ============================================
interface JMAPEmail {
  id: string
  threadId: string
  messageId?: string[]
  inReplyTo?: string[]
  references?: string[]
  from?: Array<{ name?: string; email: string }>
  to?: Array<{ name?: string; email: string }>
  cc?: Array<{ name?: string; email: string }>
  bcc?: Array<{ name?: string; email: string }>
  replyTo?: Array<{ name?: string; email: string }>
  subject?: string
  sentAt?: string
  receivedAt?: string
  textBody?: Array<{ partId: string; type: string }>
  htmlBody?: Array<{ partId: string; type: string }>
  bodyValues?: Record<string, { value: string }>
  hasAttachment?: boolean
  attachments?: Array<{
    blobId: string
    name?: string
    type: string
    size: number
  }>
  keywords?: Record<string, boolean>
  size?: number
}

// ============================================
// Main handler
// ============================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { account_id, historical_backfill } = parsed.data

    // Fetch account details
    const { data: account, error: accountError } = await supabase.rpc(
      'get_email_account_with_password',
      { p_account_id: account_id }
    )

    if (accountError || !account) {
      throw new Error(`Failed to fetch account: ${accountError?.message || 'not found'}`)
    }

    const stalwartUrl = Deno.env.get('STALWART_URL') || 'http://stalwart:8080'

    console.log(`🔄 JMAP sync starting for ${account.email_address}`)

    // Initialize JMAP client
    const jmap = new JMAPClient(stalwartUrl, account.email_address, account.decrypted_password)
    await jmap.discover(stalwartUrl)

    // Determine sync strategy
    const lastSyncState = account.jmap_sync_state || null
    const sinceDate = historical_backfill
      ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      : account.last_sync_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Query new emails
    const { emailIds, newState, hasMore } = await jmap.queryEmails({
      sinceState: lastSyncState,
      sinceDate: lastSyncState ? null : sinceDate,
      limit: 50,
    })

    console.log(`📨 Found ${emailIds.length} emails to sync, hasMore=${hasMore}`)

    if (emailIds.length === 0) {
      // Update sync state even if no new emails
      await supabase
        .from('user_email_accounts')
        .update({
          last_sync_at: new Date().toISOString(),
          jmap_sync_state: newState || lastSyncState,
        })
        .eq('id', account_id)

      return new Response(JSON.stringify({ success: true, messages_synced: 0, has_more: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch full email data
    const emails = await jmap.getEmails(emailIds)
    console.log(`📧 Fetched ${emails.length} full emails via JMAP`)

    let messagesSynced = 0

    for (const email of emails) {
      try {
        const messageId = email.messageId?.[0] || email.id
        const fromAddr = email.from?.[0]?.email || ''
        const fromName = email.from?.[0]?.name || null
        const toAddresses = (email.to || []).map((a) => a.email)
        const ccAddresses = (email.cc || []).map((a) => a.email)
        const bccAddresses = (email.bcc || []).map((a) => a.email)
        const replyTo = email.replyTo?.[0]?.email || null
        const subject = email.subject || '(sans sujet)'
        const sentDate = email.sentAt || email.receivedAt || new Date().toISOString()
        const receivedDate = email.receivedAt || sentDate

        // Extract body content from bodyValues
        let bodyText: string | null = null
        let bodyHtml: string | null = null

        if (email.bodyValues) {
          if (email.textBody?.[0]?.partId) {
            bodyText = email.bodyValues[email.textBody[0].partId]?.value || null
          }
          if (email.htmlBody?.[0]?.partId) {
            bodyHtml = email.bodyValues[email.htmlBody[0].partId]?.value || null
          }
        }

        const isRead = email.keywords?.['$seen'] || false
        const isDraft = email.keywords?.['$draft'] || false
        const isSent = !!(email.from?.[0]?.email === account.email_address)
        const hasAttachments = email.hasAttachment || false
        const attachmentsCount = email.attachments?.length || 0

        // Build thread identifier from references or subject
        const references = email.references || []
        const inReplyTo = email.inReplyTo?.[0] || null
        const threadKey = email.threadId || messageId

        // Check if message already exists
        const { data: existing } = await supabase
          .from('email_messages')
          .select('id')
          .eq('message_id', messageId)
          .maybeSingle()

        if (existing) {
          continue // Skip already synced
        }

        // Find or create thread
        let threadDbId: string

        // Try to find existing thread by JMAP threadId or references
        const { data: existingThread } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_email_account_id', account_id)
          .eq('thread_id', threadKey)
          .maybeSingle()

        if (existingThread) {
          threadDbId = existingThread.id

          // Update thread metadata
          await supabase
            .from('email_threads')
            .update({
              last_message_date: receivedDate,
              message_count: undefined, // Will be updated via trigger
              updated_at: new Date().toISOString(),
            })
            .eq('id', threadDbId)
        } else {
          // Create new thread
          const allParticipants: Record<string, unknown> = {}
          if (fromAddr) allParticipants[fromAddr] = { name: fromName, type: 'from' }
          for (const to of email.to || []) {
            allParticipants[to.email] = { name: to.name || null, type: 'to' }
          }

          const { data: newThread, error: threadError } = await supabase
            .from('email_threads')
            .insert({
              thread_id: threadKey,
              user_email_account_id: account_id,
              subject,
              participants: allParticipants,
              last_message_date: receivedDate,
              message_count: 1,
              unread_count: isRead ? 0 : 1,
              tags: [],
            })
            .select('id')
            .single()

          if (threadError) {
            console.error(`Failed to create thread for ${messageId}:`, threadError)
            continue
          }
          threadDbId = newThread.id
        }

        // Insert message
        const { error: msgError } = await supabase.from('email_messages').insert({
          thread_id: threadDbId,
          message_id: messageId,
          imap_uid: email.id, // Use JMAP ID as UID equivalent
          from_address: fromAddr,
          from_name: fromName,
          to_addresses: toAddresses,
          cc_addresses: ccAddresses.length > 0 ? ccAddresses : null,
          bcc_addresses: bccAddresses.length > 0 ? bccAddresses : null,
          reply_to: replyTo,
          subject,
          body_text: bodyText,
          body_html: bodyHtml,
          sent_date: sentDate,
          received_date: receivedDate,
          is_read: isRead,
          is_draft: isDraft,
          is_sent: isSent,
          has_attachments: hasAttachments,
          attachments_count: attachmentsCount,
          reference_headers: references.length > 0 ? references : null,
          in_reply_to: inReplyTo,
        })

        if (msgError) {
          console.error(`Failed to insert message ${messageId}:`, msgError)
          continue
        }

        messagesSynced++
      } catch (emailError) {
        console.error(`Error processing email ${email.id}:`, emailError)
      }
    }

    // Update account sync state
    await supabase
      .from('user_email_accounts')
      .update({
        last_sync_at: new Date().toISOString(),
        jmap_sync_state: newState || lastSyncState,
      })
      .eq('id', account_id)

    console.log(`✅ JMAP sync complete: ${messagesSynced} messages synced`)

    return new Response(
      JSON.stringify({
        success: true,
        messages_synced: messagesSynced,
        has_more: hasMore,
        sync_method: 'jmap',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return buildErrorResponse('sync-emails-jmap', error, corsHeaders, 500)
  }
})
