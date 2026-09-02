import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Image as ImageIcon, File, FolderPlus, Loader2, Eye } from "lucide-react";
import { useEmailAttachments } from "@/hooks/email/useEmailAttachments";
import { AddToDocumentsDialog } from "./AddToDocumentsDialog";
import { AttachmentPreview } from "./AttachmentPreview";
import { AttachmentToTaskLinkDialog } from "./AttachmentToTaskLinkDialog";

interface EmailAttachment {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  storage_bucket: string;
  downloaded: boolean;
  created_at: string;
  imap_part_id: string | null;
}

interface EmailAttachmentViewerProps {
  messageId: string;
  etablissementId?: string;
}

export function EmailAttachmentViewer({ messageId, etablissementId }: EmailAttachmentViewerProps) {
  const { attachments, isLoading, downloadAttachment, isDownloading, getAttachmentUrl } = useEmailAttachments(messageId);
  const [addToDocsDialog, setAddToDocsDialog] = useState<{ open: boolean; attachment: EmailAttachment | null }>({
    open: false,
    attachment: null,
  });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; attachment: EmailAttachment | null }>({
    open: false,
    attachment: null,
  });
  const [linkToTaskDialog, setLinkToTaskDialog] = useState<{ open: boolean; attachment: EmailAttachment | null }>({
    open: false,
    attachment: null,
  });

  const getIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement des pièces jointes...</div>;
  }

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="p-4 mt-4">
        <h4 className="text-sm font-medium mb-3">Pièces jointes ({attachments.length})</h4>
        <div className="space-y-2">
          {attachments.map((attachment: EmailAttachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-2 rounded border bg-muted/50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getIcon(attachment.mime_type)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{attachment.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(attachment.size_bytes)}
                  </p>
                </div>
                {attachment.downloaded && (
                  <Badge variant="secondary" className="text-xs">
                    Téléchargé
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {(attachment.mime_type.includes('pdf') || attachment.mime_type.startsWith('image/')) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewDialog({ open: true, attachment })}
                    title="Prévisualiser"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadAttachment(attachment.id)}
                  disabled={isDownloading}
                  title="Télécharger"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                {etablissementId && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLinkToTaskDialog({ open: true, attachment })}
                      title="Associer à une tâche"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddToDocsDialog({ open: true, attachment })}
                      title="Ajouter aux documents (ancien)"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {addToDocsDialog.attachment && etablissementId && (
        <AddToDocumentsDialog
          open={addToDocsDialog.open}
          onOpenChange={(open) => setAddToDocsDialog({ open, attachment: null })}
          attachment={{
            id: addToDocsDialog.attachment.id,
            filename: addToDocsDialog.attachment.filename,
            content_type: addToDocsDialog.attachment.mime_type,
            storage_path: addToDocsDialog.attachment.storage_path,
          }}
          etablissementId={etablissementId}
        />
      )}

      {previewDialog.attachment && (
        <AttachmentPreview
          open={previewDialog.open}
          onOpenChange={(open) => setPreviewDialog({ open, attachment: null })}
          attachment={previewDialog.attachment}
          onDownload={() => previewDialog.attachment && downloadAttachment(previewDialog.attachment.id)}
          getAttachmentUrl={getAttachmentUrl}
        />
      )}

      {linkToTaskDialog.attachment && etablissementId && (
        <AttachmentToTaskLinkDialog
          open={linkToTaskDialog.open}
          onOpenChange={(open) => setLinkToTaskDialog({ open, attachment: null })}
          attachment={linkToTaskDialog.attachment}
          etablissementId={etablissementId}
        />
      )}
    </>
  );
}
