import React, { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const [inView, setInView] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  const { threshold = 0, rootMargin = '0px', triggerOnce = false } = options

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Check if IntersectionObserver is supported
    if (!window.IntersectionObserver) {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting
        setInView(isIntersecting)
        setEntry(entry)

        if (triggerOnce && isIntersecting) {
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, triggerOnce])

  return { ref, inView, entry }
}