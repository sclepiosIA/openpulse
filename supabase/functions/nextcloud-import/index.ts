import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

// Nextcloud config
function normalizeBaseUrl(url: string | undefined): string {
  if (!url) return "";
  let n = url.trim();
  while (n.endsWith("/")) n = n.slice(0, -1);
  return n;
}

function normalizeBaseFolder(folder: string | undefined): string {
  if (!folder || folder.trim() === "") return "/";
  let n = folder.trim();
  if (!n.startsWith("/")) n = "/" + n;
  if (n !== "/" && n.endsWith("/")) n = n.slice(0, -1);
  return n;
}

const NEXTCLOUD_URL = normalizeBaseUrl(Deno.env.get("NEXTCLOUD_URL"));
const NEXTCLOUD_USERNAME = Deno.env.get("NEXTCLOUD_USERNAME");
const NEXTCLOUD_APP_PASSWORD = Deno.env.get("NEXTCLOUD_APP_PASSWORD");
const NEXTCLOUD_BASE_FOLDER = normalizeBaseFolder(Deno.env.get("NEXTCLOUD_BASE_FOLDER"));

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NextcloudFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  mimeType: string;
}

interface ImportStats {
  foldersCreated: number;
  documentsCreated: number;
  skipped: number;
  errors: string[];
}

// Cache for userId
let resolvedUserId: string | null = null;

async function resolveNextcloudUserId(): Promise<string> {
  if (resolvedUserId) return resolvedUserId;
  if (!NEXTCLOUD_USERNAME) throw new Error("NEXTCLOUD_USERNAME non configuré");

  try {
    const ocsUrl = `${NEXTCLOUD_URL}/ocs/v2.php/cloud/user?format=json`;
    const credentials = btoa(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`);
    const response = await fetch(ocsUrl, {
      method: "GET",
      headers: { "Authorization": `Basic ${credentials}`, "OCS-APIRequest": "true" },
    });
    if (response.ok) {
      const data = await response.json();
      const detectedId = data?.ocs?.data?.id;
      if (detectedId && typeof detectedId === "string") {
        resolvedUserId = detectedId;
        return resolvedUserId;
      }
    }
  } catch (_) { /* fallback */ }

  resolvedUserId = NEXTCLOUD_USERNAME;
  return resolvedUserId;
}

function buildWebDAVUrl(userId: string, path: string = ""): string {
  let cleanPath = path.trim();
  if (cleanPath && !cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
  if (cleanPath !== "/" && cleanPath.endsWith("/")) cleanPath = cleanPath.slice(0, -1);
  if (!cleanPath) cleanPath = "";
  const encodedUserId = encodeURIComponent(userId);
  const baseFolder = NEXTCLOUD_BASE_FOLDER === "/" ? "" : NEXTCLOUD_BASE_FOLDER;
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${encodedUserId}${baseFolder}${cleanPath}`;
}

function getAuthHeader(): string {
  return `Basic ${btoa(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`)}`;
}

function getWebDAVPrefix(userId: string): string {
  const encodedUserId = encodeURIComponent(userId);
  const baseFolder = NEXTCLOUD_BASE_FOLDER === "/" ? "" : NEXTCLOUD_BASE_FOLDER;
  return `/remote.php/dav/files/${encodedUserId}${baseFolder}`;
}

function parseWebDAVResponse(xml: string, basePath: string, userId: string): NextcloudFile[] {
  const files: NextcloudFile[] = [];
  const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/g;
  const hrefRegex = /<d:href>([^<]+)<\/d:href>/;
  const displayNameRegex = /<d:displayname>([^<]*)<\/d:displayname>/;
  const contentLengthRegex = /<d:getcontentlength>(\d+)<\/d:getcontentlength>/;
  const lastModifiedRegex = /<d:getlastmodified>([^<]+)<\/d:getlastmodified>/;
  const contentTypeRegex = /<d:getcontenttype>([^<]+)<\/d:getcontenttype>/;
  const resourceTypeRegex = /<d:resourcetype>[\s\S]*?<d:collection\s*\/>[\s\S]*?<\/d:resourcetype>/;
  const webdavPrefix = getWebDAVPrefix(userId);

  let match;
  while ((match = responseRegex.exec(xml)) !== null) {
    const responseXml = match[1];
    const hrefMatch = responseXml.match(hrefRegex);
    if (!hrefMatch) continue;

    const href = decodeURIComponent(hrefMatch[1]);
    const isDirectory = resourceTypeRegex.test(responseXml);
    let relativePath = href.replace(webdavPrefix, "");
    if (relativePath.endsWith("/")) relativePath = relativePath.slice(0, -1);
    if (relativePath === "" || relativePath === basePath) continue;

    const displayNameMatch = responseXml.match(displayNameRegex);
    const contentLengthMatch = responseXml.match(contentLengthRegex);
    const lastModifiedMatch = responseXml.match(lastModifiedRegex);
    const contentTypeMatch = responseXml.match(contentTypeRegex);
    const name = displayNameMatch?.[1] || relativePath.split("/").pop() || "";

    files.push({
      name,
      path: relativePath,
      size: contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0,
      modified: lastModifiedMatch?.[1] || "",
      isDirectory,
      mimeType: isDirectory ? "inode/directory" : (contentTypeMatch?.[1] || "application/octet-stream"),
    });
  }
  return files;
}

async function listFiles(path: string = "/"): Promise<NextcloudFile[]> {
  const userId = await resolveNextcloudUserId();
  const url = buildWebDAVUrl(userId, path);

  const response = await fetch(url, {
    method: "PROPFIND",
    headers: {
      "Authorization": getAuthHeader(),
      "Depth": "1",
      "Content-Type": "application/xml",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:getcontenttype/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur PROPFIND ${response.status}: ${text.substring(0, 200)}`);
  }

  const xml = await response.text();
  return parseWebDAVResponse(xml, path, userId);
}

// Recursive import function
async function importFolder(
  serviceClient: ReturnType<typeof createClient>,
  ncPath: string,
  parentFolderId: string | null,
  ownerId: string,
  stats: ImportStats
): Promise<void> {
  let items: NextcloudFile[];
  try {
    items = await listFiles(ncPath);
  } catch (err) {
    stats.errors.push(`Erreur listage ${ncPath}: ${err.message}`);
    return;
  }

  // Sort: directories first
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, "fr");
  });

  for (const item of items) {
    if (item.isDirectory) {
      // Check if folder already exists
      const { data: existingFolder } = await serviceClient
        .from('document_folders')
        .select('id')
        .eq('name', item.name)
        .eq('folder_type', 'shared')
        .is('parent_folder_id', parentFolderId)
        .maybeSingle();

      let folderId: string;

      if (existingFolder) {
        folderId = existingFolder.id;
        stats.skipped++;
      } else {
        const { data: newFolder, error } = await serviceClient
          .from('document_folders')
          .insert({
            name: item.name,
            parent_folder_id: parentFolderId,
            owner_id: ownerId,
            folder_type: 'shared',
            is_restricted: false,
          })
          .select('id')
          .single();

        if (error) {
          stats.errors.push(`Erreur création dossier ${item.name}: ${error.message}`);
          continue;
        }
        folderId = newFolder.id;
        stats.foldersCreated++;
      }

      // Recurse into subdirectory
      await importFolder(serviceClient, item.path, folderId, ownerId, stats);
    } else {
      // File: check dedup by storage_path
      const storagePath = `nextcloud:${item.path}`;

      const { data: existingDoc } = await serviceClient
        .from('documents')
        .select('id')
        .eq('storage_path', storagePath)
        .maybeSingle();

      if (existingDoc) {
        stats.skipped++;
        continue;
      }

      const { error } = await serviceClient
        .from('documents')
        .insert({
          name: item.name,
          storage_path: storagePath,
          storage_bucket: 'nextcloud',
          mime_type: item.mimeType,
          file_size_bytes: item.size,
          uploaded_by: ownerId,
          folder_id: parentFolderId,
          source_type: 'nextcloud_import',
        });

      if (error) {
        stats.errors.push(`Erreur import ${item.name}: ${error.message}`);
        continue;
      }
      stats.documentsCreated++;
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Nextcloud config
    if (!NEXTCLOUD_URL || !NEXTCLOUD_USERNAME || !NEXTCLOUD_APP_PASSWORD) {
      throw new Error("Configuration Nextcloud manquante. Vérifiez NEXTCLOUD_URL, NEXTCLOUD_USERNAME et NEXTCLOUD_APP_PASSWORD.");
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user via claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await serviceClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const { data: roleCheck } = await serviceClient
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[nextcloud-import] Démarrage import par user ${userId}`);

    const stats: ImportStats = {
      foldersCreated: 0,
      documentsCreated: 0,
      skipped: 0,
      errors: [],
    };

    await importFolder(serviceClient, "/", null, userId, stats);

    console.log(`[nextcloud-import] Terminé:`, stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[nextcloud-import] Erreur:", error);
    return buildErrorResponse('nextcloud-import', error, corsHeaders, 500);
  }
});
