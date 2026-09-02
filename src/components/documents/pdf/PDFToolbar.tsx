import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize,
  Minimize,
  PanelLeft,
  Rows,
  FileText,
  X,
  ArrowLeftToLine,
  Columns,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode, FitMode } from "./usePDFViewer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PDFToolbarProps {
  filename: string;
  currentPage: number;
  numPages: number;
  scale: number;
  viewMode: ViewMode;
  fitMode: FitMode;
  showThumbnails: boolean;
  isFullscreen: boolean;
  onPageChange: (page: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToWidth: () => void;
  onFitToPage: () => void;
  onToggleViewMode: () => void;
  onToggleThumbnails: () => void;
  onToggleFullscreen: () => void;
  onDownload: () => void;
  onClose: () => void;
  className?: string;
}

export function PDFToolbar({
  filename,
  currentPage,
  numPages,
  scale,
  viewMode,
  fitMode,
  showThumbnails,
  isFullscreen,
  onPageChange,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onFitToWidth,
  onFitToPage,
  onToggleViewMode,
  onToggleThumbnails,
  onToggleFullscreen,
  onDownload,
  onClose,
  className,
}: PDFToolbarProps) {
  const zoomPercentage = Math.round(scale * 100);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        "flex items-center justify-between gap-2 p-2 border-b bg-background",
        className
      )}>
        {/* Left section: Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h2 className="text-sm font-medium truncate" title={filename}>
            {filename}
          </h2>
        </div>

        {/* Center section: Navigation & Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Thumbnails toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showThumbnails ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleThumbnails} aria-label="Basculer le panneau">
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Miniatures</TooltipContent>
          </Tooltip>

          {/* View mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === 'continuous' ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleViewMode} aria-label="Document">
                {viewMode === 'single' ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <Rows className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {viewMode === 'single' ? 'Page par page' : 'Défilement continu'}
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Page navigation */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onPrevPage}
                disabled={currentPage <= 1} aria-label="Précédent">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Page précédente</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1 text-sm min-w-[4rem] justify-center">
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (!isNaN(page)) onPageChange(page);
              }}
              className="w-10 h-6 text-center text-xs border rounded bg-muted/50"
            />
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{numPages}</span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onNextPage}
                disabled={currentPage >= numPages} aria-label="Suivant">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Page suivante</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Fit controls */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
                <Columns className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">
                  {fitMode === 'width' ? 'Largeur' : fitMode === 'page' ? 'Page' : `${zoomPercentage}%`}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="bg-popover">
              <DropdownMenuItem onClick={onFitToWidth}>
                <ArrowLeftToLine className="h-4 w-4 mr-2 rotate-90" />
                Ajuster à la largeur
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onFitToPage}>
                <FileText className="h-4 w-4 mr-2" />
                Page entière
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Zoom controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onZoomOut}
                disabled={scale <= 0.5} aria-label="Dézoomer">
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom arrière</TooltipContent>
          </Tooltip>

          <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
            {zoomPercentage}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onZoomIn}
                disabled={scale >= 3} aria-label="Zoomer">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom avant</TooltipContent>
          </Tooltip>
        </div>

        {/* Right section: Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-px h-6 bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onDownload} aria-label="Télécharger">
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Télécharger</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleFullscreen} aria-label="Réduire">
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fermer</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
