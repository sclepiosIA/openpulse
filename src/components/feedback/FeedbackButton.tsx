import { useState, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FeedbackModal } from './FeedbackModal'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { useAuth } from '@/hooks/shared/useAuth'

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [screenshot, setScreenshot] = useState<Blob | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isMobile = useIsMobile()
  const { user } = useAuth()

  const captureScreenshot = useCallback(async () => {
    setIsCapturing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 0.75,
        logging: false,
        ignoreElements: (element) => {
          return (
            element.id === 'feedback-button' ||
            element.id === 'feedback-modal' ||
            element.getAttribute('data-radix-portal') !== null ||
            element.getAttribute('data-vaul-drawer') !== null
          )
        },
      })
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (blob) => {
            resolve(blob)
          },
          'image/png',
          0.8
        )
      })
    } catch (error) {
      debug.error('[FeedbackButton] Erreur capture écran:', error)
      return null
    } finally {
      setIsCapturing(false)
    }
  }, [])

  const handleClick = async () => {
    setIsOpen(true)
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      const capturePromise = captureScreenshot()
      const captured = await Promise.race([capturePromise, timeoutPromise])
      setScreenshot(captured)
    } catch {
      setScreenshot(null)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setScreenshot(null)
  }

  // Not logged in or mobile: no button
  if (!user || isMobile) {
    return null
  }

  return (
    <>
      <div
        className="fixed bottom-0 left-0 z-[100] w-28 h-20 flex items-end justify-start"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                id="feedback-button"
                variant="outline"
                size="icon"
                onClick={handleClick}
                disabled={isCapturing}
                className="mb-2 ml-2 h-8 w-8 rounded-full bg-amber-600 hover:bg-amber-500 text-white border-0 transition-colors opacity-100 scale-100"
                aria-label="Donner un retour"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-popover text-popover-foreground">
              <p>Signaler un bug ou suggérer une amélioration</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <FeedbackModal open={isOpen} onOpenChange={handleClose} screenshot={screenshot} />
    </>
  )
}
