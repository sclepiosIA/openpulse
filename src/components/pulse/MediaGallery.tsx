import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File,
  Download,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PulseMedia } from '@/types/pulse';

interface MediaGalleryProps {
  media: PulseMedia[];
  initialIndex?: number;
  onClose?: () => void;
}

interface MediaPreviewProps {
  item: PulseMedia;
  className?: string;
  onClick?: () => void;
}

export function MediaPreview({ item, className, onClick }: MediaPreviewProps) {
  const getIcon = () => {
    switch (item.file_type) {
      case 'image': return <ImageIcon className="h-8 w-8" />;
      case 'video': return <Film className="h-8 w-8" />;
      case 'audio': return <Music className="h-8 w-8" />;
      case 'document': return <FileText className="h-8 w-8" />;
      default: return <File className="h-8 w-8" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  if (item.file_type === 'image' && item.thumbnail_url) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "relative overflow-hidden rounded-lg cursor-pointer group",
          "border hover:border-primary transition-colors",
          className
        )}
      >
        <img
          src={item.thumbnail_url}
          alt={item.file_name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ExternalLink className="h-6 w-6 text-white" />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        "hover:bg-muted/50 transition-colors text-left",
        className
      )}
    >
      <div className="flex-shrink-0 p-2 rounded-md bg-muted">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSize(item.size_bytes)}
        </p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function MediaGallery({ media, initialIndex = 0, onClose }: MediaGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentItem = media[currentIndex];

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentItem.file_url;
    link.download = currentItem.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    switch (currentItem.file_type) {
      case 'image':
        return (
          <img
            src={currentItem.file_url}
            alt={currentItem.file_name}
            className="max-h-[80vh] max-w-full object-contain"
          />
        );
      case 'video':
        return (
          <video
            src={currentItem.file_url}
            controls
            className="max-h-[80vh] max-w-full"
          />
        );
      case 'audio':
        return (
          <div className="p-8 bg-muted rounded-lg">
            <Music className="h-24 w-24 mx-auto mb-4 text-muted-foreground" />
            <audio src={currentItem.file_url} controls className="w-full" />
          </div>
        );
      default:
        return (
          <div className="p-8 bg-muted rounded-lg text-center">
            <FileText className="h-24 w-24 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">{currentItem.file_name}</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur-sm">
        <div className="relative flex items-center justify-center min-h-[400px]">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10"
            onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5" />
          </Button>

          {/* Navigation */}
          {media.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 z-10"
                onClick={goPrev} aria-label="Précédent">
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 z-10"
                onClick={goNext} aria-label="Suivant">
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Content */}
          <div className="p-8">
            {renderContent()}
          </div>

          {/* Footer */}
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground">
              {currentItem.file_name}
            </p>
            {media.length > 1 && (
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} / {media.length}
              </p>
            )}
            <Button size="sm" variant="secondary" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
