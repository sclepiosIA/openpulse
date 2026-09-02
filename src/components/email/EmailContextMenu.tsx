import { ReactNode, useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuCheckboxItem,
} from '@/components/ui/context-menu'
import {
  Archive,
  Trash2,
  Mail,
  MailOpen,
  Star,
  StarOff,
  Tag,
  CheckCircle2,
  Circle,
  Ban,
  Reply,
  Plus,
  FolderPlus,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useEmailFolders } from '@/hooks/email/useEmailFolders'
import { useThreadFolderMutations } from '@/hooks/email/useThreadFolders'
import {
  EmailFolderDialog,
  getFolderColorClass,
  getFolderIconComponent,
} from './folders/EmailFolderDialog'
import { cn } from '@/lib/utils'

// Tags prédéfinis courants
const COMMON_TAGS = [
  'Urgent',
  'À suivre',
  'En attente',
  'Client',
  'Facture',
  'Devis',
  'Contrat',
  'Formation',
  'Support',
  'Technique',
]

interface EmailContextMenuProps {
  children: ReactNode
  threadId: string
  isUnread: boolean
  isStarred: boolean
  isProcessed: boolean
  currentTags: string[]
  onToggleRead: () => void
  onToggleStar: () => void
  onToggleProcessed: () => void
  onArchive: () => void
  onDelete: () => void
  onMarkAsSpam: () => void
  onUpdateTags: (tags: string[]) => void
  onReply?: () => void
}

// Interface pour EmailContextMenuItems (composant interne sans children/trigger)
interface EmailContextMenuItemsProps {
  isUnread: boolean
  isStarred: boolean
  isProcessed: boolean
  currentTags: string[]
  /** IDs des threads sur lesquels appliquer les actions (défaut: le seul thread courant). */
  contextThreadIds?: string[]
  onToggleRead: () => void
  onToggleStar: () => void
  onToggleProcessed: () => void
  onArchive: () => void
  onDelete: () => void
  onMarkAsSpam: () => void
  onUpdateTags: (tags: string[]) => void
  onReply?: () => void
}

export function EmailContextMenu({
  children,
  threadId,
  isUnread,
  isStarred,
  isProcessed,
  currentTags,
  onToggleRead,
  onToggleStar,
  onToggleProcessed,
  onArchive,
  onDelete,
  onMarkAsSpam,
  onUpdateTags,
  onReply,
}: EmailContextMenuProps) {
  const [newTag, setNewTag] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  const handleToggleTag = (tag: string) => {
    if (currentTags.includes(tag)) {
      onUpdateTags(currentTags.filter((t) => t !== tag))
    } else {
      onUpdateTags([...currentTags, tag])
    }
  }

  const handleAddNewTag = () => {
    if (newTag.trim() && !currentTags.includes(newTag.trim())) {
      onUpdateTags([...currentTags, newTag.trim()])
      setNewTag('')
      setIsAddingTag(false)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <EmailContextMenuItems
          isUnread={isUnread}
          isStarred={isStarred}
          isProcessed={isProcessed}
          currentTags={currentTags}
          onToggleRead={onToggleRead}
          onToggleStar={onToggleStar}
          onToggleProcessed={onToggleProcessed}
          onArchive={onArchive}
          onDelete={onDelete}
          onMarkAsSpam={onMarkAsSpam}
          onUpdateTags={onUpdateTags}
          onReply={onReply}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

// Composant exporté pour être utilisé directement dans le ContextMenuContent
export function EmailContextMenuItems({
  isUnread,
  isStarred,
  isProcessed,
  currentTags,
  contextThreadIds,
  onToggleRead,
  onToggleStar,
  onToggleProcessed,
  onArchive,
  onDelete,
  onMarkAsSpam,
  onUpdateTags,
  onReply,
}: EmailContextMenuItemsProps) {
  const [newTag, setNewTag] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const { folders } = useEmailFolders()
  const { addThreadsToFolder } = useThreadFolderMutations()

  const targetThreadIds = contextThreadIds && contextThreadIds.length > 0 ? contextThreadIds : []
  const multi = targetThreadIds.length > 1

  const handleToggleTag = (tag: string) => {
    if (currentTags.includes(tag)) {
      onUpdateTags(currentTags.filter((t) => t !== tag))
    } else {
      onUpdateTags([...currentTags, tag])
    }
  }

  const handleAddNewTag = () => {
    if (newTag.trim() && !currentTags.includes(newTag.trim())) {
      onUpdateTags([...currentTags, newTag.trim()])
      setNewTag('')
      setIsAddingTag(false)
    }
  }

  return (
    <>
      {/* Statut Traité */}
      <ContextMenuItem
        onClick={(e) => {
          e.stopPropagation()
          onToggleProcessed()
        }}
        className="gap-2"
      >
        {isProcessed ? (
          <>
            <Circle className="h-4 w-4" />
            Marquer comme non traité
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Marquer comme traité
          </>
        )}
      </ContextMenuItem>

      {/* Lu / Non lu */}
      <ContextMenuItem
        onClick={(e) => {
          e.stopPropagation()
          onToggleRead()
        }}
        className="gap-2"
      >
        {isUnread ? (
          <>
            <MailOpen className="h-4 w-4" />
            Marquer comme lu
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Marquer comme non lu
          </>
        )}
      </ContextMenuItem>

      {/* Favoris */}
      <ContextMenuItem
        onClick={(e) => {
          e.stopPropagation()
          onToggleStar()
        }}
        className="gap-2"
      >
        {isStarred ? (
          <>
            <StarOff className="h-4 w-4" />
            Retirer des favoris
          </>
        ) : (
          <>
            <Star className="h-4 w-4 text-amber-500" />
            Ajouter aux favoris
          </>
        )}
      </ContextMenuItem>

      {onReply && (
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onReply()
          }}
          className="gap-2"
        >
          <Reply className="h-4 w-4" />
          Répondre
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      {/* Sous-menu Tags */}
      <ContextMenuSub>
        <ContextMenuSubTrigger className="gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-52">
          {COMMON_TAGS.map((tag) => (
            <ContextMenuCheckboxItem
              key={tag}
              checked={currentTags.includes(tag)}
              onCheckedChange={() => handleToggleTag(tag)}
              onClick={(e) => e.stopPropagation()}
            >
              {tag}
            </ContextMenuCheckboxItem>
          ))}

          <ContextMenuSeparator />

          {/* Tags personnalisés existants */}
          {currentTags
            .filter((t) => !COMMON_TAGS.includes(t))
            .map((tag) => (
              <ContextMenuCheckboxItem
                key={tag}
                checked={true}
                onCheckedChange={() => handleToggleTag(tag)}
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
              </ContextMenuCheckboxItem>
            ))}

          <ContextMenuSeparator />

          {/* Ajouter un tag */}
          {isAddingTag ? (
            <div className="flex items-center gap-1 px-2 py-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Nouveau tag..."
                className="h-7 text-sm"
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') handleAddNewTag()
                  if (e.key === 'Escape') setIsAddingTag(false)
                }}
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddNewTag}>
                OK
              </Button>
            </div>
          ) : (
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setIsAddingTag(true)
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter un tag...
            </ContextMenuItem>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>

      {/* Sous-menu Ranger dans un dossier */}
      <ContextMenuSub>
        <ContextMenuSubTrigger className="gap-2">
          <FolderPlus className="h-4 w-4" />
          {multi ? `Ranger ${targetThreadIds.length} emails dans…` : 'Ranger dans un dossier'}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-60 max-h-72 overflow-y-auto">
          {folders.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              Aucun dossier. Créez-en un ci-dessous.
            </div>
          ) : (
            folders.map((f) => {
              const Icon = getFolderIconComponent(f.icon)
              return (
                <ContextMenuItem
                  key={f.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (targetThreadIds.length === 0) return
                    addThreadsToFolder.mutate({
                      threadIds: targetThreadIds,
                      folderId: f.id,
                    })
                  }}
                  className="gap-2"
                >
                  <span
                    className={cn(
                      'h-5 w-5 rounded flex items-center justify-center flex-shrink-0',
                      getFolderColorClass(f.color)
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="truncate">{f.name}</span>
                </ContextMenuItem>
              )
            })
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setCreateFolderOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouveau dossier…
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <EmailFolderDialog open={createFolderOpen} onOpenChange={setCreateFolderOpen} />

      <ContextMenuSeparator />

      {/* Archiver */}
      <ContextMenuItem
        onClick={(e) => {
          e.stopPropagation()
          onArchive()
        }}
        className="gap-2"
      >
        <Archive className="h-4 w-4" />
        Archiver
      </ContextMenuItem>

      {/* Supprimer */}
      <ContextMenuItem
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="gap-2 text-destructive focus:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
        Supprimer
      </ContextMenuItem>

      {/* Spam */}
      <ContextMenuItem
        onClick={(e) => {
          e.stopPropagation()
          onMarkAsSpam()
        }}
        className="gap-2"
      >
        <Ban className="h-4 w-4" />
        Marquer comme spam
      </ContextMenuItem>
    </>
  )
}
