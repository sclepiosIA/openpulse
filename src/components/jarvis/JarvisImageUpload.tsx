/**
 * JarvisImageUpload - Zone de drop/paste pour analyse d'images
 * 
 * Supporte drag & drop, paste (Ctrl+V), et sélection de fichier
 */

import { useState, useCallback, useRef } from 'react';
import { ImagePlus, X, Loader2, FileText, Eye, Database, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { motion, AnimatePresence } from 'framer-motion';
import { invokeEdge } from "@/services/edgeFunctions";
interface JarvisImageUploadProps {
  onAnalysisComplete: (result: { content: string; task: string }) => void;
  onCancel?: () => void;
  className?: string;
}

const ANALYSIS_TASKS = [
  { id: 'analyze', label: 'Analyser', icon: Eye, description: 'Description détaillée' },
  { id: 'ocr', label: 'Extraire texte', icon: FileText, description: 'OCR du document' },
  { id: 'extract_data', label: 'Extraire données', icon: Database, description: 'JSON structuré' },
] as const;

export function JarvisImageUpload({ onAnalysisComplete, onCancel, className }: JarvisImageUploadProps) {
  const [image, setImage] = useState<{ preview: string; base64: string; name?: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string>('analyze');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      processFile(file);
    } else {
      toast({
        title: 'Format non supporté',
        description: 'Veuillez utiliser une image (JPEG, PNG, etc.)',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          processFile(file);
          break;
        }
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith('image/')) {
      processFile(file);
    }
  }, []);

  const processFile = (file: File) => {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Fichier trop volumineux',
        description: 'La taille maximum est de 10 Mo',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      setImage({ preview: result, base64, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    try {
      const data = await invokeEdge<any>('jarvis-vision', {
          image_base64: image.base64,
          task: selectedTask,
        });

      if (!data?.success) {
        throw new Error(data?.error || 'Analysis failed');
      }

      onAnalysisComplete({ content: data.content, task: selectedTask });
      setImage(null);

    } catch (error) {
      toast({
        title: 'Erreur d\'analyse',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div 
      className={cn('space-y-3', className)}
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Drop zone */}
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer',
          isDragging && 'border-primary bg-primary/5 scale-[1.02]',
          image ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
        onClick={() => !image && fileInputRef.current?.click()}
        animate={{ borderColor: isDragging ? 'hsl(var(--primary))' : undefined }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {image ? (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative"
            >
              <img loading="lazy" decoding="async" src={image.preview} 
                alt="Preview" 
                className="max-h-40 mx-auto rounded-lg shadow-md" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-0 right-0 h-6 w-6 -translate-y-1/2 translate-x-1/2"
                onClick={(e) => {
                  e.stopPropagation();
                  clearImage();
                }} aria-label="Fermer">
                <X className="h-3 w-3" />
              </Button>
              {image.name && (
                <p className="text-xs text-center text-muted-foreground mt-2 truncate">
                  {image.name}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-muted-foreground py-4"
            >
              <div className={cn(
                'p-3 rounded-full transition-colors',
                isDragging ? 'bg-primary/20' : 'bg-muted'
              )}>
                {isDragging ? (
                  <Upload className="h-6 w-6 text-primary" />
                ) : (
                  <ImagePlus className="h-6 w-6" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragging ? 'Déposez l\'image ici' : 'Glissez une image ou cliquez'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  ou collez avec Ctrl+V • Max 10 Mo
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Analysis options */}
      <AnimatePresence>
        {image && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Task selection */}
            <div className="flex flex-wrap gap-2">
              {ANALYSIS_TASKS.map(task => (
                <Button
                  key={task.id}
                  variant={selectedTask === task.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTask(task.id)}
                  className="gap-1.5 h-8"
                >
                  <task.icon className="h-3.5 w-3.5" />
                  {task.label}
                </Button>
              ))}
            </div>
            
            {/* Task description */}
            <p className="text-xs text-muted-foreground">
              {ANALYSIS_TASKS.find(t => t.id === selectedTask)?.description}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              {onCancel && (
                <Button 
                  variant="ghost" 
                  onClick={onCancel}
                  disabled={isAnalyzing}
                  className="flex-1"
                >
                  Annuler
                </Button>
              )}
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="flex-1 gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Analyser
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
