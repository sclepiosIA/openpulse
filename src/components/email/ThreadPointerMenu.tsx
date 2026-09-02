import { useState, useEffect, useCallback } from 'react'
import { debug } from '@/lib/debug'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
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
  Plus,
  Sparkles,
  Link2,
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

interface ThreadPointerMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: { x: number; y: number }
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
  onSmartTasks?: () => void
  onAssignThread?: () => void
  /** IDs des threads visés (sélection multi si > 1). Défaut: [threadId] par le parent. */
  contextThreadIds?: string[]
}

export function ThreadPointerMenu({
  open,
  onOpenChange,
  position,
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
  onSmartTasks,
  onAssignThread,
  contextThreadIds,
}: ThreadPointerMenuProps) {
  const [newTag, setNewTag] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const { folders } = useEmailFolders()
  const { addThreadsToFolder } = useThreadFolderMutations()
  const targetThreadIds = contextThreadIds && contextThreadIds.length > 0 ? contextThreadIds : []
  const multi = targetThreadIds.length > 1

  // Reset state when menu closes
  useEffect(() => {
    if (!open) {
      setNewTag('')
      setIsAddingTag(false)
    }
  }, [open])

  const handleToggleTag = useCallback(
    (tag: string) => {
      if (currentTags.includes(tag)) {
        onUpdateTags(currentTags.filter((t) => t !== tag))
      } else {
        onUpdateTags([...currentTags, tag])
      }
    },
    [currentTags, onUpdateTags]
  )

  const handleAddNewTag = useCallback(() => {
    if (newTag.trim() && !currentTags.includes(newTag.trim())) {
      onUpdateTags([...currentTags, newTag.trim()])
      setNewTag('')
      setIsAddingTag(false)
    }
  }, [newTag, currentTags, onUpdateTags])

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={true}>
      <DropdownMenuTrigger asChild>
        <span
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={0}
        alignOffset={0}
        className="w-56 z-50"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Statut Traité */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            debug.log('[ThreadPointerMenu] Toggle processed clicked, isProcessed:', isProcessed)
            try {
              onToggleProcessed()
            } catch (err) {
              debug.error('[ThreadPointerMenu] Error toggling processed:', err)
            }
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
        </DropdownMenuItem>

        {/* Lu / Non lu */}
        <DropdownMenuItem
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
        </DropdownMenuItem>

        {/* Favoris */}
        <DropdownMenuItem
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
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Sous-menu Tags */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {COMMON_TAGS.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag}
                checked={currentTags.includes(tag)}
                onCheckedChange={() => handleToggleTag(tag)}
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            {/* Tags personnalisés existants */}
            {currentTags
              .filter((t) => !COMMON_TAGS.includes(t))
              .map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={true}
                  onCheckedChange={() => handleToggleTag(tag)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}

            <DropdownMenuSeparator />

            {/* Ajouter un tag */}
            {isAddingTag ? (
              <div
                className="flex items-center gap-1 px-2 py-1"
                onClick={(e) => e.stopPropagation()}
              >
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
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setIsAddingTag(true)
                }}
                onSelect={(e) => e.preventDefault()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un tag...
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Associer à un établissement/partenaire/groupe */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onAssignThread?.()
          }}
          className="gap-2"
        >
          <Link2 className="h-4 w-4 text-blue-500" />
          Associer à...
        </DropdownMenuItem>

        {/* Tâches intelligentes */}
        {onSmartTasks && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onSmartTasks()
            }}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            Tâches intelligentes
          </DropdownMenuItem>
        )}

        {/* Sous-menu Ranger dans un dossier */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <FolderPlus className="h-4 w-4 text-blue-500" />
            {multi ? `Ranger ${targetThreadIds.length} emails dans…` : 'Ranger dans un dossier'}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60 max-h-72 overflow-y-auto">
            {folders.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                Aucun dossier. Créez-en un ci-dessous.
              </div>
            ) : (
              folders.map((f) => {
                const Icon = getFolderIconComponent(f.icon)
                return (
                  <DropdownMenuItem
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
                  </DropdownMenuItem>
                )
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setCreateFolderOpen(true)
              }}
              onSelect={(e) => e.preventDefault()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nouveau dossier…
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <EmailFolderDialog open={createFolderOpen} onOpenChange={setCreateFolderOpen} />

        <DropdownMenuSeparator />

        {/* Archiver */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          className="gap-2"
        >
          <Archive className="h-4 w-4" />
          Archiver
        </DropdownMenuItem>

        {/* Supprimer */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </DropdownMenuItem>

        {/* Spam */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onMarkAsSpam()
          }}
          className="gap-2"
        >
          <Ban className="h-4 w-4" />
          Marquer comme spam
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
