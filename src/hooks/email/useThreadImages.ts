import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

/**
 * Hook to fetch image attachments for an email thread
 */
export function useThreadImages(threadId?: string) {
  const { data: images, isLoading } = useQuery({
    queryKey: ['thread-images', threadId],
    queryFn: async () => {
      if (!threadId) return [];
      
      // Get all messages from the thread
      const { data: messages, error: messagesError } = await supabase
        .from('email_messages')
        .select('id')
        .eq('thread_id', threadId);

      if (messagesError) throw messagesError;
      if (!messages || messages.length === 0) return [];

      const messageIds = messages.map(m => m.id);

      // Get all image attachments from these messages
      const { data: attachments, error: attachmentsError } = await supabase
        .from('email_attachments')
        .select('id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, created_at')
        .in('message_id', messageIds)
        .like('mime_type', 'image/%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (attachmentsError) throw attachmentsError;

      // Generate signed URLs for all images
      const imagesWithUrls = await Promise.all(
        (attachments || []).map(async (attachment) => {
          const { data } = await supabase.storage
            .from('email-attachments')
            .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiry

          return {
            ...attachment,
            url: data?.signedUrl || null,
          };
        })
      );

      return imagesWithUrls.filter(img => img.url !== null);
    },
    enabled: !!threadId,
  });

  return {
    images: images || [],
    isLoading,
  };
}

/**
 * Hook to fetch attachments for a specific message, including resolving CID references
 */
export function useMessageAttachments(messageId: string) {
  const { data: attachments, isLoading } = useQuery({
    queryKey: ['message-attachments', messageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_attachments')
        .select('id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, created_at')
        .eq('message_id', messageId)
        .order('filename')
        .limit(100);

      if (error) throw error;

      // Generate signed URLs for all attachments
      const attachmentsWithUrls = await Promise.all(
        (data || []).map(async (attachment) => {
          const { data: urlData } = await supabase.storage
            .from('email-attachments')
            .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiry

          return {
            ...attachment,
            url: urlData?.signedUrl || null,
          };
        })
      );

      return attachmentsWithUrls;
    },
    enabled: !!messageId,
  });

  /**
   * Resolve a CID (Content-ID) to a signed URL
   * @param cid The Content-ID without the "cid:" prefix
   */
  const resolveCid = (cid: string): string | null => {
    // Silence CID warnings - these are noisy and expected for many emails
    if (!attachments || attachments.length === 0) {
      // Only log in development, not production
      if (import.meta.env.DEV) {
        debug.log('CID resolution skipped - no attachments for:', cid);
      }
      return null;
    }
    
    // CID can be in different formats:
    // - <abc123@example.com> (with angle brackets)
    // - abc123@example.com (without brackets)
    // - just a filename like "image001.png"
    const cleanCid = cid.replace(/^<|>$/g, '').trim();
    
    // Strategy 1: Exact filename match
    let attachment = attachments.find(att => 
      att.filename?.toLowerCase() === cleanCid.toLowerCase()
    );
    
    if (attachment) {
      return attachment.url || null;
    }
    
    // Strategy 2: Filename contains CID
    attachment = attachments.find(att => 
      att.filename?.toLowerCase().includes(cleanCid.toLowerCase())
    );
    
    if (attachment) {
      return attachment.url || null;
    }
    
    // Strategy 3: Storage path contains CID
    attachment = attachments.find(att => 
      att.storage_path?.toLowerCase().includes(cleanCid.toLowerCase())
    );
    
    if (attachment) {
      return attachment.url || null;
    }
    
    // Strategy 4: Try to match the part before @ in email-style CIDs
    if (cleanCid.includes('@')) {
      const cidPrefix = cleanCid.split('@')[0];
      attachment = attachments.find(att => 
        att.filename?.toLowerCase().includes(cidPrefix.toLowerCase()) ||
        att.storage_path?.toLowerCase().includes(cidPrefix.toLowerCase())
      );
      
      if (attachment) {
        return attachment.url || null;
      }
    }
    
    // Strategy 5: If only one image attachment, assume it's the one
    const imageAttachments = attachments.filter(att => 
      att.mime_type?.startsWith('image/')
    );
    
    if (imageAttachments.length === 1) {
      return imageAttachments[0].url || null;
    }
    
    // Silently fail - CID resolution failures are common and expected
    return null;
  };

  return {
    attachments: attachments || [],
    isLoading,
    resolveCid,
  };
}
