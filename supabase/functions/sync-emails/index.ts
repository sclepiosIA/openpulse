import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { SharedImapClient } from "../_shared/imap-client.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import {
  decodeHeaderValue,
  decodeEmailContent,
  sanitizeDateString,
  cleanText,
  cleanImapResponse,
  parseEmailAddress,
  parseHeaders,
  extractThreadId,
  parseBody,
  parseAttachments,
  extractCalendarParts,
  type ParsedAttachment,
} from "../_shared/mime-decode-fallback.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-function-secret;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Hoisted for health-tracking (used by outer catch)
  let trackedAccountId: string | null = null;
  let healthClient: ReturnType<typeof createClient> | null = null;
  const recordHealth = async (status: 'success' | 'error', errorMessage?: string) => {
    if (!trackedAccountId || !healthClient) return;
    try {
      await healthClient.rpc('record_email_sync_attempt', {
        _account_id: trackedAccountId,
        _status: status,
        _error_message: errorMessage ?? null,
      });
    } catch (e) {
      console.error('record_email_sync_attempt failed:', (e as Error).message);
    }
  };

  try {
    // Get authorization header for user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Unauthorized: Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Service role client for bypassing RLS on insert operations
    const serviceRoleClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let { account_id, mode, full_resync = false, reconcile_only = false, historical_backfill = false } = await req.json();
    
    // Check if running in CRON mode
    const isCronMode = mode === 'cron';
    
    // For CRON mode, verify secret header
    if (isCronMode) {
      const cronSecret = req.headers.get('X-CRON-Secret');
      const expectedSecret = Deno.env.get('CRON_SECRET');
      
      if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
        console.error('Invalid CRON secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      // CRON mode requires account_id explicitly (orchestrator loops over accounts).
      // L'ancien fallback `accounts[0]` ne synchronisait qu'un seul compte par tick — fix juin 2026.
      if (!account_id) {
        console.error('CRON mode: account_id is required (orchestrator should pass it)');
        return new Response(JSON.stringify({
          error: 'account_id required in CRON mode',
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }



    
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Starting email sync for account ${account_id}...`);
    trackedAccountId = account_id;
    healthClient = serviceRoleClient;

    // Get encryption key
    const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
    if (!encryptionKey) {
      console.error("EMAIL_ENCRYPTION_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Configuration serveur manquante (EMAIL_ENCRYPTION_KEY)" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get email account with decrypted password
    const { data: accountData, error: accountError } = await serviceRoleClient
      .rpc('get_email_account_with_password', { 
        account_uuid: account_id,
        encryption_key: encryptionKey
      })
      .maybeSingle();

    if (accountError || !accountData) {
      console.error("Failed to retrieve account:", accountError);
      return new Response(JSON.stringify({ error: "Account not found or decryption failed" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { email_address, password, imap_host, imap_port, last_uid_synced, last_sync_at } = accountData;
    console.log(`Connecting to IMAP: ${imap_host}:${imap_port} for ${email_address}`);
    console.log(`📅 Last sync: ${last_sync_at || 'never'}, last UID: ${last_uid_synced || 'none'}`);

    // ========== USE SHARED IMAP CLIENT ==========
    const client = new SharedImapClient();
    let syncedCount = 0;
    let newThreadsCount = 0;
    let newLastUid = last_uid_synced || '0';
    
    try {
      await client.connect(imap_host, imap_port);
      
      // Login avec gestion d'erreur d'authentification améliorée
      try {
        await client.login(email_address, password);
      } catch (loginError: any) {
        const errorMsg = loginError?.message || String(loginError);
        if (errorMsg.includes('AUTHENTICATIONFAILED') || errorMsg.includes('Invalid credentials') || errorMsg.includes('Authentication failed')) {
          console.error(`❌ Authentication failed for ${email_address}: ${errorMsg}`);
          await client.logout().catch(() => {});
          return new Response(JSON.stringify({ 
            error: `Authentification échouée pour ${email_address}. Veuillez vérifier le mot de passe dans les paramètres.`,
            auth_failed: true,
            account: email_address
          }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        throw loginError;
      }
      
      // 📬 MULTI-MAILBOX DISCOVERY
      const SENT_KEYWORDS = ['sent', 'envoy', 'envoyés', 'envoyé', 'sent items', 'sent mail', 'elements envoy'];
      const DRAFTS_KEYWORDS = ['draft', 'brouillon'];
      
      let mailboxesToTry: string[] = ["INBOX"];
      
      try {
        const allMailboxes = await client.listMailboxes();
        
        const sentFolders = allMailboxes.filter(mb => {
          const lower = mb.toLowerCase();
          return SENT_KEYWORDS.some(kw => lower.includes(kw)) || lower === '[gmail]/sent mail';
        });
        
        const draftsFolders = allMailboxes.filter(mb => {
          const lower = mb.toLowerCase();
          return DRAFTS_KEYWORDS.some(kw => lower.includes(kw)) || lower === '[gmail]/drafts';
        });
        
        mailboxesToTry = ["INBOX", ...sentFolders, ...draftsFolders];
        console.log(`📧 Discovered mailboxes via LIST: ${mailboxesToTry.join(', ')}`);
      } catch (listError) {
        console.warn(`⚠️ LIST command failed, falling back to static mailbox names:`, listError);
        const isGmail = imap_host.includes('gmail.com') || imap_host.includes('imap.google.com');
        mailboxesToTry = isGmail 
          ? ["INBOX", "[Gmail]/Sent Mail", "[Gmail]/Drafts"]
          : ["INBOX", "Sent", "INBOX.Sent", "Sent Items", "Drafts", "INBOX.Drafts"];
      }
      
      const allServerUids = new Set<string>();
      const uidMailboxMap = new Map<string, string>();
      const uidNumericMap = new Map<string, number>();
      let primaryUidNext = 1;
      
      console.log(`🔍 Discovering mailboxes: ${mailboxesToTry.join(', ')}`);
      
      for (const mailbox of mailboxesToTry) {
        try {
          const { uidNext } = await client.selectMailbox(mailbox);
          console.log(`✅ Mailbox "${mailbox}" accessible, UIDNEXT: ${uidNext}`);
          
          if (mailbox === "INBOX") {
            primaryUidNext = uidNext;
          }
          
          const uidsStr = await client.searchUids('ALL');
          const uids = uidsStr.map(uid => parseInt(uid, 10));
          
          uids.forEach(uid => {
            const compositeKey = `${mailbox}:${uid}`;
            allServerUids.add(compositeKey);
            uidMailboxMap.set(compositeKey, mailbox);
            uidNumericMap.set(compositeKey, uid);
          });
          
          console.log(`📥 Mailbox "${mailbox}": ${uids.length} emails (total unique: ${allServerUids.size})`);
        } catch (err: any) {
          const errorMsg = err?.message || String(err);
          if (errorMsg.includes('BAD') || errorMsg.includes('NO') || mailbox.includes('[Gmail]')) {
            console.log(`⏭️ Mailbox "${mailbox}" not available on this server, skipping gracefully`);
            continue;
          }
          console.log(`⚠️ Mailbox "${mailbox}" error: ${errorMsg}, skipping`);
        }
      }
      
      const uidNext = primaryUidNext;
      console.log(`📊 Multi-mailbox collection complete: ${allServerUids.size} unique emails across all folders`);
      
      // Garde-fou: Si last_uid_synced >= uidNext, réinitialiser
      const lastSyncedNum = last_uid_synced ? parseInt(last_uid_synced, 10) : 0;
      if (lastSyncedNum >= uidNext) {
        console.warn(`⚠️ last_uid_synced (${lastSyncedNum}) >= uidNext (${uidNext}), forcing full resync`);
        full_resync = true;
      }

      // MODE RECONCILIATION SEULE
      if (reconcile_only) {
        console.log(`🔄 Reconcile-only mode: searching ALL emails for deletion detection`);
        
        const allNumericUids = Array.from(allServerUids).map(k => uidNumericMap.get(k)!);
        console.log(`Found ${allNumericUids.length} emails on server`);
        
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        
        const { data: accountThreads } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_email_account_id', account_id);
        
        const threadIds = accountThreads?.map(t => t.id) || [];
        
        const { data: dbMessages } = threadIds.length > 0 ? await supabase
          .from('email_messages')
          .select('id, imap_uid, thread_id, sent_date')
          .in('thread_id', threadIds)
          .not('imap_uid', 'is', null)
          .gte('sent_date', oneYearAgo.toISOString()) : { data: [] };
        
        const dbUids = new Set(dbMessages?.map(m => parseInt(m.imap_uid, 10)) || []);
        const serverUidsSet = new Set(allNumericUids);
        const deletedUids = Array.from(dbUids).filter(uid => !serverUidsSet.has(uid));
        
        console.log(`📊 DB has ${dbUids.size} messages, server has ${serverUidsSet.size} UIDs`);
        
        if (deletedUids.length > 0) {
          console.log(`🗑️ Detected ${deletedUids.length} deleted messages in reconcile mode`);
          
          const threadsToUpdate = new Map<string, number>();
          
          for (const uid of deletedUids) {
            const message = dbMessages?.find(m => parseInt(m.imap_uid, 10) === uid);
            if (message) {
              threadsToUpdate.set(message.thread_id, (threadsToUpdate.get(message.thread_id) || 0) + 1);
              await supabase.from('email_messages').delete().eq('id', message.id);
            }
          }
          
          for (const [threadId] of threadsToUpdate) {
            const { data: msgStats } = await supabase
              .from('email_messages')
              .select('id, is_read, is_sent')
              .eq('thread_id', threadId);
            
            if (!msgStats || msgStats.length === 0) {
              await supabase.from('email_threads').delete().eq('id', threadId);
              console.log(`Thread ${threadId} deleted (no messages left)`);
            } else {
              const { data: lastMessage } = await supabase
                .from('email_messages')
                .select('sent_date')
                .eq('thread_id', threadId)
                .order('sent_date', { ascending: false })
                .limit(1)
                .single();
              
              await supabase
                .from('email_threads')
                .update({
                  message_count: msgStats.length,
                  unread_count: msgStats.filter(m => !m.is_read && !m.is_sent).length,
                  last_message_date: lastMessage?.sent_date || null
                })
                .eq('id', threadId);
                
              console.log(`Thread ${threadId} recalculated after deletion: ${msgStats.length} messages`);
            }
          }
        } else {
          console.log('✅ No deleted messages detected');
        }
        
        await client.logout();
        await recordHealth('success');
        return new Response(JSON.stringify({ 
          message: `Réconciliation terminée : ${deletedUids.length} message(s) supprimé(s)`
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      // Search strategy basée sur historical_backfill, full_resync ou normal
      let recentCompositeUids: string[];
      
      if (historical_backfill) {
        console.log(`🔄 Historical backfill mode: using multi-mailbox collected UIDs`);
        
        const allCompositeKeys = Array.from(allServerUids);
        console.log(`Found ${allCompositeKeys.length} total emails across all mailboxes`);
        
        const { data: accountThreadsBackfill } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_email_account_id', account_id);
        
        const threadIdsBackfill = accountThreadsBackfill?.map(t => t.id) || [];
        
        const { data: allDbMessages } = threadIdsBackfill.length > 0 ? await supabase
          .from('email_messages')
          .select('imap_uid, source_mailbox')
          .in('thread_id', threadIdsBackfill)
          .not('imap_uid', 'is', null) : { data: [] };
        
        const dbCompositeKeys = new Set(allDbMessages?.map(m => `${m.source_mailbox || 'INBOX'}:${m.imap_uid}`) || []);
        console.log(`Database has ${dbCompositeKeys.size} emails already synced`);
        
        recentCompositeUids = allCompositeKeys.filter(k => !dbCompositeKeys.has(k));
        console.log(`📥 ${recentCompositeUids.length} missing emails to download`);
        
        console.log(`
📊 HISTORICAL BACKFILL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Server emails:    ${allCompositeKeys.length}
💾 Database emails:  ${dbCompositeKeys.size}
📥 Missing emails:   ${recentCompositeUids.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
        
      } else if (full_resync) {
        console.log(`🔄 Full resync mode: using multi-mailbox collected UIDs`);
        recentCompositeUids = Array.from(allServerUids);
        console.log(`Found ${recentCompositeUids.length} total emails across mailboxes`);
      } else {
        // Mode incrémental
        const allCompositeKeys = Array.from(allServerUids);
        
        const { data: accountThreadsIncr } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_email_account_id', account_id);
        
        const threadIdsIncr = accountThreadsIncr?.map(t => t.id) || [];
        
        const dbCompositeKeysIncr = new Set<string>();
        if (threadIdsIncr.length > 0) {
          const CHUNK = 50;
          for (let i = 0; i < threadIdsIncr.length; i += CHUNK) {
            const chunk = threadIdsIncr.slice(i, i + CHUNK);
            const { data: msgs } = await supabase
              .from('email_messages')
              .select('imap_uid, source_mailbox')
              .in('thread_id', chunk)
              .not('imap_uid', 'is', null);
            msgs?.forEach(m => dbCompositeKeysIncr.add(`${m.source_mailbox || 'INBOX'}:${m.imap_uid}`));
          }
        }
        
        recentCompositeUids = allCompositeKeys.filter(k => !dbCompositeKeysIncr.has(k));
        
        console.log(`📅 Incremental sync: ${allCompositeKeys.length} server UIDs, ${dbCompositeKeysIncr.size} already in DB, ${recentCompositeUids.length} new to sync`);
        console.log(`📊 Last sync was at: ${last_sync_at || 'never'}`);
      }

      // ========== DÉTECTION DES SUPPRESSIONS ==========
      const allNumericUidsForDeletion = new Set(Array.from(allServerUids).map(k => uidNumericMap.get(k)!));
      
      const oneYearAgoForDeletion = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      
      const { data: accountThreadsDeletion } = await supabase
        .from('email_threads')
        .select('id')
        .eq('user_email_account_id', account_id);
      
      const threadIdsDeletion = accountThreadsDeletion?.map(t => t.id) || [];
      
      const { data: dbMessages } = threadIdsDeletion.length > 0 ? await supabase
        .from('email_messages')
        .select('id, imap_uid, thread_id, sent_date')
        .in('thread_id', threadIdsDeletion)
        .not('imap_uid', 'is', null)
        .gte('sent_date', oneYearAgoForDeletion.toISOString()) : { data: [] };

      const dbUids = new Set(dbMessages?.map(m => parseInt(m.imap_uid, 10)) || []);
      
      const deletedUids = Array.from(dbUids).filter(uid => !allNumericUidsForDeletion.has(uid));
      
      if (deletedUids.length > 0) {
        console.log(`🗑️ Detected ${deletedUids.length} deleted messages, cleaning up...`);
        
        const threadsToRecalc = new Set<string>();
        
        for (const uid of deletedUids) {
          const message = dbMessages?.find(m => parseInt(m.imap_uid, 10) === uid);
          if (message) {
            threadsToRecalc.add(message.thread_id);
            await supabase.from('email_messages').delete().eq('id', message.id);
          }
        }
        
        for (const threadId of threadsToRecalc) {
          const { data: msgStats } = await supabase
            .from('email_messages')
            .select('id, is_read, is_sent')
            .eq('thread_id', threadId);
          
          if (!msgStats || msgStats.length === 0) {
            await supabase.from('email_threads').delete().eq('id', threadId);
            console.log(`Thread ${threadId} deleted (no messages left)`);
          } else {
            const { data: lastMsg } = await supabase
              .from('email_messages')
              .select('sent_date')
              .eq('thread_id', threadId)
              .order('sent_date', { ascending: false })
              .limit(1)
              .single();
            
            await supabase
              .from('email_threads')
              .update({
                message_count: msgStats.length,
                unread_count: msgStats.filter(m => !m.is_read && !m.is_sent).length,
                last_message_date: lastMsg?.sent_date || null
              })
              .eq('id', threadId);
          }
        }
        
        console.log(`✅ Cleanup completed: ${deletedUids.length} messages deleted`);
      }

      // ========== PRÉ-CHARGEMENT DES MESSAGE-IDs EXISTANTS (PAGINÉ) ==========
      console.log(`🔍 Loading existing message_ids from database (paginated)...`);
      
      const existingMessageIds = new Set<string>();
      if (threadIdsDeletion.length > 0) {
        const PAGE_SIZE = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: pageData } = await supabase
            .from('email_messages')
            .select('message_id')
            .in('thread_id', threadIdsDeletion)
            .not('message_id', 'is', null)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          
          if (pageData) {
            pageData.forEach(m => {
              const cleaned = m.message_id?.replace(/[<>]/g, '');
              if (cleaned) existingMessageIds.add(cleaned);
            });
          }
          hasMore = (pageData?.length || 0) === PAGE_SIZE;
          page++;
        }
      }
      console.log(`📊 Found ${existingMessageIds.size} existing message_ids in database`);

      // Filter composite UIDs to sync
      let compositeUidsToSync: string[];
      
      if (historical_backfill) {
        compositeUidsToSync = recentCompositeUids;
        console.log(`📥 Historical backfill: ${compositeUidsToSync.length} missing emails to sync`);
      } else if (full_resync) {
        compositeUidsToSync = recentCompositeUids;
        console.log(`🔄 Full resync mode: ${compositeUidsToSync.length} emails to check`);
      } else {
        compositeUidsToSync = recentCompositeUids;
        console.log(`📧 Incremental sync: ${compositeUidsToSync.length} emails to check (dedup by message_id)`);
      }

      if (compositeUidsToSync.length === 0) {
        console.log("All recent messages synced");
        // 🔧 FIX juin 2026: toujours bumper last_sync_at même sans nouveaux messages,
        // sinon l'orchestrateur garde ce compte en tête de file (NULLS FIRST asc)
        // et le monitoring "stale account" reste faussement alarmant.
        try {
          await serviceRoleClient
            .from('user_email_accounts')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', account_id);
        } catch (e) {
          console.warn('Failed to bump last_sync_at on empty sync:', (e as Error).message);
        }
        await client.logout();
        await recordHealth('success');
        return new Response(JSON.stringify({ 
          success: true, 
          has_more: false, 
          messages_synced: 0,
          last_uid: last_uid_synced,
          message: "Tous les messages récents sont synchronisés"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }


      // 🚀 BATCH PROCESSING
      compositeUidsToSync.sort((a, b) => {
        const uidA = parseInt(a.split(':').pop() || '0', 10);
        const uidB = parseInt(b.split(':').pop() || '0', 10);
        return uidB - uidA;
      });
      const BATCH_SIZE = historical_backfill ? 50 : 30;
      const batchToProcess = compositeUidsToSync.slice(0, BATCH_SIZE);
      console.log(`🔄 Batch processing: ${batchToProcess.length} UIDs (${compositeUidsToSync.length} total remaining)`);
      
      const startTime = Date.now();
      const timeoutMs = 45000;
      let batchSyncedCount = 0;
      let batchNewThreadsCount = 0;
      let lastProcessedUid = last_uid_synced || '0';
      const touchedThreadIds = new Set<string>();
      
      // 📂 Group batch composite UIDs by their source mailbox
      const SENT_FOLDER_NAMES = ['sent', 'inbox.sent', 'sent items', 'sent messages', '[gmail]/sent mail'];
      const batchByMailbox = new Map<string, { uid: number; compositeKey: string }[]>();
      for (const compositeKey of batchToProcess) {
        const mailbox = uidMailboxMap.get(compositeKey) || 'INBOX';
        const uid = uidNumericMap.get(compositeKey)!;
        if (!batchByMailbox.has(mailbox)) batchByMailbox.set(mailbox, []);
        batchByMailbox.get(mailbox)!.push({ uid, compositeKey });
      }
      console.log(`📂 Batch split by mailbox: ${Array.from(batchByMailbox.entries()).map(([m, u]) => `${m}(${u.length})`).join(', ')}`);

      let currentSelectedMailbox = '';
      for (const [fetchMailbox, mailboxUidEntries] of batchByMailbox) {
        // SELECT the correct mailbox before fetching its UIDs
        if (fetchMailbox !== currentSelectedMailbox) {
          await client.selectMailbox(fetchMailbox);
          currentSelectedMailbox = fetchMailbox;
          console.log(`📂 Selected mailbox "${fetchMailbox}" for ${mailboxUidEntries.length} UIDs`);
        }

        const isSentFolder = SENT_FOLDER_NAMES.includes(fetchMailbox.toLowerCase());

      for (const { uid: uidNum, compositeKey: _compositeKey } of mailboxUidEntries) {
        const uidToProcess = String(uidNum);
        
        // Check timeout before each message
        if (Date.now() - startTime > timeoutMs) {
          console.log(`⏱️ Batch timeout reached after ${batchSyncedCount} messages, stopping batch`);
          break;
        }
        
        console.log(`📧 Processing UID ${uidToProcess} (${batchSyncedCount + 1}/${batchToProcess.length})`);
        const messageStartTime = Date.now();
        
        try {
        
          // Step 1: Fetch size to check if message is too large
          const messageSize = await client.fetchSize(uidToProcess);
          
          if (messageSize > 500 * 1024) {
            console.log(`⚠️ Skipping UID ${uidToProcess} - too large (${Math.round(messageSize / 1024)}KB)`);
            lastProcessedUid = uidToProcess;
            continue;
          }
        
          // Step 2: Fetch headers and FLAGS
          const rawHeaders = await client.fetchHeadersAndFlags(uidToProcess);
          
          const flagsMatch = rawHeaders.match(/FLAGS \(([^)]+)\)/i);
          const flags = flagsMatch ? flagsMatch[1].split(' ') : [];
          const isRead = flags.includes('\\Seen');
          
          // Step 3: Fetch partial body (max 200KB)
          const rawBodyPartial = await client.fetchBodyPartial(uidToProcess, 200 * 1024);
          
          const headerMatch = rawHeaders.match(/BODY\[HEADER\] \{(\d+)\}\r\n([\s\S]+)/);
          if (!headerMatch) {
            console.log(`⚠️ Could not parse headers for UID ${uidToProcess} - skipping`);
            lastProcessedUid = uidToProcess;
            continue;
          }
        
          const headerContent = headerMatch[2];
          const headers = parseHeaders(headerContent);
          
          const bodyMatch = rawBodyPartial.match(/BODY\[TEXT\](?:<\d+>)? \{(\d+)\}\r\n([\s\S]+)/);
          const bodyContent = bodyMatch ? bodyMatch[2] : '';
          
          const fullRawMessage = headerContent + '\r\n\r\n' + bodyContent;
          
          const { text, html } = parseBody(fullRawMessage);
          
          const bodyText = text || null;
          const bodyHtml = html || null;
          
          const messageId = headers['message-id']?.replace(/[<>]/g, '') || `${uidToProcess}@${imap_host}`;
          
          // 🛡️ DÉDUPLICATION PAR MESSAGE-ID
          if (existingMessageIds.has(messageId)) {
            console.log(`⏭️ Skipping UID ${uidToProcess} - message_id already exists: ${messageId.substring(0, 50)}...`);
            lastProcessedUid = uidToProcess;
            continue;
          }
          
          const threadId = extractThreadId(headers, messageId);
          const subject = headers['subject'] || '(No Subject)';
          const from = parseEmailAddress(headers['from'] || '');
          const to = headers['to']?.split(',').map(parseEmailAddress) || [];
          const cc = headers['cc']?.split(',').map(parseEmailAddress) || [];
          const isSentMessage = isSentFolder || from.email.toLowerCase() === email_address.toLowerCase();
          const rawDateStr = headers['date'] || new Date().toISOString();
          const dateStr = sanitizeDateString(rawDateStr);
          const attachments: ParsedAttachment[] = [];

          // Check if thread exists
          const { data: existingThread } = await supabase
            .from('email_threads')
            .select('id, etablissement_id, groupe_id, partenaire_id')
            .eq('thread_id', threadId)
            .eq('user_email_account_id', account_id)
            .single();

          let dbThreadId: string;
          let isNewThread = false;
          let existingAff: { etablissement_id: string | null; groupe_id: string | null; partenaire_id: string | null } = {
            etablissement_id: existingThread?.etablissement_id ?? null,
            groupe_id: existingThread?.groupe_id ?? null,
            partenaire_id: existingThread?.partenaire_id ?? null,
          };

          try {
            if (existingThread) {
              dbThreadId = existingThread.id;
            } else {
              isNewThread = true;
              // Create new thread
              const { data: newThread, error: threadError } = await serviceRoleClient
                .from('email_threads')
                .insert({
                  user_email_account_id: account_id,
                  thread_id: threadId,
                  subject,
                  participants: [from, ...to, ...cc].filter(p => p.email),
                  last_message_date: dateStr,
                  message_count: 1,
                  unread_count: isSentMessage ? 0 : 1,
                  ...(isSentMessage && { has_sent_messages: true })
                })
                .select('id')
                .single();

              if (threadError) {
                console.error("Failed to create thread:", threadError);
                throw threadError;
              }

              dbThreadId = newThread.id;
              batchNewThreadsCount++;

              // 🤖 Generate AI title for threads with RE:/TR:/FW: prefix
              if (/^(RE:|TR:|FW:|AW:|SV:|ANT:)/i.test(subject)) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                const functionUrl = `${supabaseUrl}/functions/v1/generate-thread-title`;
                
                console.log(`🤖 Triggering AI title generation for thread ${dbThreadId}`);
                
                fetch(functionUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'x-internal-secret': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
                  },
                  body: JSON.stringify({
                    thread_id: dbThreadId,
                    subject,
                    first_message_content: bodyText?.substring(0, 500) || null
                  })

                }).then(response => {
                  if (!response.ok) {
                    console.error(`⚠️ AI title generation failed for ${dbThreadId}: ${response.status}`);
                  } else {
                    console.log(`✅ AI title generation triggered for ${dbThreadId}`);
                  }
                }).catch((err) => {
                  console.error(`⚠️ Error calling generate-thread-title for ${dbThreadId}:`, err);
                });
              }
            }

            // 🚀 Auto-affiliation via mappings :
            //   - thread nouveau : applique toutes les valeurs trouvées
            //   - thread existant : enrichit uniquement les champs encore NULL
            //     (utile quand un partenaire vient répondre dans un thread créé sans affiliation,
            //      ou pour ajouter partenaire_id à un thread qui n'avait que etablissement_id)
            const fromEmail = from.email.toLowerCase();
            const fromDomain = fromEmail.split('@')[1];
            const genericDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.fr', 'yahoo.com', 'orange.fr', 'free.fr', 'sfr.fr', 'wanadoo.fr', 'laposte.net', 'bbox.fr', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me', 'hotmail.fr', 'live.fr'];
            const internalDomains = ['exploitant.example.org', 'marque.ai'];
            const isFromInternal = internalDomains.includes(fromDomain);

            let affiliationData: { etablissement_id?: string; groupe_id?: string; partenaire_id?: string } | null = null;

            const emailsToCheck = isFromInternal
              ? (to || []).map((t: { email: string }) => t.email.toLowerCase())
              : [fromEmail];

            for (const checkEmail of emailsToCheck) {
              if (affiliationData) break;
              try {
                const { data: specificMapping } = await supabase
                  .from('email_specific_mappings')
                  .select('etablissement_id, groupe_id, partenaire_id, is_unaffiliated')
                  .eq('email_address', checkEmail)
                  .maybeSingle();

                if (specificMapping && !specificMapping.is_unaffiliated) {
                  affiliationData = {
                    etablissement_id: specificMapping.etablissement_id || undefined,
                    groupe_id: specificMapping.groupe_id || undefined,
                    partenaire_id: specificMapping.partenaire_id || undefined
                  };
                  console.log(`📧 Auto-affiliation via email specific mapping: ${checkEmail}`);
                }
              } catch (err) {
                console.error('Error checking email specific mapping:', err);
              }
            }

            const domainsToCheck = isFromInternal
              ? (to || []).map((t: { email: string }) => t.email.toLowerCase().split('@')[1]).filter((d: string) => d && !genericDomains.includes(d) && !internalDomains.includes(d))
              : (fromDomain && !genericDomains.includes(fromDomain) && !internalDomains.includes(fromDomain)) ? [fromDomain] : [];

            for (const checkDomain of domainsToCheck) {
              if (affiliationData) break;
              try {
                const { data: domainMapping } = await supabase
                  .from('email_domain_mappings')
                  .select('etablissement_id, groupe_id, partenaire_id, is_excluded')
                  .eq('domain', checkDomain)
                  .eq('is_excluded', false)
                  .maybeSingle();

                if (domainMapping) {
                  affiliationData = {
                    etablissement_id: domainMapping.etablissement_id || undefined,
                    groupe_id: domainMapping.groupe_id || undefined,
                    partenaire_id: domainMapping.partenaire_id || undefined
                  };
                  console.log(`🌐 Auto-affiliation via domain mapping: ${checkDomain}`);
                }
              } catch (err) {
                console.error('Error checking domain mapping:', err);
              }
            }

            if (affiliationData && (affiliationData.etablissement_id || affiliationData.groupe_id || affiliationData.partenaire_id)) {
              try {
                const updateData: Record<string, string> = {};
                // Nouveau thread : on pose toutes les valeurs trouvées.
                // Thread existant : on n'enrichit que les champs NULL pour ne pas
                //                   écraser une affiliation déjà décidée par l'utilisateur ou l'IA.
                if (affiliationData.etablissement_id && (isNewThread || !existingAff.etablissement_id)) {
                  updateData.etablissement_id = affiliationData.etablissement_id;
                }
                if (affiliationData.groupe_id && (isNewThread || !existingAff.groupe_id)) {
                  updateData.groupe_id = affiliationData.groupe_id;
                }
                if (affiliationData.partenaire_id && (isNewThread || !existingAff.partenaire_id)) {
                  updateData.partenaire_id = affiliationData.partenaire_id;
                }

                if (Object.keys(updateData).length > 0) {
                  await supabase
                    .from('email_threads')
                    .update(updateData)
                    .eq('id', dbThreadId);

                  console.log(`✅ Thread ${dbThreadId} auto-affiliated (${isNewThread ? 'new' : 'enriched'}):`, updateData);
                }
              } catch (err) {
                console.error('Error updating thread affiliation:', err);
              }
            }
          } catch (dateError: any) {
            if (dateError.code === '22007') {
              console.warn(`⚠️ Skipping UID ${uidToProcess}: invalid date format`);
              lastProcessedUid = uidToProcess;
              continue;
            }
            throw dateError;
          }

          // Check if message already exists before upsert
          const { data: existingMessage } = await serviceRoleClient
            .from('email_messages')
            .select('id, is_read')
            .eq('thread_id', dbThreadId)
            .eq('imap_uid', String(uidToProcess))
            .eq('source_mailbox', fetchMailbox)
            .maybeSingle();

          // UPSERT message
          const { data: upsertedMessage, error: insertError } = await serviceRoleClient
            .from('email_messages')
            .upsert({
              thread_id: dbThreadId,
              imap_uid: uidToProcess,
              source_mailbox: fetchMailbox,
              message_id: messageId,
              from_address: from.email,
              from_name: from.name,
              to_addresses: to,
              cc_addresses: cc.length > 0 ? cc : null,
              subject,
              body_text: bodyText || null,
              body_html: bodyHtml || null,
              sent_date: dateStr,
              // received_date = date réelle du mail (header Date), pas la date de sync.
              // Sinon tout backfill/resync ferait remonter d'anciens mails comme "reçus à l'instant".
              received_date: dateStr,
              has_attachments: attachments.length > 0,
              attachments_count: attachments.length,
              in_reply_to: headers['in-reply-to'] || null,
              reference_headers: headers['references']?.split(/\s+/) || null,
              is_read: (existingMessage?.is_read === true) ? true : isRead,
              is_sent: isSentMessage
            }, {
              onConflict: 'thread_id,imap_uid,source_mailbox',
              ignoreDuplicates: false
            })
            .select('id')
            .single();
          
          if (insertError) {
            console.error(`Error inserting message for UID ${uidToProcess}:`, insertError);
            lastProcessedUid = uidToProcess;
            continue;
          }

          batchSyncedCount++;
          touchedThreadIds.add(dbThreadId);

          // 📅 EXTRACT AND SAVE INLINE CALENDAR PARTS AS ATTACHMENTS
          if (upsertedMessage?.id) {
            try {
              let calendarParts = extractCalendarParts(fullRawMessage);
              
              // If no calendar parts found and headers suggest a calendar invitation, re-fetch with larger limit
              if (calendarParts.length === 0) {
                const contentType = (headers['content-type'] || '').toLowerCase();
                const subjectLower = (headers['subject'] || '').toLowerCase();
                const hasCalendarIndicators = 
                  contentType.includes('text/calendar') ||
                  contentType.includes('method=request') ||
                  contentType.includes('method=cancel') ||
                  contentType.includes('method=reply') ||
                  subjectLower.includes('invitation') ||
                  subjectLower.includes('meeting') ||
                  subjectLower.includes('rencontre') ||
                  subjectLower.includes('réunion');
                
                if (hasCalendarIndicators) {
                  console.log(`📅 No calendar parts found in 200KB fetch but headers suggest calendar email - re-fetching with 500KB limit for UID ${uidToProcess}`);
                  try {
                    const rawBodyLarge = await client.fetchBodyPartial(uidToProcess, 500 * 1024);
                    const bodyMatchLarge = rawBodyLarge.match(/BODY\[TEXT\](?:<\d+>)? \{(\d+)\}\r\n([\s\S]+)/);
                    const bodyContentLarge = bodyMatchLarge ? bodyMatchLarge[2] : '';
                    const fullRawMessageLarge = headerContent + '\r\n\r\n' + bodyContentLarge;
                    calendarParts = extractCalendarParts(fullRawMessageLarge);
                    if (calendarParts.length > 0) {
                      console.log(`✅ Found ${calendarParts.length} calendar part(s) in extended fetch`);
                    } else {
                      console.log(`📅 Still no calendar parts found in 500KB fetch`);
                    }
                  } catch (refetchError) {
                    console.error(`⚠️ Error re-fetching larger body for UID ${uidToProcess}:`, refetchError);
                  }
                }
              }
              
              console.log(`📅 Processing ${calendarParts.length} calendar part(s) for message ${upsertedMessage.id}`);
              
              for (let i = 0; i < calendarParts.length; i++) {
                const calPart = calendarParts[i];
                console.log(`📅 Processing calendar part ${i + 1}/${calendarParts.length}: ${calPart.filename} (${calPart.content.length} bytes)`);
                
                const { data: existingAttachment } = await serviceRoleClient
                  .from('email_attachments')
                  .select('id')
                  .eq('message_id', upsertedMessage.id)
                  .eq('mime_type', 'text/calendar')
                  .maybeSingle();
                
                if (existingAttachment) {
                  console.log(`📅 Calendar attachment already exists for message ${upsertedMessage.id}, skipping`);
                  continue;
                }
                
                const storagePath = `${account_id}/${upsertedMessage.id}/${calPart.filename}`;
                
                const { error: uploadError } = await serviceRoleClient.storage
                  .from('email-attachments')
                  .upload(storagePath, new Blob([calPart.content], { type: 'text/calendar' }), {
                    contentType: 'text/calendar',
                    upsert: true
                  });
                
                if (uploadError) {
                  console.error(`❌ Error uploading ICS to storage for message ${upsertedMessage.id}:`, {
                    error: uploadError.message,
                    path: storagePath,
                    bucket: 'email-attachments'
                  });
                  continue;
                }
                
                console.log(`✅ ICS uploaded to storage: ${storagePath}`);
                
                const { error: attachError } = await serviceRoleClient
                  .from('email_attachments')
                  .insert({
                    message_id: upsertedMessage.id,
                    filename: calPart.filename,
                    mime_type: calPart.mimeType,
                    size_bytes: calPart.content.length,
                    storage_path: storagePath,
                    storage_bucket: 'email-attachments',
                    downloaded: true
                  });
                
                if (attachError) {
                  console.error(`❌ Error saving calendar attachment record for message ${upsertedMessage.id}:`, {
                    error: attachError.message,
                    code: attachError.code,
                    details: attachError.details
                  });
                } else {
                  console.log(`✅ Saved calendar attachment record for message ${upsertedMessage.id}`);
                  
                  await serviceRoleClient
                    .from('email_messages')
                    .update({ 
                      has_attachments: true,
                      attachments_count: (attachments.length || 0) + 1
                    })
                    .eq('id', upsertedMessage.id);
                }
              }
            } catch (calError) {
              console.error(`❌ Error extracting calendar parts for message ${upsertedMessage.id}:`, calError);
            }
          }

          // 🆕 DETECT CALENDAR INVITATIONS (async, non-blocking)
          if (upsertedMessage?.id) {
            supabase.functions.invoke('detect-calendar-invitations', {
              body: { message_id: upsertedMessage.id }
            }).catch((err) => {
              console.error(`⚠️ Error detecting calendar invitations for message ${upsertedMessage.id}:`, err);
            });
          }

          // Thread metadata update (inline)
          {
            const threadMetaUpdate: Record<string, any> = {};
            
            if (isSentMessage) {
              threadMetaUpdate.has_sent_messages = true;
            }
            
            const { data: currentThread } = await supabase
              .from('email_threads')
              .select('last_message_date, has_sent_messages')
              .eq('id', dbThreadId)
              .single();
            
            const newMessageDate = new Date(dateStr);
            const currentLastDate = currentThread?.last_message_date ? new Date(currentThread.last_message_date) : null;
            const now = new Date();
            
            if (newMessageDate > now) {
              threadMetaUpdate.last_message_date = now.toISOString();
            } else if (!currentLastDate || newMessageDate > currentLastDate) {
              threadMetaUpdate.last_message_date = dateStr;
            }
            
            if (isSentMessage && !currentThread?.has_sent_messages) {
              threadMetaUpdate.has_sent_messages = true;
            }
            
            if (Object.keys(threadMetaUpdate).length > 0) {
              await supabase
                .from('email_threads')
                .update(threadMetaUpdate)
                .eq('id', dbThreadId);
            }
          }

          lastProcessedUid = uidToProcess;

          // Trigger AI processing for threads linked to establishments (async)
          const { data: threadData } = await supabase
            .from('email_threads')
            .select('etablissement_id, ai_last_processed_at')
            .eq('id', dbThreadId)
            .single();

          if (threadData?.etablissement_id && !threadData.ai_last_processed_at) {
            console.log(`🤖 Triggering AI processing for new thread ${dbThreadId}`);
            supabase.functions.invoke('process-email-with-ai', {
              body: { thread_id: dbThreadId }
            }).then(() => {
              return supabase.functions.invoke('generate-ai-suggestions', {
                body: { 
                  thread_id: dbThreadId,
                  etablissement_id: threadData.etablissement_id 
                }
              });
            }).catch((err) => {
              console.error(`Error in AI pipeline for thread ${dbThreadId}:`, err);
            });
          } else if (threadData?.ai_last_processed_at) {
            console.log(`⏭️ Thread ${dbThreadId} already processed by AI (${threadData.ai_last_processed_at}), skipping...`);
          }
          
          const messageTime = Date.now() - messageStartTime;
          console.log(`✅ UID ${uidToProcess} processed in ${messageTime}ms`);

        } catch (msgError) {
          console.error(`❌ Error processing UID ${uidToProcess}:`, msgError);
          lastProcessedUid = uidToProcess;
          continue;
        }
      }
      } // End of mailbox iteration loop
      
      // ========== ATOMIC COUNTER RECALCULATION POST-BATCH ==========
      if (touchedThreadIds.size > 0) {
        console.log(`🔄 Recalculating counters for ${touchedThreadIds.size} touched threads...`);
        for (const threadId of touchedThreadIds) {
          try {
            const { data: msgStats } = await supabase
              .from('email_messages')
              .select('id, is_read, is_sent')
              .eq('thread_id', threadId);
            
            if (msgStats && msgStats.length > 0) {
              await supabase
                .from('email_threads')
                .update({
                  message_count: msgStats.length,
                  unread_count: msgStats.filter(m => !m.is_read && !m.is_sent).length,
                })
                .eq('id', threadId);
            }
          } catch (err) {
            console.error(`Error recalculating counters for thread ${threadId}:`, err);
          }
        }
        console.log(`✅ Counter recalculation complete for ${touchedThreadIds.size} threads`);
      }
      
      // 🔧 FIX juin 2026: toujours bumper last_sync_at (et last_uid_synced si changé)
      // pour éviter qu'un compte sans nouveaux messages reste figé en tête de file.
      {
        const updatePayload: Record<string, unknown> = { last_sync_at: new Date().toISOString() };
        if (lastProcessedUid !== (last_uid_synced || '0')) {
          updatePayload.last_uid_synced = lastProcessedUid;
        }
        await serviceRoleClient
          .from('user_email_accounts')
          .update(updatePayload)
          .eq('id', account_id);
      }


      await client.logout();

      console.log(`✅ Batch completed: ${batchSyncedCount} messages synced, ${batchNewThreadsCount} new threads`);

      // DÉCLENCHEUR AUTOMATIQUE: Classification automatique après sync
      if (batchSyncedCount > 0) {
        console.log('Starting automatic email classification...');

        try {
          const { data: matchResult, error: matchError } = await supabase.functions.invoke(
            'auto-match-emails',
            { body: { limit: 50 } }
          );

          if (matchError) {
            console.error('Auto-match error:', matchError);
          } else {
            console.log(`Auto-match completed: ${matchResult?.matched || 0} matched, ${matchResult?.suggested || 0} suggested`);
          }
        } catch (err) {
          console.error('Failed to invoke auto-match-emails:', err);
        }
      }

      // 🎫 CRÉATION AUTOMATIQUE DE TICKETS SUPPORT
      const { data: accountInfo } = await supabase
        .from('user_email_accounts')
        .select('email_address, is_shared')
        .eq('id', account_id)
        .single();

      if (accountInfo?.email_address === 'support@exploitant.example.org' && batchNewThreadsCount > 0) {
        console.log('📧 Support email account detected - creating tickets for new threads...');
        
        try {
          const { data: recentThreads } = await supabase
            .from('email_threads')
            .select('id, subject, participants')
            .eq('user_email_account_id', account_id)
            .order('created_at', { ascending: false })
            .limit(batchNewThreadsCount);

          if (recentThreads && recentThreads.length > 0) {
            for (const thread of recentThreads) {
              const fromEmail = Array.isArray(thread.participants) && thread.participants[0]?.email 
                ? thread.participants[0].email 
                : null;
              const fromName = Array.isArray(thread.participants) && thread.participants[0]?.name 
                ? thread.participants[0].name 
                : null;

              const { data: existingTicket } = await supabase
                .from('support_tickets')
                .select('id')
                .eq('email_thread_id', thread.id)
                .maybeSingle();

              if (!existingTicket) {
                console.log(`🎫 Creating support ticket for thread: ${thread.subject}`);
                
                await supabase.functions.invoke('create-support-ticket', {
                  body: {
                    titre: thread.subject || 'Demande de support',
                    description: `Ticket créé automatiquement depuis un email reçu sur support@exploitant.example.org`,
                    email_thread_id: thread.id,
                    contact_email: fromEmail,
                    contact_nom: fromName,
                    source: 'email',
                    priorite: 'moyenne',
                    type_probleme: 'autre',
                    skip_if_duplicate: true
                  }
                });
              }
            }
            console.log(`✅ Support tickets creation completed for ${recentThreads.length} threads`);
          }
        } catch (ticketErr) {
          console.error('Failed to create support tickets:', ticketErr);
        }
      }

      // NOTIFICATIONS PUSH
      if (batchNewThreadsCount > 0) {
        console.log('📱 Sending enriched push notification for new emails...');
        try {
          const serviceSupabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          
          const { data: accountDataPush } = await serviceSupabase
            .from('user_email_accounts')
            .select('profile_id')
            .eq('id', account_id)
            .single();
          
          if (accountDataPush?.profile_id) {
            const { data: profileData } = await serviceSupabase
              .from('profiles')
              .select('user_id')
              .eq('id', accountDataPush.profile_id)
              .single();
            
            if (profileData?.user_id) {
              const { data: recentNewThreads } = await serviceSupabase
                .from('email_threads')
                .select('id, subject, participants, ai_summary, ai_generated_title')
                .eq('user_email_account_id', account_id)
                .order('created_at', { ascending: false })
                .limit(batchNewThreadsCount);

              let pushTitle: string;
              let pushBody: string;
              let threadUrl = '/emails';
              let relatedId: string | null = null;

              if (batchNewThreadsCount === 1 && recentNewThreads?.[0]) {
                const thread = recentNewThreads[0];
                relatedId = thread.id;
                
                const participants = thread.participants as Array<{ name?: string; email?: string }> | null;
                const sender = participants?.[0];
                const senderName = sender?.name || sender?.email?.split('@')[0] || 'Nouveau contact';
                
                const emailSubject = thread.ai_generated_title || thread.subject || 'Sans objet';
                const truncatedSubject = emailSubject.length > 80 ? emailSubject.substring(0, 77) + '...' : emailSubject;
                
                pushTitle = `📧 ${senderName}`;
                pushBody = truncatedSubject;
                threadUrl = `/emails?thread=${thread.id}`;
              } else {
                const senders: string[] = [];
                if (recentNewThreads) {
                  for (const t of recentNewThreads) {
                    const participants = t.participants as Array<{ name?: string; email?: string }> | null;
                    const sender = participants?.[0];
                    const name = sender?.name || sender?.email?.split('@')[0];
                    if (name && !senders.includes(name)) {
                      senders.push(name);
                    }
                  }
                }
                
                const uniqueSenders = senders.slice(0, 2);
                pushTitle = `📧 ${batchNewThreadsCount} nouveaux emails`;
                pushBody = uniqueSenders.length > 0 
                  ? `De ${uniqueSenders.join(', ')}${senders.length > 2 ? '...' : ''}`
                  : 'Consultez votre boîte de réception';
                
                relatedId = recentNewThreads?.[0]?.id || null;
              }

              console.log(`📧 Push content: "${pushTitle}" - "${pushBody}"`);

              const pushResponse = await fetch(
                `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({
                    user_id: profileData.user_id,
                    title: pushTitle,
                    body: pushBody,
                    url: threadUrl,
                    type: 'email',
                    tag: 'new-emails',
                    related_id: relatedId
                  }),
                }
              );
              
              const pushResult = await pushResponse.json();
              console.log('✅ Push notification result:', pushResult);
              
              try {
                await serviceSupabase
                  .from('in_app_notifications')
                  .insert({
                    user_id: profileData.user_id,
                    title: pushTitle,
                    message: pushBody,
                    type: 'email',
                    related_type: 'email_thread',
                    related_id: relatedId,
                    is_read: false
                  });
                console.log('✅ In-app notification created');
              } catch (inAppErr) {
                console.error('Failed to create in-app notification:', inAppErr);
              }
            }
          }
        } catch (pushErr) {
          console.error('Failed to send push notification:', pushErr);
        }
      }

      // Calculate remaining messages after batch
      const remaining = compositeUidsToSync.length - batchToProcess.length;
      const hasMore = remaining > 0;

      await recordHealth('success');
      return new Response(JSON.stringify({
        success: true,
        messages_synced: batchSyncedCount,
        new_threads: batchNewThreadsCount,
        last_uid: lastProcessedUid,
        has_more: hasMore,
        remaining_estimate: remaining,
        message: hasMore 
          ? `${batchSyncedCount} messages synchronisés, environ ${remaining} restants` 
          : `Synchronisation terminée : ${batchSyncedCount} messages traités`
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (imapError) {
      console.error("IMAP connection/sync error:", imapError);
      try {
        await client.logout();
      } catch {}
      await recordHealth('error', `IMAP: ${(imapError as Error).message}`);
      return new Response(JSON.stringify({ 
        error: "Failed to sync emails",
        details: imapError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (error: unknown) {
    await recordHealth('error', (error as Error).message ?? 'unknown');
    return buildErrorResponse('sync-emails', error, corsHeaders, 500);
  }
});

