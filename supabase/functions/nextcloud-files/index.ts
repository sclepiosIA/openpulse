import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// ============================================================================
// CONFIGURATION NEXTCLOUD - AVEC NORMALISATION AUTOMATIQUE
// ============================================================================

// Fonction pour normaliser l'URL de base (supprimer le slash final)
function normalizeBaseUrl(url: string | undefined): string {
  if (!url) return "";
  let normalized = url.trim();
  // Supprimer les slashes finaux
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

// Fonction pour normaliser le base folder (garantir slash initial, pas de slash final)
function normalizeBaseFolder(folder: string | undefined): string {
  if (!folder || folder.trim() === "") return "/";
  let normalized = folder.trim();
  // Garantir un slash initial
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  // Supprimer le slash final (sauf si c'est juste "/")
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

// Configuration Nextcloud depuis les secrets (NORMALISÉS)
const NEXTCLOUD_URL_RAW = Deno.env.get("NEXTCLOUD_URL");
const NEXTCLOUD_USERNAME = Deno.env.get("NEXTCLOUD_USERNAME");
const NEXTCLOUD_APP_PASSWORD = Deno.env.get("NEXTCLOUD_APP_PASSWORD");
const NEXTCLOUD_BASE_FOLDER_RAW = Deno.env.get("NEXTCLOUD_BASE_FOLDER");

// Valeurs normalisées
const NEXTCLOUD_URL = normalizeBaseUrl(NEXTCLOUD_URL_RAW);
const NEXTCLOUD_BASE_FOLDER = normalizeBaseFolder(NEXTCLOUD_BASE_FOLDER_RAW);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cache pour le user ID réel Nextcloud (auto-détecté)
let resolvedUserId: string | null = null;

interface NextcloudFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  mimeType: string;
  etag?: string;
}

// ============================================================================
// AUTO-DÉTECTION DU USER ID NEXTCLOUD VIA OCS API
// ============================================================================
async function resolveNextcloudUserId(): Promise<string> {
  // Si déjà résolu, retourner la valeur en cache
  if (resolvedUserId) return resolvedUserId;
  
  // Sinon, utiliser le username configuré par défaut
  if (!NEXTCLOUD_USERNAME) {
    throw new Error("NEXTCLOUD_USERNAME non configuré");
  }
  
  try {
    // Tenter de récupérer le vrai user ID via l'API OCS
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
      if (detectedId && typeof detectedId === "string") {
        console.log(`[nextcloud-files] User ID auto-détecté: ${detectedId} (config: ${NEXTCLOUD_USERNAME})`);
        resolvedUserId = detectedId;
        return resolvedUserId;
      }
    }
  } catch (err: unknown) {
    console.warn("[nextcloud-files] Impossible d'auto-détecter le user ID, utilisation de NEXTCLOUD_USERNAME:", err);
  }
  
  // Fallback sur le username configuré
  resolvedUserId = NEXTCLOUD_USERNAME;
  return resolvedUserId;
}

// ============================================================================
// FONCTIONS UTILITAIRES WebDAV
// ============================================================================

// Fonction pour construire l'URL WebDAV de manière sécurisée
function buildWebDAVUrl(userId: string, path: string = ""): string {
  // Normaliser le path : garantir slash initial, pas de slash final
  let cleanPath = path.trim();
  if (cleanPath && !cleanPath.startsWith("/")) {
    cleanPath = "/" + cleanPath;
  }
  if (cleanPath !== "/" && cleanPath.endsWith("/")) {
    cleanPath = cleanPath.slice(0, -1);
  }
  if (!cleanPath) cleanPath = "";

  // 🔒 Path traversal guard: reject any `..` segment in the supplied path
  const decodedForCheck = (() => { try { return decodeURIComponent(cleanPath); } catch { return cleanPath; } })();
  if (decodedForCheck.split("/").some((seg) => seg === "..") || decodedForCheck.includes("..")) {
    throw new Error("Invalid path: traversal sequences are not allowed");
  }

  // Encoder le userId pour gérer les caractères spéciaux
  const encodedUserId = encodeURIComponent(userId);

  // Construire l'URL finale
  // Format: {baseUrl}/remote.php/dav/files/{userId}{baseFolder}{path}
  const baseFolder = NEXTCLOUD_BASE_FOLDER === "/" ? "" : NEXTCLOUD_BASE_FOLDER;
  const webdavUrl = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodedUserId}${baseFolder}${cleanPath}`;

  return webdavUrl;
}

// Authentification Basic pour WebDAV
function getAuthHeader(): string {
  const credentials = btoa(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`);
  return `Basic ${credentials}`;
}

// Construire le préfixe WebDAV pour le parsing (doit correspondre exactement à ce que Nextcloud retourne)
function getWebDAVPrefix(userId: string): string {
  const encodedUserId = encodeURIComponent(userId);
  const baseFolder = NEXTCLOUD_BASE_FOLDER === "/" ? "" : NEXTCLOUD_BASE_FOLDER;
  return `/remote.php/dav/files/${encodedUserId}${baseFolder}`;
}

// Parser la réponse PROPFIND XML
function parseWebDAVResponse(xml: string, basePath: string, userId: string): NextcloudFile[] {
  const files: NextcloudFile[] = [];
  
  // Regex simple pour extraire les éléments du XML
  const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/g;
  const hrefRegex = /<d:href>([^<]+)<\/d:href>/;
  const displayNameRegex = /<d:displayname>([^<]*)<\/d:displayname>/;
  const contentLengthRegex = /<d:getcontentlength>(\d+)<\/d:getcontentlength>/;
  const lastModifiedRegex = /<d:getlastmodified>([^<]+)<\/d:getlastmodified>/;
  const contentTypeRegex = /<d:getcontenttype>([^<]+)<\/d:getcontenttype>/;
  const resourceTypeRegex = /<d:resourcetype>[\s\S]*?<d:collection\s*\/>[\s\S]*?<\/d:resourcetype>/;
  const etagRegex = /<d:getetag>"?([^"<]+)"?<\/d:getetag>/;
  
  // Préfixe WebDAV pour extraire les chemins relatifs
  const webdavPrefix = getWebDAVPrefix(userId);
  
  let match;
  while ((match = responseRegex.exec(xml)) !== null) {
    const responseXml = match[1];
    
    const hrefMatch = responseXml.match(hrefRegex);
    if (!hrefMatch) continue;
    
    const href = decodeURIComponent(hrefMatch[1]);
    const isDirectory = resourceTypeRegex.test(responseXml);
    
    // Extraire le chemin relatif
    let relativePath = href.replace(webdavPrefix, "");
    if (relativePath.endsWith("/")) relativePath = relativePath.slice(0, -1);
    
    // Ignorer le dossier racine lui-même
    if (relativePath === "" || relativePath === basePath) continue;
    
    const displayNameMatch = responseXml.match(displayNameRegex);
    const contentLengthMatch = responseXml.match(contentLengthRegex);
    const lastModifiedMatch = responseXml.match(lastModifiedRegex);
    const contentTypeMatch = responseXml.match(contentTypeRegex);
    const etagMatch = responseXml.match(etagRegex);
    
    const name = displayNameMatch?.[1] || relativePath.split("/").pop() || "";
    
    files.push({
      name,
      path: relativePath,
      size: contentLengthMatch ? parseInt(contentLengthMatch[1]) : 0,
      modified: lastModifiedMatch?.[1] || "",
      isDirectory,
      mimeType: isDirectory ? "inode/directory" : (contentTypeMatch?.[1] || "application/octet-stream"),
      etag: etagMatch?.[1],
    });
  }
  
  return files;
}

// ============================================================================
// OPÉRATIONS NEXTCLOUD
// ============================================================================

// Lister les fichiers d'un dossier
async function listFiles(path: string = "/"): Promise<NextcloudFile[]> {
  const userId = await resolveNextcloudUserId();
  const url = buildWebDAVUrl(userId, path);
  
  console.log(`[nextcloud-files] PROPFIND: ${url}`);
  
  const response = await fetch(url, {
    method: "PROPFIND",
    headers: {
      "Authorization": getAuthHeader(),
      "Depth": "1",
      "Content-Type": "application/xml",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
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
  
  if (!response.ok) {
    const text = await response.text();
    console.error(`[nextcloud-files] Erreur PROPFIND ${response.status}:`, text.substring(0, 500));
    
    // Messages d'erreur plus explicites
    if (response.status === 404) {
      if (text.includes("Principal with name") && text.includes("not found")) {
        throw new Error(`Utilisateur WebDAV introuvable. Vérifiez NEXTCLOUD_USERNAME (actuel: ${NEXTCLOUD_USERNAME}). Le WebDAV utilise l'ID utilisateur, pas l'email.`);
      }
      throw new Error(`Dossier Nextcloud introuvable: ${NEXTCLOUD_BASE_FOLDER}${path}. Vérifiez que le dossier existe.`);
    }
    if (response.status === 401) {
      throw new Error("Authentification Nextcloud échouée. Vérifiez NEXTCLOUD_USERNAME et NEXTCLOUD_APP_PASSWORD.");
    }
    throw new Error(`Erreur Nextcloud: ${response.status}`);
  }
  
  const xml = await response.text();
  return parseWebDAVResponse(xml, path, userId);
}

// Uploader un fichier
async function uploadFile(path: string, content: Uint8Array, contentType: string): Promise<void> {
  const userId = await resolveNextcloudUserId();
  
  // S'assurer que le dossier parent existe
  const parentPath = path.substring(0, path.lastIndexOf("/"));
  if (parentPath) {
    await ensureDirectory(parentPath);
  }
  
  const url = buildWebDAVUrl(userId, path);
  console.log(`[nextcloud-files] PUT: ${url}`);
  
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": getAuthHeader(),
      "Content-Type": contentType,
    },
    body: content,
  });
  
  if (!response.ok && response.status !== 201 && response.status !== 204) {
    const text = await response.text();
    console.error(`[nextcloud-files] Erreur PUT ${response.status}:`, text.substring(0, 500));
    throw new Error(`Erreur upload Nextcloud: ${response.status}`);
  }
}

// Créer un dossier récursivement
async function ensureDirectory(path: string): Promise<void> {
  const userId = await resolveNextcloudUserId();
  const parts = path.split("/").filter(p => p);
  let currentPath = "";
  
  for (const part of parts) {
    currentPath += `/${part}`;
    const url = buildWebDAVUrl(userId, currentPath);
    
    const response = await fetch(url, {
      method: "MKCOL",
      headers: {
        "Authorization": getAuthHeader(),
      },
    });
    
    // 201 = créé, 405 = existe déjà
    if (!response.ok && response.status !== 201 && response.status !== 405) {
      console.error(`[nextcloud-files] Erreur MKCOL ${response.status}: ${currentPath}`);
    }
  }
}

// Supprimer un fichier ou dossier
async function deleteFile(path: string): Promise<void> {
  const userId = await resolveNextcloudUserId();
  const url = buildWebDAVUrl(userId, path);
  
  console.log(`[nextcloud-files] DELETE: ${url}`);
  
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": getAuthHeader(),
    },
  });
  
  if (!response.ok && response.status !== 204 && response.status !== 404) {
    const text = await response.text();
    console.error(`[nextcloud-files] Erreur DELETE ${response.status}:`, text.substring(0, 500));
    throw new Error(`Erreur suppression Nextcloud: ${response.status}`);
  }
}

// Déplacer/renommer un fichier
async function moveFile(sourcePath: string, destinationPath: string): Promise<void> {
  const userId = await resolveNextcloudUserId();
  const sourceUrl = buildWebDAVUrl(userId, sourcePath);
  const destinationUrl = buildWebDAVUrl(userId, destinationPath);
  
  // S'assurer que le dossier de destination existe
  const parentPath = destinationPath.substring(0, destinationPath.lastIndexOf("/"));
  if (parentPath) {
    await ensureDirectory(parentPath);
  }
  
  console.log(`[nextcloud-files] MOVE: ${sourceUrl} -> ${destinationUrl}`);
  
  const response = await fetch(sourceUrl, {
    method: "MOVE",
    headers: {
      "Authorization": getAuthHeader(),
      "Destination": destinationUrl,
      "Overwrite": "F",
    },
  });
  
  if (!response.ok && response.status !== 201 && response.status !== 204) {
    const text = await response.text();
    console.error(`[nextcloud-files] Erreur MOVE ${response.status}:`, text.substring(0, 500));
    throw new Error(`Erreur déplacement Nextcloud: ${response.status}`);
  }
}

// Générer un lien de téléchargement direct (URL signée via share)
async function getDownloadUrl(path: string): Promise<string> {
  const userId = await resolveNextcloudUserId();
  
  // Utiliser l'API OCS pour créer un partage temporaire
  const shareUrl = `${NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`;
  
  const sharePath = NEXTCLOUD_BASE_FOLDER === "/" ? path : `${NEXTCLOUD_BASE_FOLDER}${path}`;
  
  const formData = new URLSearchParams();
  formData.append("path", sharePath);
  formData.append("shareType", "3"); // 3 = public link
  formData.append("permissions", "1"); // 1 = read only
  formData.append("expireDate", new Date(Date.now() + 3600000).toISOString().split("T")[0]); // Expire dans 1h
  
  const response = await fetch(shareUrl, {
    method: "POST",
    headers: {
      "Authorization": getAuthHeader(),
      "OCS-APIRequest": "true",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });
  
  if (!response.ok) {
    // Fallback: retourner l'URL WebDAV directe (nécessite auth)
    console.warn("[nextcloud-files] Impossible de créer un partage, utilisation de l'URL directe");
    return buildWebDAVUrl(userId, path);
  }
  
  const xml = await response.text();
  const urlMatch = xml.match(/<url>([^<]+)<\/url>/);
  
  if (urlMatch) {
    return `${urlMatch[1]}/download`;
  }
  
  return buildWebDAVUrl(userId, path);
}

// Télécharger le contenu d'un fichier
async function downloadFile(path: string): Promise<{ content: Uint8Array; mimeType: string }> {
  const userId = await resolveNextcloudUserId();
  const url = buildWebDAVUrl(userId, path);
  
  console.log(`[nextcloud-files] GET: ${url}`);
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": getAuthHeader(),
    },
  });
  
  if (!response.ok) {
    throw new Error(`Erreur téléchargement: ${response.status}`);
  }
  
  const content = new Uint8Array(await response.arrayBuffer());
  const mimeType = response.headers.get("Content-Type") || "application/octet-stream";
  
  return { content, mimeType };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Log de diagnostic (sans credentials)
    console.log(`[nextcloud-files] Configuration:`);
    console.log(`  - NEXTCLOUD_URL: ${NEXTCLOUD_URL || "(non défini)"}`);
    console.log(`  - NEXTCLOUD_USERNAME: ${NEXTCLOUD_USERNAME || "(non défini)"}`);
    console.log(`  - NEXTCLOUD_BASE_FOLDER: ${NEXTCLOUD_BASE_FOLDER}`);
    console.log(`  - APP_PASSWORD: ${NEXTCLOUD_APP_PASSWORD ? "✓ configuré" : "✗ manquant"}`);
    
    // Vérifier la configuration
    if (!NEXTCLOUD_URL) {
      throw new Error("Configuration Nextcloud manquante: NEXTCLOUD_URL non défini. Exemple: https://nextcloud.exploitant.example.org");
    }
    if (!NEXTCLOUD_USERNAME) {
      throw new Error("Configuration Nextcloud manquante: NEXTCLOUD_USERNAME non défini. Utilisez votre ID utilisateur WebDAV.");
    }
    if (!NEXTCLOUD_APP_PASSWORD) {
      throw new Error("Configuration Nextcloud manquante: NEXTCLOUD_APP_PASSWORD non défini. Créez un mot de passe d'application dans Nextcloud.");
    }
    
    // Vérifier l'authentification Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Non authentifié");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Token invalide");
    }
    
    const body = await req.json();
    const { action, path, destinationPath, content, contentType } = body;
    
    console.log(`[nextcloud-files] Action: ${action}, Path: ${path || "/"}, User: ${user.email}`);
    
    let result: unknown;
    
    switch (action) {
      case "list":
        result = await listFiles(path || "/");
        break;
        
      case "upload":
        if (!path || !content) {
          throw new Error("Paramètres manquants pour l'upload");
        }
        // Décoder le contenu base64
        const fileContent = Uint8Array.from(atob(content), c => c.charCodeAt(0));
        await uploadFile(path, fileContent, contentType || "application/octet-stream");
        result = { success: true, path };
        break;
        
      case "delete":
        if (!path) {
          throw new Error("Chemin manquant pour la suppression");
        }
        await deleteFile(path);
        result = { success: true };
        break;
        
      case "move":
        if (!path || !destinationPath) {
          throw new Error("Chemins manquants pour le déplacement");
        }
        await moveFile(path, destinationPath);
        result = { success: true };
        break;
        
      case "mkdir":
        if (!path) {
          throw new Error("Chemin manquant pour la création de dossier");
        }
        await ensureDirectory(path);
        result = { success: true };
        break;
        
      case "download-url":
        if (!path) {
          throw new Error("Chemin manquant pour le téléchargement");
        }
        const downloadUrl = await getDownloadUrl(path);
        result = { url: downloadUrl };
        break;
        
      case "download":
        if (!path) {
          throw new Error("Chemin manquant pour le téléchargement");
        }
        const file = await downloadFile(path);
        // Retourner le contenu en base64
        const base64Content = btoa(String.fromCharCode(...file.content));
        result = { content: base64Content, mimeType: file.mimeType };
        break;
        
      default:
        throw new Error(`Action non supportée: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return buildErrorResponse('nextcloud-files', error, corsHeaders, 500);
  }
});

