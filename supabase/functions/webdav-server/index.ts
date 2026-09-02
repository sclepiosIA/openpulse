import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { origineAutorisee } from '../_shared/cors.ts'
import { createClient } from "@supabase/supabase-js";
import { safeErrorLog } from "../_shared/error-sanitizer.ts";


// ============================================================================
// WebDAV Server - Endpoint pour monter les documents comme lecteur réseau
// Compatible Windows (Explorateur de fichiers), macOS (Finder), Linux (Nautilus/Dolphin)
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Nextcloud backend config
const NEXTCLOUD_URL = normalizeUrl(Deno.env.get("NEXTCLOUD_URL"));
const NEXTCLOUD_USERNAME = Deno.env.get("NEXTCLOUD_USERNAME");
const NEXTCLOUD_APP_PASSWORD = Deno.env.get("NEXTCLOUD_APP_PASSWORD");
const NEXTCLOUD_BASE_FOLDER = normalizeFolder(Deno.env.get("NEXTCLOUD_BASE_FOLDER"));

function normalizeUrl(url: string | undefined): string {
  if (!url) return "";
  let n = url.trim();
  while (n.endsWith("/")) n = n.slice(0, -1);
  return n;
}

function normalizeFolder(folder: string | undefined): string {
  if (!folder || folder.trim() === "") return "/";
  let n = folder.trim();
  if (!n.startsWith("/")) n = "/" + n;
  if (n !== "/" && n.endsWith("/")) n = n.slice(0, -1);
  return n;
}

// Cache for resolved Nextcloud user ID
let resolvedUserId: string | null = null;

async function resolveNextcloudUserId(): Promise<string> {
  if (resolvedUserId) return resolvedUserId;
  if (!NEXTCLOUD_USERNAME) throw new Error("NEXTCLOUD_USERNAME non configuré");
  
  try {
    const ocsUrl = `${NEXTCLOUD_URL}/ocs/v2.php/cloud/user?format=json`;
    const credentials = btoa(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`);
    const response = await fetch(ocsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "OCS-APIRequest": "true",
      },
    });
    if (response.ok) {
      const data = await response.json();
      const detectedId = data?.ocs?.data?.id;
      if (detectedId) {
        resolvedUserId = detectedId;
        return resolvedUserId;
      }
    }
  } catch (_) { /* fallback */ }
  
  resolvedUserId = NEXTCLOUD_USERNAME;
  return resolvedUserId;
}

function getNextcloudAuth(): string {
  return `Basic ${btoa(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`)}`;
}

function buildNextcloudWebDAVUrl(userId: string, path: string): string {
  let cleanPath = path.trim();
  if (cleanPath && !cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
  if (cleanPath !== "/" && cleanPath.endsWith("/")) cleanPath = cleanPath.slice(0, -1);
  if (!cleanPath) cleanPath = "";

  // 🔒 Path traversal guard: reject any `..` segment
  const decodedForCheck = (() => { try { return decodeURIComponent(cleanPath); } catch { return cleanPath; } })();
  if (decodedForCheck.split("/").some((seg) => seg === "..") || decodedForCheck.includes("..")) {
    throw new Error("Invalid path: traversal sequences are not allowed");
  }

  const encodedUserId = encodeURIComponent(userId);
  const baseFolder = NEXTCLOUD_BASE_FOLDER === "/" ? "" : NEXTCLOUD_BASE_FOLDER;
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${encodedUserId}${baseFolder}${cleanPath}`;
}

// ============================================================================
// AUTHENTICATE USER VIA BASIC AUTH → SUPABASE
// ============================================================================

async function authenticateUser(req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  // Support Basic Auth (standard WebDAV auth from OS file managers)
  if (authHeader.startsWith("Basic ")) {
    const decoded = atob(authHeader.replace("Basic ", ""));
    const [email, password] = decoded.split(":");
    
    if (!email || !password) return null;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error || !data.user) {
      console.error("[webdav] Auth failed for:", email, error?.message);
      return null;
    }
    
    return { userId: data.user.id, email: data.user.email || email };
  }
  
  // Support Bearer token (from app)
  if (authHeader.startsWith("Bearer ")) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return null;
    return { userId: user.id, email: user.email || "" };
  }
  
  return null;
}

// ============================================================================
// WebDAV PATH EXTRACTION
// ============================================================================

function extractWebDAVPath(req: Request): string {
  const url = new URL(req.url);
  // Edge function URL: /webdav-server/path/to/file
  // We need to strip the function name prefix
  let path = url.pathname;
  
  // Remove the edge function base path
  const funcPrefix = "/webdav-server";
  if (path.startsWith(funcPrefix)) {
    path = path.substring(funcPrefix.length);
  }
  
  // Decode URI components
  path = decodeURIComponent(path);
  
  if (!path || path === "") path = "/";
  
  return path;
}

// ============================================================================
// XML GENERATION HELPERS
// ============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRFC1123(date: Date): string {
  return date.toUTCString();
}

function generatePropfindResponse(
  href: string,
  isCollection: boolean,
  displayName: string,
  contentLength: number,
  lastModified: string,
  contentType: string,
  etag?: string,
): string {
  const encodedHref = href.split("/").map(s => encodeURIComponent(s)).join("/");
  const hrefPath = isCollection && !encodedHref.endsWith("/") ? encodedHref + "/" : encodedHref;
  
  return `<D:response>
<D:href>${hrefPath}</D:href>
<D:propstat>
<D:prop>
<D:displayname>${escapeXml(displayName)}</D:displayname>
${isCollection ? '<D:resourcetype><D:collection/></D:resourcetype>' : '<D:resourcetype/>'}
${!isCollection ? `<D:getcontentlength>${contentLength}</D:getcontentlength>` : ''}
${!isCollection ? `<D:getcontenttype>${escapeXml(contentType)}</D:getcontenttype>` : ''}
<D:getlastmodified>${lastModified}</D:getlastmodified>
${etag ? `<D:getetag>"${escapeXml(etag)}"</D:getetag>` : ''}
<D:creationdate>${lastModified}</D:creationdate>
</D:prop>
<D:status>HTTP/1.1 200 OK</D:status>
</D:propstat>
</D:response>`;
}

// ============================================================================
// NEXTCLOUD PROXY OPERATIONS
// ============================================================================

interface NextcloudFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  mimeType: string;
  etag?: string;
}

function parseNextcloudPropfind(xml: string, basePath: string, userId: string): NextcloudFile[] {
  const files: NextcloudFile[] = [];
  const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/g;
  const hrefRegex = /<d:href>([^<]+)<\/d:href>/;
  const displayNameRegex = /<d:displayname>([^<]*)<\/d:displayname>/;
  const contentLengthRegex = /<d:getcontentlength>(\d+)<\/d:getcontentlength>/;
  const lastModifiedRegex = /<d:getlastmodified>([^<]+)<\/d:getlastmodified>/;
  const contentTypeRegex = /<d:getcontenttype>([^<]+)<\/d:getcontenttype>/;
  const resourceTypeRegex = /<d:resourcetype>[\s\S]*?<d:collection\s*\/>[\s\S]*?<\/d:resourcetype>/;
  const etagRegex = /<d:getetag>"?([^"<]+)"?<\/d:getetag>/;
  
  const encodedUserId = encodeURIComponent(userId);
  const baseFolder = NEXTCLOUD_BASE_FOLDER === "/" ? "" : NEXTCLOUD_BASE_FOLDER;
  const webdavPrefix = `/remote.php/dav/files/${encodedUserId}${baseFolder}`;
  
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
    const etagMatch = responseXml.match(etagRegex);
    
    files.push({
      name: displayNameMatch?.[1] || relativePath.split("/").pop() || "",
      path: relativePath,
      size: contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0,
      modified: lastModifiedMatch?.[1] || new Date().toUTCString(),
      isDirectory,
      mimeType: isDirectory ? "inode/directory" : (contentTypeMatch?.[1] || "application/octet-stream"),
      etag: etagMatch?.[1],
    });
  }
  
  return files;
}

// ============================================================================
// WEBDAV METHOD HANDLERS
// ============================================================================

async function handleOptions(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      "DAV": "1, 2",
      "Allow": "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, MOVE, COPY",
      "MS-Author-Via": "DAV",
      'Access-Control-Allow-Origin': origineAutorisee(),
      "Access-Control-Allow-Methods": "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, MOVE, COPY",
      "Access-Control-Allow-Headers": "authorization, content-type, depth, destination, overwrite, x-client-info, apikey",
    },
  });
}

async function handlePropfind(path: string, req: Request): Promise<Response> {
  const userId = await resolveNextcloudUserId();
  const depth = req.headers.get("Depth") || "1";
  const ncUrl = buildNextcloudWebDAVUrl(userId, path);
  
  console.log(`[webdav] PROPFIND ${path} (depth: ${depth}) → ${ncUrl}`);
  
  // Forward PROPFIND to Nextcloud
  const ncResponse = await fetch(ncUrl, {
    method: "PROPFIND",
    headers: {
      "Authorization": getNextcloudAuth(),
      "Depth": depth,
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
    <d:getetag/>
    <oc:size/>
  </d:prop>
</d:propfind>`,
  });
  
  if (!ncResponse.ok && ncResponse.status !== 207) {
    await ncResponse.text();
    if (ncResponse.status === 404) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response("Server Error", { status: 502 });
  }
  
  const ncXml = await ncResponse.text();
  const files = parseNextcloudPropfind(ncXml, path, userId);
  
  // Build WebDAV PROPFIND response with our own paths
  const baseFuncPath = "/webdav-server";
  
  // Always include the requested resource itself
  const cleanPath = path === "/" ? "" : path;
  const selfHref = `${baseFuncPath}${cleanPath}/`;
  const selfName = path === "/" ? "Documents" : (path.split("/").pop() || "Documents");
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:">
${generatePropfindResponse(selfHref, true, selfName, 0, formatRFC1123(new Date()), "httpd/unix-directory")}`;
  
  if (depth !== "0") {
    for (const file of files) {
      const fileHref = `${baseFuncPath}${file.path}`;
      xml += generatePropfindResponse(
        fileHref,
        file.isDirectory,
        file.name,
        file.size,
        file.modified,
        file.mimeType,
        file.etag,
      );
    }
  }
  
  xml += `\n</D:multistatus>`;
  
  return new Response(xml, {
    status: 207,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "DAV": "1, 2",
    },
  });
}

async function handleGet(path: string): Promise<Response> {
  const userId = await resolveNextcloudUserId();
  const ncUrl = buildNextcloudWebDAVUrl(userId, path);
  
  console.log(`[webdav] GET ${path} → ${ncUrl}`);
  
  const ncResponse = await fetch(ncUrl, {
    method: "GET",
    headers: {
      "Authorization": getNextcloudAuth(),
    },
  });
  
  if (!ncResponse.ok) {
    await ncResponse.text();
    return new Response("Not Found", { status: ncResponse.status });
  }
  
  const body = await ncResponse.arrayBuffer();
  const contentType = ncResponse.headers.get("Content-Type") || "application/octet-stream";
  const etag = ncResponse.headers.get("ETag");
  const lastModified = ncResponse.headers.get("Last-Modified");
  
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": body.byteLength.toString(),
  };
  if (etag) headers["ETag"] = etag;
  if (lastModified) headers["Last-Modified"] = lastModified;
  
  return new Response(body, { status: 200, headers });
}

async function handlePut(path: string, req: Request): Promise<Response> {
  const userId = await resolveNextcloudUserId();
  
  // Ensure parent directory exists
  const parentPath = path.substring(0, path.lastIndexOf("/"));
  if (parentPath) {
    await ensureDirectory(parentPath, userId);
  }
  
  const ncUrl = buildNextcloudWebDAVUrl(userId, path);
  console.log(`[webdav] PUT ${path} → ${ncUrl}`);
  
  const body = await req.arrayBuffer();
  const contentType = req.headers.get("Content-Type") || "application/octet-stream";
  
  const ncResponse = await fetch(ncUrl, {
    method: "PUT",
    headers: {
      "Authorization": getNextcloudAuth(),
      "Content-Type": contentType,
    },
    body: new Uint8Array(body),
  });
  
  if (!ncResponse.ok && ncResponse.status !== 201 && ncResponse.status !== 204) {
    const text = await ncResponse.text();
    console.error(`[webdav] PUT error ${ncResponse.status}:`, text.substring(0, 300));
    return new Response("Upload failed", { status: 502 });
  }
  
  await ncResponse.text();
  return new Response(null, { status: ncResponse.status === 201 ? 201 : 204 });
}

async function handleDelete(path: string): Promise<Response> {
  const userId = await resolveNextcloudUserId();
  const ncUrl = buildNextcloudWebDAVUrl(userId, path);
  
  console.log(`[webdav] DELETE ${path} → ${ncUrl}`);
  
  const ncResponse = await fetch(ncUrl, {
    method: "DELETE",
    headers: { "Authorization": getNextcloudAuth() },
  });
  
  await ncResponse.text();
  
  if (!ncResponse.ok && ncResponse.status !== 204 && ncResponse.status !== 404) {
    return new Response("Delete failed", { status: 502 });
  }
  
  return new Response(null, { status: 204 });
}

async function handleMkcol(path: string): Promise<Response> {
  const userId = await resolveNextcloudUserId();
  const ncUrl = buildNextcloudWebDAVUrl(userId, path);
  
  console.log(`[webdav] MKCOL ${path} → ${ncUrl}`);
  
  const ncResponse = await fetch(ncUrl, {
    method: "MKCOL",
    headers: { "Authorization": getNextcloudAuth() },
  });
  
  await ncResponse.text();
  
  if (ncResponse.status === 405) {
    return new Response("Already exists", { status: 405 });
  }
  if (!ncResponse.ok && ncResponse.status !== 201) {
    return new Response("Failed to create directory", { status: 502 });
  }
  
  return new Response(null, { status: 201 });
}

async function handleMove(path: string, req: Request): Promise<Response> {
  const destination = req.headers.get("Destination");
  if (!destination) {
    return new Response("Missing Destination header", { status: 400 });
  }
  
  // Extract path from destination URL
  let destPath: string;
  try {
    const destUrl = new URL(destination);
    destPath = decodeURIComponent(destUrl.pathname.replace("/webdav-server", ""));
  } catch {
    destPath = decodeURIComponent(destination.replace("/webdav-server", ""));
  }
  
  const userId = await resolveNextcloudUserId();
  const sourceUrl = buildNextcloudWebDAVUrl(userId, path);
  const destUrl = buildNextcloudWebDAVUrl(userId, destPath);
  
  // Ensure parent directory of destination exists
  const parentPath = destPath.substring(0, destPath.lastIndexOf("/"));
  if (parentPath) {
    await ensureDirectory(parentPath, userId);
  }
  
  console.log(`[webdav] MOVE ${path} → ${destPath}`);
  
  const overwrite = req.headers.get("Overwrite") || "F";
  
  const ncResponse = await fetch(sourceUrl, {
    method: "MOVE",
    headers: {
      "Authorization": getNextcloudAuth(),
      "Destination": destUrl,
      "Overwrite": overwrite,
    },
  });
  
  await ncResponse.text();
  
  if (!ncResponse.ok && ncResponse.status !== 201 && ncResponse.status !== 204) {
    return new Response("Move failed", { status: 502 });
  }
  
  return new Response(null, { status: ncResponse.status === 201 ? 201 : 204 });
}

async function handleCopy(path: string, req: Request): Promise<Response> {
  const destination = req.headers.get("Destination");
  if (!destination) {
    return new Response("Missing Destination header", { status: 400 });
  }
  
  let destPath: string;
  try {
    const destUrl = new URL(destination);
    destPath = decodeURIComponent(destUrl.pathname.replace("/webdav-server", ""));
  } catch {
    destPath = decodeURIComponent(destination.replace("/webdav-server", ""));
  }
  
  const userId = await resolveNextcloudUserId();
  const sourceUrl = buildNextcloudWebDAVUrl(userId, path);
  const destUrl = buildNextcloudWebDAVUrl(userId, destPath);
  
  console.log(`[webdav] COPY ${path} → ${destPath}`);
  
  const overwrite = req.headers.get("Overwrite") || "F";
  
  const ncResponse = await fetch(sourceUrl, {
    method: "COPY",
    headers: {
      "Authorization": getNextcloudAuth(),
      "Destination": destUrl,
      "Overwrite": overwrite,
    },
  });
  
  await ncResponse.text();
  
  if (!ncResponse.ok && ncResponse.status !== 201 && ncResponse.status !== 204) {
    return new Response("Copy failed", { status: 502 });
  }
  
  return new Response(null, { status: ncResponse.status === 201 ? 201 : 204 });
}

async function ensureDirectory(path: string, userId: string): Promise<void> {
  const parts = path.split("/").filter(p => p);
  let currentPath = "";
  
  for (const part of parts) {
    currentPath += `/${part}`;
    const url = buildNextcloudWebDAVUrl(userId, currentPath);
    const response = await fetch(url, {
      method: "MKCOL",
      headers: { "Authorization": getNextcloudAuth() },
    });
    // Consume body
    await response.text();
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  const method = req.method.toUpperCase();
  
  // OPTIONS - always respond (for both CORS and WebDAV discovery)
  if (method === "OPTIONS") {
    return handleOptions();
  }
  
  try {
    // Validate Nextcloud configuration
    if (!NEXTCLOUD_URL || !NEXTCLOUD_USERNAME || !NEXTCLOUD_APP_PASSWORD) {
      return new Response("WebDAV server not configured. Missing Nextcloud credentials.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }
    
    // Authenticate user
    const user = await authenticateUser(req);
    if (!user) {
      // WebDAV clients expect 401 + WWW-Authenticate header to prompt for credentials
      return new Response("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="OpenPulse Documents"',
          "Content-Type": "text/plain",
        },
      });
    }

    // Authorization: shared Nextcloud drive uses a single service identity, so we must
    // restrict access to the roles that legitimately need company-wide document access
    // (admin, direction, rh). Broader internal staff (commercial/csm/chef_projet) go
    // through the app's per-folder document permissions instead.
    {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: roleRows, error: roleErr } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.userId)
        .in("role", ["admin", "direction", "rh"]);
      if (roleErr || !roleRows || roleRows.length === 0) {
        console.warn(`[webdav] Forbidden for ${user.email}`);
        return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } });
      }
    }

    console.log(`[webdav] ${method} from ${user.email}`);
    
    const path = extractWebDAVPath(req);
    
    switch (method) {
      case "PROPFIND":
        return await handlePropfind(path, req);
      
      case "GET":
      case "HEAD":
        return await handleGet(path);
      
      case "PUT":
        return await handlePut(path, req);
      
      case "DELETE":
        return await handleDelete(path);
      
      case "MKCOL":
        return await handleMkcol(path);
      
      case "MOVE":
        return await handleMove(path, req);
      
      case "COPY":
        return await handleCopy(path, req);
      
      case "PROPPATCH":
        // Return success for PROPPATCH (property updates) - we don't store custom props
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:">
<D:response>
<D:href>${escapeXml(path)}</D:href>
<D:propstat>
<D:prop/>
<D:status>HTTP/1.1 200 OK</D:status>
</D:propstat>
</D:response>
</D:multistatus>`, {
          status: 207,
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      
      case "LOCK":
        // Minimal LOCK support for Windows compatibility
        const lockToken = crypto.randomUUID();
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<D:prop xmlns:D="DAV:">
<D:lockdiscovery>
<D:activelock>
<D:locktype><D:write/></D:locktype>
<D:lockscope><D:exclusive/></D:lockscope>
<D:depth>infinity</D:depth>
<D:owner><D:href>${user.email}</D:href></D:owner>
<D:timeout>Second-3600</D:timeout>
<D:locktoken><D:href>opaquelocktoken:${lockToken}</D:href></D:locktoken>
</D:activelock>
</D:lockdiscovery>
</D:prop>`, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Lock-Token": `<opaquelocktoken:${lockToken}>`,
          },
        });
      
      case "UNLOCK":
        return new Response(null, { status: 204 });
      
      default:
        return new Response(`Method ${method} not supported`, { status: 405 });
    }
    
  } catch (error) {
    console.error(safeErrorLog('webdav-server', error));
    return new Response("Internal server error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
});
