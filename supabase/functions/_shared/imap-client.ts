/**
 * Shared IMAP Client - Wrapper around jsr:@workingdevshero/deno-imap
 * Replaces the artisanal IMAPClient class that was duplicated in sync-emails and resync-empty-emails.
 *
 * Uses deno-imap for proper connection management (TLS, auth, timeouts)
 * while exposing the same UID-based interface expected by business logic.
 */
import { ImapClient } from 'jsr:@workingdevshero/deno-imap'

export interface ImapConnectionConfig {
  host: string
  port: number
  username: string
  password: string
}

/**
 * SharedImapClient wraps deno-imap's ImapClient and provides the same
 * method signatures as the artisanal IMAPClient, enabling a drop-in replacement.
 *
 * Uses executeCommand() for UID-based operations since deno-imap's built-in
 * search/fetch use sequence numbers by default.
 */
export class SharedImapClient {
  private client: ImapClient | null = null
  private _host: string = ''
  private _port: number = 993

  /**
   * Connect to the IMAP server (TLS).
   * Note: actual connection + auth happens in login() since deno-imap
   * requires credentials at construction time.
   */
  async connect(hostname: string, port: number): Promise<void> {
    this._host = hostname
    this._port = port
    // Connection deferred to login() since ImapClient needs credentials upfront
    console.log(`IMAP preparing connection to ${hostname}:${port}`)
  }

  /**
   * Authenticate with the IMAP server.
   * This is where the actual connection happens (deno-imap combines connect+auth).
   */
  async login(username: string, password: string): Promise<void> {
    this.client = new ImapClient({
      host: this._host,
      port: this._port,
      tls: true,
      username,
      password,
      commandTimeout: 30000,
      connectionTimeout: 30000,
      socketTimeout: 60000,
      autoReconnect: false, // Edge functions are short-lived
    })

    await this.client.connect()
    await this.client.authenticate()
    console.log('IMAP connected and authenticated via deno-imap')
  }

  /**
   * Select a mailbox and return its UIDNEXT value.
   */
  async selectMailbox(mailbox: string): Promise<{ raw: string; uidNext: number }> {
    const mb = await this.client!.selectMailbox(mailbox)
    const uidNext = mb.uidNext ?? 1
    return { raw: '', uidNext }
  }

  /**
   * Discover all available mailboxes via IMAP LIST command.
   * Returns an array of mailbox names (e.g., ["INBOX", "INBOX.Sent", "INBOX.Drafts"]).
   */
  async listMailboxes(): Promise<string[]> {
    const mailboxes = await this.client!.listMailboxes()
    const names = mailboxes.map((mb) => mb.name)
    console.log(`📂 LIST discovered ${names.length} mailboxes: ${names.join(', ')}`)
    return names
  }

  /**
   * Search for UIDs matching criteria (e.g., 'ALL', 'UNSEEN', 'SINCE 1-Jan-2024').
   * Uses raw UID SEARCH command for compatibility with existing business logic.
   */
  async searchUids(criteria: string): Promise<string[]> {
    const response = await this.executeRaw(`UID SEARCH ${criteria}`)
    const searchMatch = response.match(/\* SEARCH (.+)/)
    if (!searchMatch) return []
    return searchMatch[1]
      .trim()
      .split(' ')
      .filter((uid) => uid.length > 0)
  }

  /**
   * Fetch the RFC822.SIZE of a message by UID.
   */
  async fetchSize(uid: string): Promise<number> {
    const response = await this.executeRaw(`UID FETCH ${uid} (RFC822.SIZE)`)
    const sizeMatch = response.match(/RFC822\.SIZE (\d+)/i)
    return sizeMatch ? parseInt(sizeMatch[1], 10) : 0
  }

  /**
   * Fetch headers and FLAGS of a message by UID.
   */
  async fetchHeadersAndFlags(uid: string): Promise<string> {
    return await this.executeRaw(`UID FETCH ${uid} (FLAGS BODY.PEEK[HEADER])`)
  }

  /**
   * Fetch headers only (without modifying FLAGS) by UID.
   */
  async fetchHeaders(uid: string): Promise<string> {
    return await this.executeRaw(`UID FETCH ${uid} (BODY.PEEK[HEADER])`)
  }

  /**
   * Fetch a partial body (TEXT section) by UID, up to maxBytes.
   */
  async fetchBodyPartial(uid: string, maxBytes: number = 51200): Promise<string> {
    return await this.executeRaw(`UID FETCH ${uid} (BODY.PEEK[TEXT]<0.${maxBytes}>)`)
  }

  /**
   * Disconnect from the IMAP server.
   */
  async logout(): Promise<void> {
    try {
      await this.client?.disconnect()
    } catch (e) {
      // Graceful disconnect - ignore errors
      console.log('IMAP disconnect (graceful):', e instanceof Error ? e.message : e)
    }
    this.client = null
  }

  /**
   * Execute a raw IMAP command and return the response as a single string.
   * Joins response lines with \r\n to match the format expected by parsing functions.
   */
  private async executeRaw(command: string): Promise<string> {
    // Mask credentials in logs
    const logCommand = command.startsWith('LOGIN ') ? 'LOGIN *** ***' : command
    console.log(`> ${logCommand}`)

    const lines = await (
      this.client! as unknown as { executeCommand(command: string): Promise<string[]> }
    ).executeCommand(command)
    const response = lines.join('\r\n')

    console.log(`< ${response.substring(0, 200)}...`)
    return response
  }
}

/**
 * Helper to format a Date for IMAP SEARCH SINCE criterion.
 */
export function formatIMAPDate(date: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}
