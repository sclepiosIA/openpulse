/**
 * JARVIS 12.0 - File Management Tools
 * 
 * Upload, téléchargement, organisation des documents
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeListFiles(ctx: ToolContext, args: {
  bucket?: string;
  folder?: string;
  search?: string;
  file_type?: string;
  limit?: number;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const bucket = args.bucket || 'documents';
    const folder = args.folder || '';

    const { data, error } = await ctx.supabase.storage
      .from(bucket)
      .list(folder, {
        limit: args.limit || 50,
        search: args.search
      });

    if (error) throw error;

    // Filtrer par type si spécifié
    let files = data || [];
    if (args.file_type) {
      const extensions: Record<string, string[]> = {
        'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
        'pdf': ['.pdf'],
        'document': ['.doc', '.docx', '.odt', '.txt', '.rtf'],
        'spreadsheet': ['.xls', '.xlsx', '.csv', '.ods'],
        'presentation': ['.ppt', '.pptx', '.odp']
      };
      const allowedExts = extensions[args.file_type] || [];
      if (allowedExts.length > 0) {
        files = files.filter(f => allowedExts.some(ext => f.name.toLowerCase().endsWith(ext)));
      }
    }

    return { 
      success: true, 
      data: { 
        files: files.map(f => ({
          name: f.name,
          size: f.metadata?.size,
          created_at: f.created_at,
          mime_type: f.metadata?.mimetype,
          path: folder ? `${folder}/${f.name}` : f.name
        })),
        count: files.length,
        bucket,
        folder: folder || '/'
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'List files failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetFileUrl(ctx: ToolContext, args: {
  bucket: string;
  path: string;
  expires_in?: number;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase.storage
      .from(args.bucket)
      .createSignedUrl(args.path, args.expires_in || 3600);

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        url: data.signedUrl,
        expires_in_seconds: args.expires_in || 3600,
        path: args.path,
        bucket: args.bucket
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Get URL failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeMoveFile(ctx: ToolContext, args: {
  bucket: string;
  from_path: string;
  to_path: string;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { error } = await ctx.supabase.storage
      .from(args.bucket)
      .move(args.from_path, args.to_path);

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Fichier déplacé vers ${args.to_path}`,
        from: args.from_path,
        to: args.to_path
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Move failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCopyFile(ctx: ToolContext, args: {
  bucket: string;
  from_path: string;
  to_path: string;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    const { error } = await ctx.supabase.storage
      .from(args.bucket)
      .copy(args.from_path, args.to_path);

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Fichier copié vers ${args.to_path}`,
        from: args.from_path,
        to: args.to_path
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Copy failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeDeleteFile(ctx: ToolContext, args: {
  bucket: string;
  paths: string[];
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    if (args.paths.length === 0) {
      return { success: false, error: 'Aucun fichier spécifié', execution_time_ms: Date.now() - start };
    }

    if (args.paths.length > 10) {
      return { success: false, error: 'Maximum 10 fichiers à supprimer à la fois', execution_time_ms: Date.now() - start };
    }

    const { error } = await ctx.supabase.storage
      .from(args.bucket)
      .remove(args.paths);

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `${args.paths.length} fichier(s) supprimé(s)`,
        deleted: args.paths
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeSearchDocuments(ctx: ToolContext, args: {
  query: string;
  etablissement_id?: string;
  document_type?: string;
  limit?: number;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    let dbQuery = ctx.supabase
      .from('documents')
      .select('id, nom, type, description, storage_path, created_at, etablissement:etablissements(nom)')
      .ilike('nom', `%${args.query}%`)
      .order('created_at', { ascending: false })
      .limit(args.limit || 20);

    if (args.etablissement_id) {
      dbQuery = dbQuery.eq('etablissement_id', args.etablissement_id);
    }
    if (args.document_type) {
      dbQuery = dbQuery.eq('type', args.document_type);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    return { 
      success: true, 
      data: { 
        documents: data,
        count: data?.length || 0,
        query: args.query
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Search failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeGetStorageStats(ctx: ToolContext, args: { bucket?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const buckets = args.bucket ? [args.bucket] : ['documents', 'avatars', 'formations', 'rh-documents'];
    const stats: Record<string, { files: number; folders: string[] }> = {};

    for (const bucket of buckets) {
      try {
        const { data } = await ctx.supabase.storage.from(bucket).list('', { limit: 1000 });
        stats[bucket] = {
          files: data?.filter(f => !f.id?.endsWith('/')).length || 0,
          folders: data?.filter(f => f.id?.endsWith('/')).map(f => f.name) || []
        };
      } catch {
        stats[bucket] = { files: 0, folders: [] };
      }
    }

    return { 
      success: true, 
      data: { 
        buckets: stats,
        total_files: Object.values(stats).reduce((sum, s) => sum + s.files, 0)
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Stats failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCreateFolder(ctx: ToolContext, args: {
  bucket: string;
  folder_path: string;
}): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Supabase storage crée automatiquement les dossiers lors de l'upload
    // On crée un fichier .keep pour matérialiser le dossier
    const { error } = await ctx.supabase.storage
      .from(args.bucket)
      .upload(`${args.folder_path}/.keep`, new Blob([''], { type: 'text/plain' }), {
        upsert: true
      });

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Dossier \"${args.folder_path}\" créé`,
        bucket: args.bucket,
        path: args.folder_path
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Create folder failed', execution_time_ms: Date.now() - start };
  }
}
