import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Paperclip,
  Upload,
  Trash2,
  Download,
  FileText,
  Image,
  File,
  Loader2,
} from 'lucide-react';
import { useRDAttachments, useUploadRDAttachment, useDeleteRDAttachment, useGetAttachmentUrl, type RDAttachment } from '@/hooks/rd/useRDAttachments';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AttachmentsSectionProps {
  entityType: 'user_story' | 'task' | 'epic' | 'projet';
  entityId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  return File;
}

export function AttachmentsSection({ entityType, entityId }: AttachmentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  const { data: attachments, isLoading } = useRDAttachments(entityType, entityId);
  const uploadMutation = useUploadRDAttachment();
  const deleteMutation = useDeleteRDAttachment();
  const getUrl = useGetAttachmentUrl();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    
    for (const file of Array.from(files)) {
      await uploadMutation.mutateAsync({ entityType, entityId, file });
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (attachment: RDAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const url = await getUrl(attachment.storage_path);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.nom;
        link.click();
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          <span>Pièces jointes</span>
          {attachments && attachments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {attachments.length}
            </Badge>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Ajouter
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Attachments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : attachments?.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">
          Aucune pièce jointe
        </p>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {attachments?.map(attachment => {
            const FileIcon = getFileIcon(attachment.type_mime);
            return (
              <Card key={attachment.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-2 flex items-center gap-3">
                  <div className="p-1.5 rounded bg-muted">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.taille)}
                      {' • '}
                      {format(new Date(attachment.created_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleDownload(attachment)}
                      disabled={downloadingId === attachment.id} aria-label="Chargement">
                      {downloadingId === attachment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(attachment)}
                      disabled={deleteMutation.isPending} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
