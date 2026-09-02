import { useState } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Download, ZoomIn, ImageOff } from "lucide-react";
import { useMessageAttachments } from "@/hooks/email/useThreadImages";
import { toast } from "sonner";

interface EmailInlineImageGalleryProps {
  messageId: string;
  className?: string;
}

export function EmailInlineImageGallery({ messageId, className = "" }: EmailInlineImageGalleryProps) {
  const { attachments, isLoading } = useMessageAttachments(messageId);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Filter only image attachments with valid URLs
  const imageAttachments = attachments?.filter(att => 
    att.mime_type?.startsWith('image/') && att.url
  ) || [];

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className={`grid gap-2 mt-4 grid-cols-2 sm:grid-cols-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={`email-inline-image-skeleton-${i}`} className="aspect-video rounded-lg" />
        ))}
      </div>
    );
  }

  if (imageAttachments.length === 0) {
    return null;
  }

  const handleImageError = (attachmentId: string) => {
    setImageErrors(prev => new Set(prev).add(attachmentId));
    toast.error("Erreur de chargement de l'image");
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      toast.info("Téléchargement en cours...");
      const response = await fetch(url);
      if (!response.ok) throw new Error('Échec du téléchargement');
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Image téléchargée");
    } catch (error) {
      debug.error('Error downloading image:', error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  return (
    <>
      <div className={`grid gap-2 mt-4 ${imageAttachments.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-2 sm:grid-cols-3'} ${className}`}>
        {imageAttachments.map((attachment) => {
          const hasError = imageErrors.has(attachment.id);
          
          return (
            <div
              key={attachment.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden border border-border bg-muted/30 hover:bg-muted/50 transition-all hover:shadow-md"
              onClick={() => !hasError && setSelectedImage(attachment.url || '')}
            >
              <div className="aspect-video relative">
                {hasError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                    <ImageOff className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Erreur de chargement</p>
                  </div>
                ) : (
                  <>
                    <img
                      src={attachment.url || ''}
                      alt={attachment.filename}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                      onError={() => handleImageError(attachment.id)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </>
                )}
              </div>
              <div className="p-2 bg-card">
                <p className="text-xs truncate text-foreground/80" title={attachment.filename}>
                  {attachment.filename}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <div className="relative h-full">
            <div className="absolute top-2 right-2 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  const attachment = imageAttachments.find(a => a.url === selectedImage);
                  if (attachment?.url) {
                    handleDownload(attachment.url, attachment.filename);
                  }
                }} aria-label="Télécharger">
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setSelectedImage(null)} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[95vh]">
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Aperçu"
                  className="max-w-full max-h-[90vh] object-contain"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
