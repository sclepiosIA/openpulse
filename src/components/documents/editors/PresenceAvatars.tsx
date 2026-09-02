import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Pile d'avatars affichant les utilisateurs actuellement connectés à un document.
 * Utilisé dans le header des éditeurs (texte, tableur, présentation).
 */

export interface PresenceUser {
  user_id: string
  user_name: string
  user_avatar?: string | null
  user_color: string
}

interface PresenceAvatarsProps {
  users: PresenceUser[]
  /** Nombre max d'avatars affichés avant le badge « +N ». Défaut 3. */
  max?: number
  isConnected?: boolean
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PresenceAvatars({
  users,
  max = 3,
  isConnected = true,
  className,
}: PresenceAvatarsProps) {
  if (!users || users.length === 0) return null

  const visible = users.slice(0, max)
  const overflow = users.length - visible.length

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn('flex items-center -space-x-2', !isConnected && 'opacity-60', className)}
        aria-label={`${users.length} utilisateur(s) en ligne`}
      >
        {visible.map((u) => (
          <Tooltip key={u.user_id}>
            <TooltipTrigger asChild>
              <div
                className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/5"
                style={{ backgroundColor: u.user_color }}
              >
                {u.user_avatar ? (
                  <img
                    src={u.user_avatar}
                    alt={u.user_name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initials(u.user_name)
                )}
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background',
                    isConnected ? 'bg-emerald-500' : 'bg-muted-foreground'
                  )}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs font-medium">{u.user_name}</p>
              <p className="text-[10px] text-muted-foreground">En cours d'édition</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm">
                +{overflow}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                {users
                  .slice(max)
                  .map((u) => u.user_name)
                  .join(', ')}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
