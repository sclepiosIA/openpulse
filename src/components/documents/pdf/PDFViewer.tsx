import { useEffect, useCallback, useRef, useState } from "react";
import { debug } from "@/lib/debug";
import { Document, Page } from "react-pdf";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePDFViewer } from "./usePDFViewer";
import { PDFToolbar } from "./PDFToolbar";
import { PDFThumbnails } from "./PDFThumbnails";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Import centralized PDF.js worker configuration
import '@/lib/pdfjs';

interface PDFViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
  onDownload: () => void;
  className?: string;
}

export function PDFViewer({
  url,
  filename,
  onClose,
  onDownload,
  className,
}: PDFViewerProps) {
  const viewer = usePDFViewer({
    defaultViewMode: 'single',
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documentKey, setDocumentKey] = useState(0);

  // Reset state when URL changes
  useEffect(() => {
    viewer.setLoading(true);
    viewer.setError(null);
    setLoadError(null);
    viewer.setNumPages(0);
    viewer.setCurrentPage(1);
    setDocumentKey(prev => prev + 1);
  }, [url]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    debug.log("PDF loaded successfully:", numPages, "pages");
    viewer.setNumPages(numPages);
    viewer.setLoading(false);
    setLoadError(null);
    // Trigger initial fit after a short delay to let the container render
    setTimeout(() => {
      viewer.fitToWidth();
    }, 100);
  }, [viewer]);

  const onDocumentLoadError = useCallback((error: Error) => {
    debug.error("Error loading PDF:", error);
    const errorMsg = error.message || "Erreur lors du chargement du PDF";
    setLoadError(errorMsg);
    viewer.setError(errorMsg);
    viewer.setLoading(false);
  }, [viewer]);

  // Handle page navigation in continuous mode
  const handlePageClick = useCallback((page: number) => {
    viewer.goToPage(page);
    
    if (viewer.viewMode === 'continuous') {
      const pageElement = pageRefs.current.get(page);
      pageElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [viewer]);

  // Track current page in continuous mode based on scroll
  useEffect(() => {
    if (viewer.viewMode !== 'continuous' || !scrollAreaRef.current) return;

    const handleScroll = () => {
      const scrollElement = scrollAreaRef.current;
      if (!scrollElement) return;

      const scrollTop = scrollElement.scrollTop;
      const viewportHeight = scrollElement.clientHeight;
      const viewportCenter = scrollTop + viewportHeight / 2;

      // Find which page is in view
      let closestPage = 1;
      let closestDistance = Infinity;

      pageRefs.current.forEach((element, pageNum) => {
        const rect = element.getBoundingClientRect();
        const scrollRect = scrollElement.getBoundingClientRect();
        const elementCenter = rect.top - scrollRect.top + rect.height / 2 + scrollTop;
        const distance = Math.abs(viewportCenter - elementCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageNum;
        }
      });

      if (closestPage !== viewer.currentPage) {
        viewer.setCurrentPage(closestPage);
      }
    };

    const scrollElement = scrollAreaRef.current;
    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [viewer.viewMode, viewer.currentPage, viewer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          viewer.prevPage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          viewer.nextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          viewer.zoomIn();
          break;
        case '-':
          e.preventDefault();
          viewer.zoomOut();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          viewer.toggleFullscreen();
          break;
        case 'Escape':
          if (viewer.isFullscreen) {
            e.preventDefault();
            viewer.toggleFullscreen();
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewer, onClose]);

  const handleRetry = () => {
    setLoadError(null);
    viewer.setError(null);
    viewer.setLoading(true);
    setDocumentKey(prev => prev + 1);
  };

  return (
    <div 
      ref={viewer.containerRef}
      className={cn(
        "flex flex-col h-full bg-background",
        viewer.isFullscreen && "fixed inset-0 z-50",
        className
      )}
    >
      <PDFToolbar
        filename={filename}
        currentPage={viewer.currentPage}
        numPages={viewer.numPages}
        scale={viewer.scale}
        viewMode={viewer.viewMode}
        fitMode={viewer.fitMode}
        showThumbnails={viewer.showThumbnails}
        isFullscreen={viewer.isFullscreen}
        onPageChange={handlePageClick}
        onPrevPage={viewer.prevPage}
        onNextPage={viewer.nextPage}
        onZoomIn={viewer.zoomIn}
        onZoomOut={viewer.zoomOut}
        onFitToWidth={viewer.fitToWidth}
        onFitToPage={viewer.fitToPage}
        onToggleViewMode={viewer.toggleViewMode}
        onToggleThumbnails={viewer.toggleThumbnails}
        onToggleFullscreen={viewer.toggleFullscreen}
        onDownload={onDownload}
        onClose={onClose}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Thumbnails Panel */}
        {viewer.showThumbnails && viewer.numPages > 0 && (
          <PDFThumbnails
            fileUrl={url}
            numPages={viewer.numPages}
            currentPage={viewer.currentPage}
            onPageClick={handlePageClick}
          />
        )}

        {/* Main Viewer Area */}
        <div className="flex-1 overflow-auto bg-muted/30" ref={scrollAreaRef}>
          {/* Loading overlay - TOUJOURS visible pendant le chargement, mais n'empêche pas le Document de se monter */}
          {viewer.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Chargement du PDF...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {loadError && !viewer.isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div className="text-center">
                <p className="text-lg font-medium">Impossible de charger le PDF</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  {loadError}
                </p>
                {(loadError.includes('expired') || loadError.includes('403') || loadError.includes('fetch')) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    L'URL d'accès a peut-être expiré. Fermez et rouvrez le document.
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
            </div>
          )}

          {/* PDF Document - TOUJOURS rendu si on a une URL et pas d'erreur, le loader est en overlay */}
          {url && !loadError && (
            <Document
              key={documentKey}
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              className="flex flex-col items-center py-4"
            >
              {viewer.viewMode === 'single' ? (
                // Single page mode
                <div className="flex justify-center">
                  <Page
                    pageNumber={viewer.currentPage || 1}
                    scale={viewer.scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-lg rounded"
                  />
                </div>
              ) : (
                // Continuous scroll mode
                viewer.numPages > 0 && (
                  <div className="flex flex-col items-center gap-4">
                    {Array.from({ length: viewer.numPages }, (_, i) => i + 1).map((pageNum) => (
                      <div
                        key={pageNum}
                        ref={(el) => {
                          if (el) pageRefs.current.set(pageNum, el);
                        }}
                        className="relative"
                      >
                        <Page
                          pageNumber={pageNum}
                          scale={viewer.scale}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          className="shadow-lg rounded"
                        />
                        <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-0.5 rounded text-xs text-muted-foreground">
                          {pageNum}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
