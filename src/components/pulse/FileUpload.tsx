import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Paperclip, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music,
  File
} from 'lucide-react';
import { usePulseMedia } from '@/hooks/pulse/usePulseMedia';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  conversationId: string;
  messageId?: string;
  onUploadComplete?: (media: {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
  }) => void;
  onUploadStart?: () => void;
  disabled?: boolean;
}

export function FileUpload({
  conversationId,
  messageId,
  onUploadComplete,
  onUploadStart,
  disabled,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isUploading, uploadProgress, uploadFile, maxFileSize, allowedTypes } = usePulseMedia(conversationId);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setPendingFiles(files);
    onUploadStart?.();

    // If we have a messageId, upload immediately
    if (messageId) {
      for (const file of files) {
        const result = await uploadFile(file, messageId);
        if (result) {
          onUploadComplete?.(result);
        }
      }
      setPendingFiles([]);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [messageId, uploadFile, onUploadComplete, onUploadStart]);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Film className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <Music className="h-4 w-4" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={allowedTypes.join(',')}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading} aria-label="Joindre un fichier">
        <Paperclip className="h-4 w-4" />
      </Button>

      {isUploading && (
        <div className="px-2">
          <Progress value={uploadProgress} className="h-1" />
          <p className="text-xs text-muted-foreground mt-1">
            Upload en cours... {uploadProgress}%
          </p>
        </div>
      )}

      {pendingFiles.length > 0 && !messageId && (
        <div className="flex flex-wrap gap-2 px-2">
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-md text-xs",
                "bg-muted/50 border"
              )}
            >
              {getFileIcon(file.type)}
              <span className="truncate max-w-[120px]">{file.name}</span>
              <span className="text-muted-foreground">{formatSize(file.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={() => removePendingFile(index)} aria-label="Fermer">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
