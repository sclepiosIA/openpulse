import { cn } from '@/lib/utils'
import { getFolderColorClass, getFolderIconComponent } from './EmailFolderDialog'
import { useThreadFolders } from '@/hooks/email/useThreadFolders'
import { useEmailFolders } from '@/hooks/email/useEmailFolders'

interface ThreadFolderBadgesProps {
  threadId: string
  max?: number
  className?: string
}

/** Petites pastilles colorées indiquant les dossiers d'un fil de discussion. */
export function ThreadFolderBadges({ threadId, max = 2, className }: ThreadFolderBadgesProps) {
  const { data: folderIds = [] } = useThreadFolders(threadId)
  const { folders } = useEmailFolders()

  if (folderIds.length === 0) return null
  const matched = folders.filter((f) => folderIds.includes(f.id))
  if (matched.length === 0) return null

  const shown = matched.slice(0, max)
  const rest = matched.length - shown.length

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {shown.map((f) => {
        const Icon = getFolderIconComponent(f.icon)
        return (
          <span
            key={f.id}
            className={cn(
              'inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium',
              getFolderColorClass(f.color)
            )}
            title={f.name}
          >
            <Icon className="h-3 w-3" />
            <span className="max-w-[80px] truncate">{f.name}</span>
          </span>
        )
      })}
      {rest > 0 && (
        <span className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  )
}
