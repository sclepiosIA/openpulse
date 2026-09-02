/**
 * LazyImage - Image component with lazy loading and placeholder
 * Uses Intersection Observer for optimal loading
 */

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Fallback content while loading */
  fallback?: React.ReactNode
  /** Root margin for intersection observer (default: 100px) */
  rootMargin?: string
  /** Optional blur placeholder data URL */
  blurDataUrl?: string
}

export function LazyImage({
  src,
  alt,
  className,
  fallback,
  rootMargin = '100px',
  blurDataUrl,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(imgRef.current)

    return () => observer.disconnect()
  }, [rootMargin])

  const handleLoad = () => {
    setIsLoaded(true)
    setHasError(false)
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true)
  }

  // Default fallback is a gray placeholder
  const defaultFallback = (
    <div className={cn('bg-muted animate-pulse', className)} />
  )

  if (hasError) {
    return fallback || defaultFallback
  }

  return (
    <div ref={imgRef} className={cn('relative overflow-hidden', className)}>
      {/* Blur placeholder */}
      {blurDataUrl && !isLoaded && (
        <img
          src={blurDataUrl}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover blur-sm scale-105',
            className
          )}
          aria-hidden
        />
      )}

      {/* Skeleton while not in view or loading */}
      {(!isInView || !isLoaded) && !blurDataUrl && (
        <div className={cn('absolute inset-0 bg-muted animate-pulse', className)} />
      )}

      {/* Actual image - only load when in view */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}
    </div>
  )
}
