import { ReactNode, useRef, useEffect, RefObject } from 'react'
import { cn } from '@/lib/utils'

interface GanttDualLayoutProps {
  fixedContent: ReactNode
  scrollableContent: ReactNode
  leftColumnWidth?: number
  className?: string
  scrollableRef?: RefObject<HTMLDivElement>
}

export function GanttDualLayout({
  fixedContent,
  scrollableContent,
  leftColumnWidth = 252,
  className,
  scrollableRef
}: GanttDualLayoutProps) {
  const fixedScrollRef = useRef<HTMLDivElement>(null)
  const internalScrollableRef = useRef<HTMLDivElement>(null)
  
  // Utiliser la ref externe si fournie, sinon la ref interne
  const scrollableScrollRef = scrollableRef || internalScrollableRef

  // Synchroniser le scroll vertical entre les deux colonnes
  useEffect(() => {
    const fixedDiv = fixedScrollRef.current
    const scrollableDiv = scrollableScrollRef.current

    if (!fixedDiv || !scrollableDiv) return

    const handleFixedScroll = () => {
      if (scrollableDiv) {
        scrollableDiv.scrollTop = fixedDiv.scrollTop
      }
    }

    const handleScrollableScroll = () => {
      if (fixedDiv) {
        fixedDiv.scrollTop = scrollableDiv.scrollTop
      }
    }

    fixedDiv.addEventListener('scroll', handleFixedScroll)
    scrollableDiv.addEventListener('scroll', handleScrollableScroll)

    return () => {
      fixedDiv.removeEventListener('scroll', handleFixedScroll)
      scrollableDiv.removeEventListener('scroll', handleScrollableScroll)
    }
  }, [])

  return (
    <div className={cn("flex w-full h-full", className)}>
      {/* Colonne fixe des libellés */}
      <div
        ref={fixedScrollRef}
        className="flex-shrink-0 border-r border-border overflow-y-auto scrollbar-hide h-full"
        style={{ width: `${leftColumnWidth}px` }}
      >
        {fixedContent}
      </div>

      {/* Colonne scrollable de la timeline */}
      <div
        ref={scrollableScrollRef}
        className="flex-1 overflow-auto h-full"
      >
        <div className="min-w-[800px]">
          {scrollableContent}
        </div>
      </div>
    </div>
  )
}
