import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { debug } from "@/lib/debug";
import { Document, Page } from 'react-pdf';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Import centralized PDF.js worker configuration
import '@/lib/pdfjs';

interface AttachmentPreviewProps {
  attachment: {
    id: string;
    filename: string;
    mime_type: string;
    storage_path: string;
    size_bytes: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
  getAttachmentUrl: (storagePath: string) => Promise<string | undefined>;
}

export function AttachmentPreview({ 
  attachment, 
  open, 
  onOpenChange, 
  onDownload,
  getAttachmentUrl 
}: AttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  // PDF states
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [documentKey, setDocumentKey] = useState(0);
  
  // Image lightbox states
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  const isPDF = attachment.mime_type.includes('pdf');
  const isImage = attachment.mime_type.startsWith('image/');

  useEffect(() => {
    if (open) {
      loadPreview();
    }
    return () => {
      // Reset states when closing
      setPreviewUrl(null);
      setUrlLoading(true);
      setUrlError(null);
      setPageNumber(1);
      setNumPages(0);
      setPdfLoading(true);
      setPdfError(null);
      setImageScale(1);
      setImageRotation(0);
    };
  }, [open, attachment.storage_path]);

  const loadPreview = async () => {
    setUrlLoading(true);
    setUrlError(null);
    setPdfError(null);
    setPdfLoading(true);
    try {
      const url = await getAttachmentUrl(attachment.storage_path);
      if (url) {
        setPreviewUrl(url);
        setUrlLoading(false);
        setDocumentKey(prev => prev + 1);
      } else {
        setUrlError("Impossible de charger le fichier");
        setUrlLoading(false);
      }
    } catch (err) {
      debug.error("Error loading preview:", err);
      setUrlError("Erreur lors du chargement");
      setUrlLoading(false);
    }
  };

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    debug.log("PDF attachment loaded successfully:", numPages, "pages");
    setNumPages(numPages);
    setPdfLoading(false);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    debug.error("Error loading PDF attachment:", error);
    setPdfError(error.message || "Erreur lors du chargement du PDF");
    setPdfLoading(false);
  }, []);

  const handleRetry = () => {
    setPdfError(null);
    setPdfLoading(true);
    setDocumentKey(prev => prev + 1);
  };

  const handleZoomIn = () => setImageScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setImageScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setImageRotation(prev => (prev + 90) % 360);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isPDF ? "!max-w-none w-[98vw] h-[98vh] flex flex-col p-0" : "max-w-5xl h-[90vh] flex flex-col"}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="truncate flex-1">{attachment.filename}</DialogTitle>
            <div className="flex gap-2 flex-shrink-0">
              {isImage && (
                <>
                  <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={imageScale <= 0.5} aria-label="Zoom arrière" title="Zoom arrière">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={imageScale >= 3} aria-label="Zoom avant" title="Zoom avant">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRotate} aria-label="Pivoter" title="Pivoter">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              {isPDF && numPages > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                    disabled={pageNumber <= 1}
                    aria-label="Page précédente"
                    title="Page précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm flex items-center px-2">
                    {pageNumber} / {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                    disabled={pageNumber >= numPages}
                    aria-label="Page suivante"
                    title="Page suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={onDownload} aria-label="Télécharger" title="Télécharger">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} aria-label="Fermer" title="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg relative">
          {/* URL Loading state */}
          {urlLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Chargement...</p>
              </div>
            </div>
          )}
          
          {/* URL Error */}
          {urlError && (
            <div className="w-full h-full flex items-center justify-center text-destructive">
              <p>{urlError}</p>
            </div>
          )}

          {/* PDF Preview */}
          {!urlLoading && !urlError && isPDF && previewUrl && (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
              {/* PDF Loading overlay */}
              {pdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Chargement du PDF...</p>
                  </div>
                </div>
              )}

              {/* PDF Error */}
              {pdfError && !pdfLoading && (
                <div className="flex flex-col items-center justify-center gap-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <div className="text-center">
                    <p className="text-lg font-medium">Impossible de charger le PDF</p>
                    <p className="text-sm text-muted-foreground mt-1">{pdfError}</p>
                  </div>
                  <Button variant="outline" onClick={handleRetry} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Réessayer
                  </Button>
                </div>
              )}

              {/* PDF Document - TOUJOURS rendu si on a une URL et pas d'erreur PDF */}
              {!pdfError && (
                <Document
                  key={documentKey}
                  file={previewUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={null}
                >
                  <Page 
                    pageNumber={pageNumber || 1} 
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-lg"
                  />
                </Document>
              )}
            </div>
          )}

          {/* Image Preview */}
          {!urlLoading && !urlError && isImage && previewUrl && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img loading="lazy" decoding="async" src={previewUrl} 
                alt={attachment.filename}
                className="transition-transform duration-200 shadow-lg rounded"
                style={{
                  transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }} />
            </div>
          )}

          {/* Unsupported format */}
          {!urlLoading && !urlError && !isPDF && !isImage && (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <p>Aucune prévisualisation disponible pour ce type de fichier</p>
                <p className="text-sm">Type: {attachment.mime_type}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
