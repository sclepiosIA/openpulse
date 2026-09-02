import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient, safeErrorLog } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const {
      email_address,
      password,
      imap_host,
      imap_port,
      smtp_host,
      smtp_port,
      imap_use_ssl,
      smtp_use_ssl,
      target_profile_id  // Optionnel - pour les admins qui configurent les comptes d'autres utilisateurs
    } = await req.json();

    // Le chiffrement est déclaré par l'appelant, et par défaut implicite (SSL/TLS
    // direct), ce qui était le seul comportement possible auparavant. Le déclarer
    // permet enfin d'atteindre les serveurs qui exigent STARTTLS sur 143 ou 587 :
    // ils étaient inaccessibles alors que leurs ports figuraient dans la liste
    // des ports autorisés.
    const imapSsl = imap_use_ssl !== false;
    const smtpSsl = smtp_use_ssl !== false;

    // Déterminer le profile_id cible
    let profileId: string;

    if (target_profile_id) {
      // Vérifier que l'appelant est admin
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
      
      if (adminError || !isAdmin) {
        console.error("Non-admin attempted to use target_profile_id:", user.id);
        return new Response(JSON.stringify({ 
          error: "Seuls les administrateurs peuvent configurer les comptes email d'autres utilisateurs" 
        }), { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      
      // Vérifier que le profil cible existe
      const { data: targetProfile, error: targetError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", target_profile_id)
        .single();
      
      if (targetError || !targetProfile) {
        return new Response(JSON.stringify({ 
          error: "Profil utilisateur cible introuvable" 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      
      profileId = target_profile_id;
      console.log(`Admin ${user.id} configuring email for profile ${target_profile_id}`);
    } else {
      // Comportement par défaut : utiliser le profil de l'appelant
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      profileId = profile.id;
    }

    console.log(`Validating IMAP connection for ${email_address}...`);

    // Le serveur est désormais obligatoire. Il retombait sur un gabarit, qui ne
    // résout pas : la connexion échouait alors avec un message parlant du port,
    // alors que le vrai défaut était l'absence de serveur.
    const imapHostToUse = typeof imap_host === "string" ? imap_host.trim() : "";
    const smtpHostToUse = typeof smtp_host === "string" ? smtp_host.trim() : "";
    if (!imapHostToUse || !smtpHostToUse) {
      return new Response(JSON.stringify({
        error: "Serveurs IMAP et SMTP requis. Renseignez ceux de votre fournisseur."
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const imapPortToUse = imap_port || (imapSsl ? 993 : 143);

    // SSRF protection: validate target host & port before opening any socket
    const ssrfError = await validateImapTarget(imapHostToUse, imapPortToUse);
    if (ssrfError) {
      console.warn(`[connect-email-account] SSRF block: ${ssrfError} for ${imapHostToUse}:${imapPortToUse}`);
      return new Response(JSON.stringify({
        error: "Serveur ou port IMAP non autorisé. Les serveurs sur réseau privé sont refusés par défaut : l'exploitant peut les autoriser avec EMAIL_AUTORISER_RESEAU_PRIVE=true."
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      console.log(`Connecting to IMAP server ${imapHostToUse}:${imapPortToUse}...`);
      const imapConn = await Deno.connect({
        hostname: imapHostToUse,
        port: imapPortToUse
      });

      let imapTls: Deno.TlsConn;
      if (imapSsl) {
        // Chiffrement implicite : la liaison est chiffrée dès l'ouverture.
        imapTls = await Deno.startTls(imapConn, { hostname: imapHostToUse });

        const greeting = new Uint8Array(1024);
        await imapTls.read(greeting);
        console.log("IMAP greeting received:", new TextDecoder().decode(greeting).substring(0, 100));
      } else {
        // STARTTLS : on lit l'accueil en clair, on demande la promotion, et on
        // ne poursuit QUE si le serveur l'accorde. Un serveur qui refuse laisse
        // la liaison en clair : y envoyer le mot de passe serait le divulguer.
        const accueil = new Uint8Array(1024);
        await imapConn.read(accueil);
        console.log("IMAP greeting received:", new TextDecoder().decode(accueil).substring(0, 100));

        await imapConn.write(new TextEncoder().encode("A000 STARTTLS\r\n"));
        const reponse = new Uint8Array(1024);
        await imapConn.read(reponse);
        const texteReponse = new TextDecoder().decode(reponse);
        if (!texteReponse.includes("A000 OK")) {
          imapConn.close();
          throw new Error("STARTTLS refusé par le serveur IMAP");
        }

        imapTls = await Deno.startTls(imapConn, { hostname: imapHostToUse });
      }

      // Send LOGIN command
      const loginCmd = `A001 LOGIN "${email_address}" "${password}"\r\n`;
      await imapTls.write(new TextEncoder().encode(loginCmd));
      
      // Read login response
      const loginResp = new Uint8Array(1024);
      await imapTls.read(loginResp);
      const respText = new TextDecoder().decode(loginResp);
      console.log("IMAP login response:", respText.substring(0, 100));
      
      imapTls.close();
      
      if (!respText.includes('A001 OK')) {
        throw new Error('IMAP authentication failed - invalid credentials');
      }
      
      console.log('✅ IMAP validation successful');
    } catch (imapError) {
      console.error('❌ IMAP validation failed:', safeErrorLog('connect-email-account', imapError));
      return new Response(JSON.stringify({ 
        error: "Échec de connexion IMAP. Vérifiez vos identifiants et paramètres serveur."
      }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");
    if (!encryptionKey) {
      console.error("EMAIL_ENCRYPTION_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Configuration serveur manquante (EMAIL_ENCRYPTION_KEY)" 
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Use service_role client for encryption RPC (restricted to service_role)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Calling encrypt_email_password RPC...");
    const { data: encryptedPassword, error: encryptError } = await serviceClient.rpc("encrypt_email_password", {
      password_to_encrypt: password,
      encryption_key: encryptionKey
    });

    if (encryptError || !encryptedPassword) {
      console.error("Encryption RPC error:", safeErrorLog('connect-email-account', encryptError));
      return new Response(JSON.stringify({ 
        error: "Échec du chiffrement du mot de passe"
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Password encrypted successfully");

    const { data: account, error: insertError } = await supabase
      .from("user_email_accounts")
      .insert({
        profile_id: profileId,
        email_address,
        encrypted_password: encryptedPassword,
        imap_host: imapHostToUse,
        imap_port: imapPortToUse,
        imap_use_ssl: imapSsl,
        smtp_host: smtpHostToUse,
        smtp_port: smtp_port || (smtpSsl ? 465 : 587),
        smtp_use_ssl: smtpSsl,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", safeErrorLog('connect-email-account', insertError));
      return new Response(JSON.stringify({ error: "Erreur lors de la création du compte email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      account: { id: account.id, email_address: account.email_address } 
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in connect-email-account:", safeErrorLog('connect-email-account', error));
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SSRF protection — validate IMAP host/port before opening any TCP/TLS socket
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_IMAP_PORTS = new Set([143, 993, 110, 995, 587, 465, 25]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;                                      // 10.0.0.0/8
  if (a === 127) return true;                                     // loopback
  if (a === 0) return true;                                       // 0.0.0.0/8
  if (a === 169 && b === 254) return true;                        // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true;               // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                        // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;              // CGNAT 100.64.0.0/10
  if (a >= 224) return true;                                      // multicast / reserved
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;  // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;          // ULA fc00::/7
  if (lower.startsWith("ff")) return true;                                    // multicast
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isPrivateOrReservedIPv4(v4);
  }
  return false;
}

/**
 * Autorise les cibles sur réseau privé.
 *
 * Le garde ci-dessous refuse les adresses privées, réservées et les domaines
 * `.local` / `.internal`. C'est la bonne règle pour un service exposé, mais
 * OpenPulse s'auto-héberge : un exploitant qui fait tourner son propre serveur
 * de messagerie sur le même réseau se voyait refuser sa propre boîte, sans
 * recours. La dérogation est explicite, nommée, et fermée par défaut — c'est
 * l'exploitant qui accepte le risque de requête sortante interne, pas nous.
 */
const RESEAU_PRIVE_AUTORISE =
  (Deno.env.get("EMAIL_AUTORISER_RESEAU_PRIVE") ?? "").toLowerCase() === "true";

async function validateImapTarget(host: string, port: number): Promise<string | null> {
  if (typeof host !== "string" || host.length === 0 || host.length > 253) {
    return "invalid hostname";
  }
  if (!Number.isInteger(port) || !ALLOWED_IMAP_PORTS.has(port)) {
    return `port ${port} not allowed`;
  }
  const lowerHost = host.toLowerCase().trim();
  if (RESEAU_PRIVE_AUTORISE) return null;
  if (BLOCKED_HOSTNAMES.has(lowerHost)) return "blocked hostname";
  if (lowerHost.endsWith(".local") || lowerHost.endsWith(".internal")) return "blocked TLD";

  // Direct IP literals
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lowerHost)) {
    return isPrivateOrReservedIPv4(lowerHost) ? "private IPv4 blocked" : null;
  }
  if (lowerHost.includes(":")) {
    return isPrivateOrReservedIPv6(lowerHost) ? "private IPv6 blocked" : null;
  }

  // Hostname → DNS resolution + re-validation
  try {
    const records = await Deno.resolveDns(lowerHost, "A").catch(() => [] as string[]);
    const records6 = await Deno.resolveDns(lowerHost, "AAAA").catch(() => [] as string[]);
    const all = [...records, ...records6];
    if (all.length === 0) return "DNS resolution failed";
    for (const ip of all) {
      if (ip.includes(":") ? isPrivateOrReservedIPv6(ip) : isPrivateOrReservedIPv4(ip)) {
        return `resolved to private/reserved address ${ip}`;
      }
    }
    return null;
  } catch {
    return "DNS lookup error";
  }
}