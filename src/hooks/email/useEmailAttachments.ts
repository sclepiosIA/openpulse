import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export function useEmailAttachments(messageId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['email-attachments', messageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_attachments')
        .select('id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, downloaded, imap_part_id, created_at')
        .eq('message_id', messageId)
        .order('filename');

      if (error) throw error;
      return data;
    },
    enabled: !!messageId,
  });

  const downloadAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { data, error } = await supabase.functions.invoke('download-attachment', {
        body: { attachment_id: attachmentId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, attachmentId) => {
      toast({
        title: "Pièce jointe téléchargée",
        description: `${data.filename} est maintenant disponible`,
      });
      queryClient.invalidateQueries({ queryKey: ['email-attachments', messageId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de téléchargement",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const getAttachmentUrl = async (storagePath: string) => {
    const { data } = await supabase.storage
      .from('email-attachments')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    return data?.signedUrl;
  };

  return {
    attachments: attachments || [],
    isLoading,
    downloadAttachment: downloadAttachment.mutate,
    isDownloading: downloadAttachment.isPending,
    getAttachmentUrl,
  };
}
