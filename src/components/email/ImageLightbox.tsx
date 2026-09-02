import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ImageLightboxProps {
  images: Array<{
    id: string
    url: string
    filename: string
  }>
  initialIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload?: (image: any) => void
}

export function ImageLightbox({
  images,
  initialIndex,
  open,
  onOpenChange,
  onDownload,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageScale, setImageScale] = useState(1)
  const [imageRotation, setImageRotation] = useState(0)

  const currentImage = images[currentIndex]

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      resetTransforms()
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      resetTransforms()
    }
  }

  const resetTransforms = () => {
    setImageScale(1)
    setImageRotation(0)
  }

  const handleZoomIn = () => setImageScale((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setImageScale((prev) => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setImageRotation((prev) => (prev + 90) % 360)

  const handleClose = () => {
    resetTransforms()
    onOpenChange(false)
  }

  if (!currentImage) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 bg-black/95 border-0">
        {/* Header with controls */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2 text-white">
            <span className="text-sm font-medium truncate max-w-xs">{currentImage.filename}</span>
            <span className="text-xs text-white/70">
              {currentIndex + 1} / {images.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={imageScale <= 0.5}
              className="text-white hover:bg-card/20"
              aria-label="Dézoomer"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={imageScale >= 3}
              className="text-white hover:bg-card/20"
              aria-label="Zoomer"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotate}
              className="text-white hover:bg-card/20"
              aria-label="Actualiser"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            {onDownload && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDownload(currentImage)}
                className="text-white hover:bg-card/20"
                aria-label="Télécharger"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-white hover:bg-card/20"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main image display */}
        <div className="w-full h-full flex items-center justify-center p-16">
          <img
            loading="lazy"
            decoding="async"
            src={currentImage.url}
            alt={currentImage.filename}
            className="transition-transform duration-200 select-none"
            style={{
              transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={cn(
                'absolute left-4 top-1/2 -translate-y-1/2 z-50',
                'h-12 w-12 rounded-full bg-black/60 text-white hover:bg-black/80',
                'disabled:opacity-30'
              )}
              aria-label="Précédent"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2 z-50',
                'h-12 w-12 rounded-full bg-black/60 text-white hover:bg-black/80',
                'disabled:opacity-30'
              )}
              aria-label="Suivant"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Thumbnail strip at bottom */}
        {images.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex gap-2 justify-center overflow-x-auto max-w-full px-2">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => {
                    setCurrentIndex(index)
                    resetTransforms()
                  }}
                  className={cn(
                    'flex-shrink-0 h-16 w-16 rounded overflow-hidden border-2 transition-all',
                    index === currentIndex
                      ? 'border-primary scale-110'
                      : 'border-white/30 opacity-60 hover:opacity-100'
                  )}
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
