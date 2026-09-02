/**
 * JARVIS Email Tools - Send email with account validation and signature
 */

import type { ToolExecutionContext, ToolResult } from "./core-tools.ts";

// ============================================================
// TOOL: send_email (avec validation compte + signature auto)
// ============================================================
export async function executeSendEmail(
  ctx: ToolExecutionContext,
  args: {
    to: string;
    subject?: string;
    body: string;
    thread_id?: string;
    cc?: string[];
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  console.log(`[executeSendEmail] START - profileId: ${ctx.userId}`);
  
  try {
    // Check for user's email account
    const { data: emailAccount, error: accountError } = await ctx.supabase
      .from('user_email_accounts')
      .select('id, email_address')
      .eq('profile_id', ctx.userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (accountError) {
      console.error('[executeSendEmail] Error checking email account:', accountError);
    }

    // If no personal account, look for shared account
    let accountToUse = emailAccount;
    let isSharedAccount = false;
    
    if (!emailAccount) {
      const { data: sharedAccount } = await ctx.supabase
        .from('user_email_accounts')
        .select('id, email_address')
        .eq('is_active', true)
        .eq('is_shared', true)
        .limit(1)
        .maybeSingle();
      
      if (sharedAccount) {
        accountToUse = sharedAccount;
        isSharedAccount = true;
      }
    }

    if (!accountToUse) {
      return {
        success: false,
        error: `❌ **Aucun compte email configuré**\n\nVeuillez configurer un compte email dans **Paramètres > Comptes Email**.`,
        execution_time_ms: Date.now() - start
      };
    }

    // Get user signature
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('email_signature, prenom, nom')
      .eq('id', ctx.userId)
      .single();

    // Helper: detect if content is already HTML
    const isHtml = (text: string): boolean => /<\/?(?:p|div|br|h[1-6]|ul|ol|li|strong|em|a|table|tr|td|th|span|img|hr)\b/i.test(text);

    // Helper: ensure content is HTML (don't escape if already HTML)
    const ensureHtml = (text: string): string => {
      if (isHtml(text)) return text;
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    };

    // Helper: add inline styles to HTML elements for email clients
    const addInlineStyles = (html: string): string => {
      return html
        .replace(/<h3(?:\s|>)/g, '<h3 style="color:#1a1a2e;font-size:18px;font-weight:600;margin:20px 0 10px 0" ')
        .replace(/<h2(?:\s|>)/g, '<h2 style="color:#1a1a2e;font-size:20px;font-weight:700;margin:24px 0 12px 0" ')
        .replace(/<p(?:\s|>)/g, '<p style="margin:0 0 12px 0;line-height:1.6;color:#333" ')
        .replace(/<ul(?:\s|>)/g, '<ul style="margin:8px 0 16px 0;padding-left:24px" ')
        .replace(/<ol(?:\s|>)/g, '<ol style="margin:8px 0 16px 0;padding-left:24px" ')
        .replace(/<li(?:\s|>)/g, '<li style="margin:4px 0;line-height:1.5;color:#333" ')
        .replace(/<strong(?:\s|>)/g, '<strong style="color:#1a1a2e" ')
        .replace(/<em(?:\s|>)/g, '<em style="color:#555" ')
        .replace(/<hr\s*\/?>/g, '<hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0">');
    };

    // Helper: wrap in professional email template
    const wrapInEmailTemplate = (bodyContent: string, signature?: string): string => {
      const sigBlock = signature 
        ? `<tr><td style="padding:24px 32px 32px 32px"><hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 16px 0">${signature}</td></tr>`
        : '';
      return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;max-width:600px;width:100%">
<tr><td style="padding:32px 32px 24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333">
${bodyContent}
</td></tr>
${sigBlock}
</table>
</td></tr>
</table>
</body></html>`;
    };

    // Helper: decode HTML signature
    const decodeSignature = (sig: string): string => {
      let decoded = sig.replace(/<pre><code>/gi, '').replace(/<\/code><\/pre>/gi, '');
      decoded = decoded
        .replace(/&amp;lt;/g, '<')
        .replace(/&amp;gt;/g, '>')
        .replace(/&amp;amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      return decoded.trim();
    };

    // Build HTML body with signature and template
    const styledBody = addInlineStyles(ensureHtml(args.body));
    let emailBody: string;
    
    if (profile?.email_signature) {
      const cleanSignature = decodeSignature(profile.email_signature);
      emailBody = wrapInEmailTemplate(styledBody, cleanSignature);
    } else if (profile?.prenom || profile?.nom) {
      const fullName = [profile.prenom, profile.nom].filter(Boolean).join(' ');
      emailBody = wrapInEmailTemplate(styledBody, `--<br>${fullName}`);
    } else {
      emailBody = wrapInEmailTemplate(styledBody);
    }

    // Use HTTP fetch to send-email function
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        to: args.to,
        subject: args.subject || 'Message de Jarvis',
        html_body: emailBody,
        thread_id: args.thread_id,
        cc: args.cc,
        user_id: ctx.userId,
        account_id: accountToUse.id
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        error: `❌ **Échec de l'envoi**\n\n${data.error || `HTTP ${response.status}`}`,
        execution_time_ms: Date.now() - start
      };
    }

    return {
      success: true,
      data: { 
        message: `Email envoyé avec succès${isSharedAccount ? ' (compte partagé)' : ''}`,
        to: args.to,
        subject: args.subject,
        from: accountToUse.email_address,
        message_id: data.message_id
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
    console.error('[executeSendEmail] EXCEPTION:', errorMessage);
    return {
      success: false,
      error: `❌ **Échec de l'envoi**\n\n${errorMessage}`,
      execution_time_ms: Date.now() - start
    };
  }
}
