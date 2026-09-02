import { useEffect, useState } from 'react'
import { X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TutorielScreenshotProps {
  src: string
  alt: string
  className?: string
  size?: 'full' | 'medium' | 'small'
}

export function TutorielScreenshot({
  src,
  alt,
  className,
  size = 'full',
}: TutorielScreenshotProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [hasError, setHasError] = useState(false)

  // A11y : fermer le lightbox via Escape
  useEffect(() => {
    if (!isLightboxOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isLightboxOpen])

  const sizeClasses = {
    full: 'w-full max-h-[400px]',
    medium: 'max-w-[600px] max-h-[350px]',
    small: 'max-w-[400px] max-h-[250px]',
  }

  if (hasError) {
    return null
  }

  return (
    <>
      <div
        className={cn(
          'group relative rounded-lg border border-border overflow-hidden cursor-zoom-in transition-all duration-300 hover:shadow-lg hover:border-primary/50',
          sizeClasses[size],
          className
        )}
        onClick={() => setIsLightboxOpen(true)}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onError={() => setHasError(true)}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" />
        </div>
        <p className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {alt}
        </p>
      </div>

      {/* Lightbox */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-card/10 hover:bg-card/20 transition-colors"
            onClick={() => setIsLightboxOpen(false)}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            {alt}
          </p>
        </div>
      )}
    </>
  )
}
