import { memo } from 'react'
import { Globe, Shield, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PERMISSION_LABELS } from '@/types/documents/permissions'
import type { FolderShareInfo } from '@/types/folders'
import type { PermissionLevel } from '@/types/documents/permissions'

interface FolderShareIndicatorProps {
  isRestricted: boolean
  folderType: string
  sharedWith: FolderShareInfo[]
  /** Maximum avatars to display before "+N" */
  maxAvatars?: number
  /** Compact mode for finder/tree */
  variant?: 'default' | 'compact' | 'mini'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export const FolderShareIndicator = memo(function FolderShareIndicator({
  isRestricted,
  folderType,
  sharedWith,
  maxAvatars = 3,
  variant = 'default',
}: FolderShareIndicatorProps) {
  // Not restricted and not shared type → no indicator
  if (!isRestricted && folderType !== 'shared') return null

  // Shared with everyone (globe)
  if (!isRestricted && folderType === 'shared') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Globe
            className={cn(
              'shrink-0 text-primary/50',
              variant === 'mini' ? 'w-3 h-3' : 'w-3.5 h-3.5'
            )}
          />
        </TooltipTrigger>
        <TooltipContent>Partagé avec tous</TooltipContent>
      </Tooltip>
    )
  }

  // Restricted but no permissions set
  if (isRestricted && sharedWith.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Shield
            className={cn(
              'shrink-0 text-amber-600',
              variant === 'mini' ? 'w-3 h-3' : 'w-3.5 h-3.5'
            )}
          />
        </TooltipTrigger>
        <TooltipContent>Accès restreint — aucune autorisation</TooltipContent>
      </Tooltip>
    )
  }

  // Mini variant: just icon + count
  if (variant === 'mini') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-muted-foreground shrink-0">
            <Users className="w-3 h-3" />
            <span className="text-[10px] font-medium">{sharedWith.length}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <ShareTooltipContent sharedWith={sharedWith} />
        </TooltipContent>
      </Tooltip>
    )
  }

  const visible = sharedWith.slice(0, maxAvatars)
  const remaining = sharedWith.length - visible.length

  const avatarSize = variant === 'compact' ? 'h-5 w-5' : 'h-6 w-6'
  const fontSize = variant === 'compact' ? 'text-[8px]' : 'text-[9px]'
  const overlapMargin = variant === 'compact' ? '-ml-1.5' : '-ml-2'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center shrink-0 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center">
            {visible.map((person, i) => (
              <Avatar
                key={`${person.type}-${person.name}-${i}`}
                className={cn(avatarSize, 'border-2 border-background', i > 0 && overlapMargin)}
              >
                {person.type === 'user' && person.avatar_url ? (
                  <AvatarImage src={person.avatar_url} alt={person.name} />
                ) : null}
                <AvatarFallback
                  className={cn(
                    fontSize,
                    'font-semibold',
                    person.type === 'group'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-primary/10 text-primary'
                  )}
                  style={
                    person.type === 'group' && person.color
                      ? { backgroundColor: `${person.color}20`, color: person.color }
                      : undefined
                  }
                >
                  {person.type === 'group' ? (
                    <Users className={variant === 'compact' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                  ) : (
                    getInitials(person.name)
                  )}
                </AvatarFallback>
              </Avatar>
            ))}
            {remaining > 0 && (
              <div
                className={cn(
                  avatarSize,
                  overlapMargin,
                  'rounded-full border-2 border-background bg-muted flex items-center justify-center',
                  fontSize,
                  'font-medium text-muted-foreground'
                )}
              >
                +{remaining}
              </div>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <ShareTooltipContent sharedWith={sharedWith} />
      </TooltipContent>
    </Tooltip>
  )
})

function ShareTooltipContent({ sharedWith }: { sharedWith: FolderShareInfo[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold mb-1">Partagé avec :</p>
      {sharedWith.map((s, i) => (
        <div key={`share-${s.type}-${s.name}-${i}`} className="flex items-center gap-2 text-xs">
          <span className="truncate flex-1">{s.type === 'group' ? `👥 ${s.name}` : s.name}</span>
          <span className="text-muted-foreground shrink-0">
            {PERMISSION_LABELS[s.access_level as PermissionLevel] || s.access_level}
          </span>
        </div>
      ))}
    </div>
  )
}
