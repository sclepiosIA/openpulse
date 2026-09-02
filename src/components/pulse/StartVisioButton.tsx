import { Video, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { usePulseVisio } from '@/hooks/pulse/usePulseVisio'
import { cn } from '@/lib/utils'

type VisioProvider = 'marque_meet' | 'google_meet' | 'nextcloud_talk'

interface StartVisioButtonProps {
  conversationId?: string
  conversationName: string
  onLinkCreated: (link: string, provider: VisioProvider) => void
  isMobileView?: boolean
}

export function StartVisioButton({
  conversationId,
  conversationName,
  onLinkCreated,
  isMobileView,
}: StartVisioButtonProps) {
  const { isCreating, createVisioLink } = usePulseVisio()

  const handleCreateVisio = async (provider: VisioProvider) => {
    const result = await createVisioLink(provider, `Pulse: ${conversationName}`, conversationId)
    if (result) {
      onLinkCreated(result.link, result.provider)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 sm:h-8 sm:w-8 md:h-9 md:w-9 backdrop-blur-sm shadow-sm transition-all',
            isMobileView
              ? 'bg-card/10 border border-white/20 hover:bg-card/20'
              : 'bg-blue-50/80 border border-blue-200/50 hover:bg-blue-100/90 hover:border-blue-300/60'
          )}
          disabled={isCreating}
          title="Démarrer une visio"
          aria-label={isCreating ? 'Création de la visio en cours' : 'Démarrer une visio'}
        >
          {isCreating ? (
            <Loader2
              className={cn('h-4 w-4 animate-spin', isMobileView ? 'text-white' : 'text-blue-600')}
            />
          ) : (
            <Video className={cn('h-4 w-4', isMobileView ? 'text-white' : 'text-blue-600')} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border shadow-lg z-50">
        <DropdownMenuItem onClick={() => handleCreateVisio('marque_meet')}>
          <span className="mr-2">🏥</span>
          OpenPulse Meet
          <Badge variant="secondary" className="ml-2 text-xs">
            Interne
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleCreateVisio('google_meet')}>
          <span className="mr-2">📹</span>
          Google Meet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCreateVisio('nextcloud_talk')}>
          <span className="mr-2">💬</span>
          Nextcloud Talk
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
