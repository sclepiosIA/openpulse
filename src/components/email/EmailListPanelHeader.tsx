import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  RefreshCw,
  Plus,
  Search,
  CheckSquare,
  MailOpen,
  CircleDashed,
  Inbox,
  Send,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmailListPanelHeaderProps {
  filters: {
    mailbox: string
    search: string
    unreadOnly: boolean
    unprocessedOnly: boolean
  }
  updateFilter: (key: any, value: any) => void
  isSelectionMode: boolean
  threadsCount: number
  selectedCount: number
  unreadCount: number
  onToggleSelectionMode: () => void
  onSelectAll: (checked: boolean | 'indeterminate') => void
  onSyncNow?: () => void
  isSyncing?: boolean
  onComposeNew?: () => void
}

export function EmailListPanelHeader({
  filters,
  updateFilter,
  isSelectionMode,
  threadsCount,
  selectedCount,
  unreadCount,
  onToggleSelectionMode,
  onSelectAll,
  onSyncNow,
  isSyncing = false,
  onComposeNew,
}: EmailListPanelHeaderProps) {
  return (
    <div className="flex-shrink-0 p-3 space-y-3 border-b border-primary/10">
      {/* Mailbox selector */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-card/60 border border-primary/10 shadow-sm">
        <button
          className={cn(
            'flex-1 h-8 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
            filters.mailbox === 'inbox'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-card/80'
          )}
          onClick={() => updateFilter('mailbox', 'inbox')}
        >
          <Inbox className="h-4 w-4" />
          Réception
        </button>
        <button
          className={cn(
            'flex-1 h-8 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
            filters.mailbox === 'sent'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-card/80'
          )}
          onClick={() => {
            updateFilter('mailbox', 'sent')
            updateFilter('unreadOnly', false)
            updateFilter('unprocessedOnly', false)
          }}
        >
          <Send className="h-4 w-4" />
          Envoyés
        </button>
        <button
          className={cn(
            'flex-1 h-8 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
            filters.mailbox === 'trash'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-card/80'
          )}
          onClick={() => {
            updateFilter('mailbox', 'trash')
            updateFilter('unreadOnly', false)
            updateFilter('unprocessedOnly', false)
          }}
        >
          <Trash2 className="h-4 w-4" />
          Corbeille
        </button>
      </div>

      {/* Quick filters */}
      {filters.mailbox !== 'sent' && filters.mailbox !== 'trash' && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={!filters.unreadOnly && !filters.unprocessedOnly ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer transition-all h-7 px-3',
              !filters.unreadOnly && !filters.unprocessedOnly
                ? 'hover:bg-primary/90'
                : 'hover:bg-accent'
            )}
            onClick={() => {
              updateFilter('unreadOnly', false)
              updateFilter('unprocessedOnly', false)
            }}
          >
            Tous
          </Badge>
          <Badge
            variant={filters.unreadOnly ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer gap-1.5 transition-all h-7 px-3',
              filters.unreadOnly ? 'hover:bg-primary/90' : 'hover:bg-accent'
            )}
            onClick={() => {
              updateFilter('unreadOnly', true)
              updateFilter('unprocessedOnly', false)
            }}
          >
            <MailOpen className="h-3 w-3" />
            Non lus
            {unreadCount > 0 && (
              <span
                className={cn(
                  'ml-0.5 px-1.5 rounded-full text-[10px] font-bold',
                  filters.unreadOnly ? 'bg-card/20' : 'bg-destructive text-destructive-foreground'
                )}
              >
                {unreadCount}
              </span>
            )}
          </Badge>
          <Badge
            variant={filters.unprocessedOnly ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer gap-1.5 transition-all h-7 px-3',
              filters.unprocessedOnly ? 'hover:bg-primary/90' : 'hover:bg-accent'
            )}
            onClick={() => {
              updateFilter('unreadOnly', false)
              updateFilter('unprocessedOnly', true)
            }}
          >
            <CircleDashed className="h-3 w-3" />
            Non traités
          </Badge>
        </div>
      )}

      {/* Search bar + Actions */}
      <div className="flex items-center gap-2">
        {isSelectionMode && threadsCount > 0 && (
          <div className="flex items-center">
            <Checkbox
              checked={selectedCount === threadsCount && threadsCount > 0}
              onCheckedChange={onSelectAll}
              className="h-4 w-4"
            />
          </div>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
          <Input
            placeholder="Rechercher..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9 h-9 bg-card/70 border-primary/10 focus:bg-card focus:ring-1 focus:ring-primary/20 rounded-lg"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 rounded-lg transition-all',
              isSelectionMode
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-card/50 hover:bg-card/80 text-muted-foreground hover:text-primary border border-transparent hover:border-primary/10'
            )}
            onClick={onToggleSelectionMode}
            title="Mode sélection"
            aria-label="Tout sélectionner"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg bg-card/50 hover:bg-card/80 text-muted-foreground hover:text-primary border border-transparent hover:border-primary/10"
            onClick={onSyncNow}
            disabled={isSyncing}
            title="Synchroniser"
            aria-label="Actualiser"
          >
            <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10"
            onClick={onComposeNew}
            title="Nouveau message"
            aria-label="Ajouter"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
