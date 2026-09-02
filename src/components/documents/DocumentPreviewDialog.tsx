import { Dialog, DialogContent } from "@/components/ui/dialog";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import {
  Download,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Edit,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Loader } from "@/components/ui/loader";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentWithRelations } from "@/types/documents";
import { useDocumentDownload } from "@/hooks/documents/useDocumentUpload";
import { logDocumentAudit } from "@/hooks/documents/useDocumentAuditLog";
import { PDFViewer } from "./pdf/PDFViewer";

interface DocumentPreviewDialogProps {
  document: DocumentWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (document: DocumentWithRelations) => void;
}

export function DocumentPreviewDialog({ 
  document, 
  open, 
  onOpenChange,
  onEdit
}: DocumentPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Image states
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  const downloadMutation = useDocumentDownload();

  const isPDF = document?.mime_type?.includes('pdf') ?? false;
  const isImage = document?.mime_type?.startsWith('image/') ?? false;
  const isOfficeDoc = document?.mime_type && (
    document.mime_type.includes('word') ||
    document.mime_type.includes('excel') ||
    document.mime_type.includes('spreadsheet') ||
    document.mime_type.includes('powerpoint') ||
    document.mime_type.includes('presentation') ||
    document.mime_type.includes('msword') ||
    document.mime_type.includes('opendocument')
  );

  const loadPreview = useCallback(async () => {
    if (!document) return;
    
    setLoading(true);
    setError(null);
    try {
      // Une PAGE rédigée n'a pas de chemin de stockage : son contenu vit dans
      // `documents.content`. Sans ce garde-fou, on demanderait au stockage une
      // URL signée pour un chemin nul, et l'erreur rendue ne nommerait pas la
      // vraie cause.
      if (!document.storage_path) {
        setError("Cette page se consulte dans l'éditeur : son contenu n'est pas un fichier.");
        setLoading(false);
        return;
      }
      const { data, error: urlError } = await supabase.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 3600); // 1 heure
      
      if (urlError) throw urlError;
      
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
        // Audit : log l'ouverture (fire-and-forget)
        void logDocumentAudit(document.id, "viewed", { mime_type: document.mime_type });
        // For non-PDF files, stop loading here
        if (!isPDF) {
          setLoading(false);
        }
      } else {
        setError("Impossible de charger le fichier");
        setLoading(false);
      }
    } catch (err) {
      debug.error("Error loading preview:", err);
      setError("Erreur lors du chargement");
      setLoading(false);
    }
  }, [document, isPDF]);

  useEffect(() => {
    if (open && document) {
      loadPreview();
    }
    
    return () => {
      if (!open) {
        setPreviewUrl(null);
        setLoading(true);
        setError(null);
        setImageScale(1);
        setImageRotation(0);
      }
    };
  }, [open, document, loadPreview]);

  // Image controls
  const handleZoomIn = () => setImageScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setImageScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setImageRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    if (!document) return;
    downloadMutation.mutate({
      id: document.id,
      storage_path: document.storage_path,
      storage_bucket: document.storage_bucket,
      name: document.name,
    });
    // Audit : log le téléchargement (fire-and-forget)
    void logDocumentAudit(document.id, "downloaded", { name: document.name });
  };

  const handleEdit = () => {
    if (document && onEdit) {
      onEdit(document);
      onOpenChange(false);
    }
  };

  if (!document) return null;

  // PDF uses the new PDFViewer component
  if (isPDF) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-none w-[98vw] h-[98vh] flex flex-col p-0">
          {loading && !previewUrl && (
            <div className="flex-1 flex items-center justify-center">
              <Loader />
            </div>
          )}
          {error && (
            <div className="flex-1 flex items-center justify-center text-destructive">
              <p>{error}</p>
            </div>
          )}
          {previewUrl && (
            <PDFViewer
              url={previewUrl}
              filename={document.name}
              onClose={() => onOpenChange(false)}
              onDownload={handleDownload}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Non-PDF files use the original viewer with simplified header
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        {/* Header for non-PDF files */}
        <div className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between gap-4">
            <h2 className="truncate flex-1 text-base font-medium">
              {document.name}
            </h2>
            <div className="flex gap-1 flex-shrink-0">
              {/* Image controls */}
              {isImage && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={handleZoomOut} 
                    disabled={imageScale <= 0.5}
                    title="Zoom arrière" aria-label="Dézoomer">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs flex items-center px-1 text-muted-foreground min-w-[3rem] justify-center">
                    {Math.round(imageScale * 100)}%
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={handleZoomIn} 
                    disabled={imageScale >= 3}
                    title="Zoom avant" aria-label="Zoomer">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={handleRotate}
                    title="Rotation" aria-label="Actualiser">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1 self-center" />
                </>
              )}

              {/* Edit button for Office docs */}
              {isOfficeDoc && onEdit && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 gap-2"
                  onClick={handleEdit}
                  title="Éditer dans OnlyOffice"
                >
                  <Edit className="h-4 w-4" />
                  <span className="hidden sm:inline">Éditer</span>
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={handleDownload}
                title="Télécharger" aria-label="Télécharger">
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onOpenChange(false)} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-muted/30">
          {loading && (
            <div className="w-full h-full flex items-center justify-center">
              <Loader />
            </div>
          )}
          
          {error && (
            <div className="w-full h-full flex items-center justify-center text-destructive">
              <p>{error}</p>
            </div>
          )}

          {/* Image Preview */}
          {!loading && !error && isImage && previewUrl && (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img loading="lazy" decoding="async" src={previewUrl} 
                alt={document.name}
                className="transition-transform duration-200 shadow-lg rounded"
                style={{
                  transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }} />
            </div>
          )}

          {/* Office Doc - Suggest editing */}
          {!loading && !error && isOfficeDoc && (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-4 max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                  <Edit className="w-8 h-8 text-primary" />
                </div>
                <p className="font-medium">Document Office</p>
                <p className="text-sm">
                  Ce type de document peut être édité en ligne avec OnlyOffice.
                </p>
                {onEdit && (
                  <Button onClick={handleEdit} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Ouvrir dans l'éditeur
                  </Button>
                )}
                <div className="pt-2">
                  <Button variant="outline" onClick={handleDownload} className="gap-2">
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Other file types */}
          {!loading && !error && !isImage && !isOfficeDoc && (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-3">
                <p className="font-medium">Aucune prévisualisation disponible</p>
                <p className="text-sm">Type: {document.mime_type}</p>
                <Button onClick={handleDownload} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Télécharger le fichier
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
