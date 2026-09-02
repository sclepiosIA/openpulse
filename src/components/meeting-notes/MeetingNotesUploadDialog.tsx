import { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CsrfToken } from '@/components/security/CsrfToken';
import type { UploadOptions } from '@/hooks/meeting/useMeetingNotes';

const ACCEPTED_FORMATS = '.mp3,.wav,.m4a,.webm,.ogg,.flac,.mp4';
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface MeetingNotesUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, options: UploadOptions) => Promise<string | null>;
  uploadStatus: { status: string; message: string };
}

export function MeetingNotesUploadDialog({
  open,
  onOpenChange,
  onUpload,
  uploadStatus,
}: MeetingNotesUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('fr');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isProcessing = uploadStatus.status === 'uploading' || uploadStatus.status === 'processing';

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_SIZE_BYTES) {
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    }
  }, [title]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    const sessionId = await onUpload(file, { title: title.trim(), language });
    if (sessionId) {
      setFile(null);
      setTitle('');
    }
  };

  const resetAndClose = () => {
    if (isProcessing) return;
    setFile(null);
    setTitle('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5 text-primary" />
            Nouvelle note de réunion
          </DialogTitle>
          <DialogDescription>
            Importez un enregistrement audio pour le transcrire et l'analyser automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <CsrfToken />
          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              dragActive && "border-primary bg-primary/5",
              file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
              isProcessing && "pointer-events-none opacity-60"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              disabled={isProcessing}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileAudio className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[250px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} Mo</p>
                </div>
                {!isProcessing && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setFile(null); }} aria-label="Fermer">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Glissez un fichier audio ici</p>
                <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A, WebM, OGG — max {MAX_SIZE_MB} Mo</p>
              </>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="meeting-title">Titre de la réunion</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Point hebdo Sprint 12"
              disabled={isProcessing}
              maxLength={200}
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label>Langue</Label>
            <Select value={language} onValueChange={setLanguage} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">🇫🇷 Français</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Progress */}
          {uploadStatus.status !== 'idle' && (
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg animate-fade-in",
              uploadStatus.status === 'uploading' || uploadStatus.status === 'processing' ? "bg-muted" : "",
              uploadStatus.status === 'done' ? "bg-green-50 dark:bg-green-950/30" : "",
              uploadStatus.status === 'error' ? "bg-destructive/10" : "",
            )}>
              {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
              {uploadStatus.status === 'done' && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
              {uploadStatus.status === 'error' && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
              <p className="text-sm font-medium">{uploadStatus.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={resetAndClose} disabled={isProcessing}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!file || !title.trim() || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Transcrire
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
