import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { SharedImapClient } from "../_shared/imap-client.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import {
  parseBody,
  cleanText,
  extractBodyContent,
} from "../_shared/mime-decode-fallback.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body for options
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { test_mode = false } = body;

    console.log('🔧 Starting resync of empty emails' + (test_mode ? ' (TEST MODE - 5 emails only)' : ''));

    // Get all messages without content
    let { data: emptyMessages, error: queryError } = await supabase
      .from('email_messages')
      .select(`
        id,
        imap_uid,
        thread:email_threads!inner(
          user_email_account_id
        )
      `)
      .is('body_html', null)
      .is('body_text', null)
      .order('created_at', { ascending: false })
      .limit(test_mode ? 5 : 100);

    if (queryError || !emptyMessages || emptyMessages.length === 0) {
      console.log('No empty messages found');
      return new Response(JSON.stringify({ 
        success: true,
        messages_fixed: 0,
        total_processed: 0,
        message: 'Aucun email vide trouvé'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${emptyMessages.length} empty messages to resync`);

    const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error("EMAIL_ENCRYPTION_KEY not configured");
    }

    // Group messages by account for efficiency
    const messagesByAccount = new Map<string, typeof emptyMessages>();
    for (const msg of emptyMessages) {
      const accountId = msg.thread.user_email_account_id;
      if (!messagesByAccount.has(accountId)) {
        messagesByAccount.set(accountId, []);
      }
      messagesByAccount.get(accountId)!.push(msg);
    }

    console.log(`📊 Processing ${emptyMessages.length} messages across ${messagesByAccount.size} accounts`);

    let fixedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process messages grouped by account
    for (const [accountId, messages] of messagesByAccount) {
      console.log(`\n📧 Processing account ${accountId} (${messages.length} messages)`);
      
      try {
        // Get account credentials
        const { data: account } = await supabase
          .rpc('get_email_account_with_password', { 
            account_uuid: accountId,
            encryption_key: encryptionKey
          })
          .maybeSingle();

        if (!account) {
          console.log(`❌ Account ${accountId} not found, skipping ${messages.length} messages`);
          errorCount += messages.length;
          continue;
        }

        // ========== USE SHARED IMAP CLIENT ==========
        const client = new SharedImapClient();
        try {
          await client.connect(account.imap_host, account.imap_port);
          await client.login(account.email_address, account.password);
          await client.selectMailbox("INBOX");

          // Process each message for this account
          for (const msg of messages) {
            try {
              console.log(`\n  🔍 Processing message ${msg.id} - UID: ${msg.imap_uid}`);

              // Fetch message content
              const headerResponse = await client.fetchHeaders(msg.imap_uid);
              const bodyResponse = await client.fetchBodyPartial(msg.imap_uid, 200 * 1024);

              // Extract content from IMAP responses
              const headers = extractBodyContent(headerResponse, 'HEADER');
              const bodyRaw = extractBodyContent(bodyResponse, 'TEXT');

              if (!headers || !bodyRaw) {
                console.log(`  ⚠️ Could not extract content for message ${msg.id}`);
                errorCount++;
                errors.push(`Message ${msg.id}: Content extraction failed`);
                continue;
              }

              console.log(`  ✓ Headers: ${headers.substring(0, 100).replace(/\n/g, ' ')}...`);
              console.log(`  ✓ Body size: ${bodyRaw.length} bytes`);

              // Combine and parse
              const fullRawMessage = headers + '\r\n\r\n' + bodyRaw;
              const { text, html } = parseBody(fullRawMessage);

              console.log(`  ✓ Parsed - Text: ${text.length} chars, HTML: ${html.length} chars`);

              // Update message with new content
              if (text || html) {
                await supabase
                  .from('email_messages')
                  .update({
                    body_text: text || null,
                    body_html: html || null
                  })
                  .eq('id', msg.id);

                fixedCount++;
                console.log(`  ✅ Fixed message ${msg.id}`);
              } else {
                console.log(`  ⚠️ No content extracted for message ${msg.id}`);
                errorCount++;
                errors.push(`Message ${msg.id}: No text or HTML content found`);
              }

            } catch (err) {
              console.error(`  ❌ Error processing message ${msg.id}:`, err.message);
              errorCount++;
              errors.push(`Message ${msg.id}: ${err.message}`);
            }
          }

        } finally {
          await client.logout();
          console.log(`✓ Disconnected from ${account.email_address}`);
        }

      } catch (err) {
        console.error(`❌ Error processing account ${accountId}:`, err.message);
        errorCount += messages.length;
        errors.push(`Account ${accountId}: ${err.message}`);
      }
    }

    console.log(`\n✅ Resync complete: ${fixedCount} messages fixed, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      messages_fixed: fixedCount,
      total_processed: emptyMessages.length,
      errors: errorCount,
      error_details: errors.slice(0, 10),
      message: test_mode 
        ? `TEST: ${fixedCount} emails réparés sur ${emptyMessages.length}` 
        : `${fixedCount} emails réparés sur ${emptyMessages.length}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    return buildErrorResponse('resync-empty-emails', error, corsHeaders, 500);
  }
});
