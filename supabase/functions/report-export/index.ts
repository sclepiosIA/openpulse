// Edge function: report-export — génère un PDF (HTML) ou Excel (XLSX) à partir d'un dashboard custom
// Supporte aussi le mode "scheduled" (envoi par email aux destinataires planifiés)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildErrorResponse as _buildErrorResponse } from "../_shared/error-sanitizer.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

import { getCorsHeaders } from '../_shared/cors.ts'

// Cette fonction accepte un en-tete qui lui est propre, x-scheduled-export-id.
// La consolidation CORS avait remplace son objet local par la constante
// partagee et le lui avait fait perdre : son prevol aurait refuse les exports
// planifies. On repart du socle (origine autorisee, methodes, cache, Vary) et
// on n'elargit que la liste des en-tetes acceptes.
const corsHeaders = {
  ...getCorsHeaders(null),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-internal-secret, x-scheduled-export-id',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { dashboard_id, format, filters = {}, scheduled_export_id, recipients } = body;
    if (!dashboard_id || !['pdf', 'xlsx'].includes(format)) {
      return json({ error: 'Invalid params' }, 400);
    }

    const isScheduled = !!scheduled_export_id;
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const cronHeader = req.headers.get('X-CRON-Secret');
    const hasCronAuth = !!(cronSecret && cronHeader && cronHeader === cronSecret);

    // Authentication gate: require either CRON secret (scheduled) OR a valid authenticated JWT
    if (!hasCronAuth) {
      if (!authHeader?.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const token = authHeader.replace('Bearer ', '').trim();
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub || claimsData.claims.role !== 'authenticated') {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    // En mode scheduled (cron authentifié), service role pour bypass RLS.
    // En mode interactif, JWT utilisateur (RLS appliqué).
    const supabase = isScheduled && hasCronAuth
      ? createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      : createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader || '' } } }
        );

    // Charger le dashboard
    const { data: dashboard, error: dErr } = await supabase
      .from('custom_dashboards').select('*').eq('id', dashboard_id).maybeSingle();
    if (dErr || !dashboard) return json({ error: 'Dashboard not found' }, 404);

    // Résoudre chaque widget
    const resolved: Array<{ widget: any; rows: any[] }> = [];
    for (const w of (dashboard.widgets || [])) {
      if (!w.source) { resolved.push({ widget: w, rows: [] }); continue; }
      try {
        const { data } = await supabase.rpc('get_report_data', {
          source_key: w.source,
          params: { ...(dashboard.filters_schema || {}), ...filters },
        });
        resolved.push({ widget: w, rows: (data?.rows || []) });
      } catch {
        resolved.push({ widget: w, rows: [] });
      }
    }

    let fileBytes: Uint8Array;
    let mime: string;
    let ext: string;

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      for (const { widget, rows } of resolved) {
        const safeName = (widget.title || widget.id).slice(0, 28).replace(/[\\/*?:[\]]/g, '_');
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: 'Aucune donnée' }]);
        XLSX.utils.book_append_sheet(wb, ws, safeName || 'Widget');
      }
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      fileBytes = new Uint8Array(buf);
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    } else {
      // PDF basique : HTML imprimable. Pour un vrai PDF natif, utiliser un service Puppeteer dédié.
      const html = renderHtml(dashboard, resolved);
      fileBytes = new TextEncoder().encode(html);
      mime = 'text/html';
      ext = 'html';
    }

    // Upload vers storage
    const fileName = `${dashboard.id}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('reports-exports')
      .upload(fileName, fileBytes, { contentType: mime, upsert: false });

    if (upErr) {
      const b64 = btoa(String.fromCharCode(...fileBytes));
      return json({
        url: `data:${mime};base64,${b64}`,
        filename: fileName,
        warning: 'Stored inline (upload failed)',
      });
    }

    const { data: signed } = await supabase.storage
      .from('reports-exports')
      .createSignedUrl(fileName, 3600);

    const downloadUrl = signed?.signedUrl;

    // Mode scheduled : envoi par email aux destinataires
    if (isScheduled && downloadUrl && Array.isArray(recipients) && recipients.length > 0) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: recipients,
            subject: `📊 Rapport : ${dashboard.nom}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#1e3a8a;">${escape(dashboard.nom)}</h2>
                ${dashboard.description ? `<p style="color:#6b7280;">${escape(dashboard.description)}</p>` : ''}
                <p>Votre rapport planifié est disponible :</p>
                <p style="margin:24px 0;">
                  <a href="${downloadUrl}" style="background:#1e40af;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
                    Télécharger le rapport (${format.toUpperCase()})
                  </a>
                </p>
                <p style="font-size:11px;color:#9ca3af;">Ce lien expire dans 1 heure. Généré le ${new Date().toLocaleString('fr-FR')}.</p>
              </div>
            `,
          },
        });
        await supabase.from('custom_dashboard_exports').update({
          last_status: 'sent',
          error_message: null,
        }).eq('id', scheduled_export_id);
      } catch (e: any) {
        console.error('[report-export] email failed', e);
        await supabase.from('custom_dashboard_exports').update({
          last_status: 'error',
          error_message: String(e?.message || e).slice(0, 500),
        }).eq('id', scheduled_export_id);
      }
    } else if (isScheduled) {
      await supabase.from('custom_dashboard_exports').update({ last_status: 'success' }).eq('id', scheduled_export_id);
    }

    return json({ url: downloadUrl, filename: fileName });
  } catch (e: any) {
    console.error('[report-export]', e);
    return json({ error: 'Export failed' }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escape(s: string): string {
  return String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]!));
}

function renderHtml(dashboard: any, widgets: Array<{ widget: any; rows: any[] }>): string {
  const sections = widgets.map(({ widget, rows }) => {
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    const tableRows = rows.slice(0, 200).map(r =>
      `<tr>${cols.map(c => `<td>${escape(String(r[c] ?? ''))}</td>`).join('')}</tr>`
    ).join('');
    return `
      <section style="page-break-inside:avoid;margin-bottom:24px;">
        <h2 style="font-size:14pt;color:#1e40af;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">${escape(widget.title)}</h2>
        ${cols.length ? `
          <table style="width:100%;border-collapse:collapse;font-size:9pt;">
            <thead><tr>${cols.map(c => `<th style="background:#f3f4f6;padding:6px;text-align:left;border:1px solid #e5e7eb;">${escape(c)}</th>`).join('')}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>` : '<p style="color:#9ca3af;font-size:10pt;">Aucune donnée</p>'}
      </section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(dashboard.nom)}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111827;}h1{color:#1e3a8a;}@media print{body{padding:0;}}</style>
    </head><body>
      <h1>${escape(dashboard.nom)}</h1>
      ${dashboard.description ? `<p style="color:#6b7280;">${escape(dashboard.description)}</p>` : ''}
      <p style="font-size:9pt;color:#9ca3af;">Généré le ${new Date().toLocaleString('fr-FR')}</p>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      ${sections}
    </body></html>`;
}
