import { supabase } from '@/integrations/supabase/client';

/**
 * Services storage — helpers pour uploads publics (audit Fable 5).
 * Centralise le pattern `upload -> getPublicUrl` utilisé dans les uploaders UI.
 */
export interface PublicUploadResult {
  path: string;
  publicUrl: string;
}

export const uploadPublicFile = async (
  bucket: string,
  path: string,
  file: File | Blob,
  options: { upsert?: boolean; contentType?: string } = {},
): Promise<PublicUploadResult> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: options.upsert ?? false,
      ...(options.contentType ? { contentType: options.contentType } : {}),
    });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);
  return { path: data.path, publicUrl: urlData.publicUrl };
};

export const removeStorageFile = async (
  bucket: string,
  path: string,
): Promise<void> => {
  await supabase.storage.from(bucket).remove([path]);
};
