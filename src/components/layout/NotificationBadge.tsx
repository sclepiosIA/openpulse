import { useState, useMemo } from 'react'
import {
  Bell,
  Check,
  Trash2,
  CheckCheck,
  Search,
  X,
  Filter,
  Plus,
  Bug,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useInAppNotifications,
  type InAppNotification,
} from '@/hooks/dashboard/useInAppNotifications'
import { useNotificationTest } from '@/hooks/notifications/useNotificationTest'
import { useAuth } from '@/hooks/shared/useAuth'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface NotificationBadgeProps {
  variant?: 'default' | 'ghost-white'
}

export function NotificationBadge({ variant = 'default' }: NotificationBadgeProps) {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } =
    useInAppNotifications()
  const { createTestNotification, isCreating } = useNotificationTest()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [showDiagnostic, setShowDiagnostic] = useState(false)

  const isGhostWhite = variant === 'ghost-white'

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ai_suggestion':
        return '🤖'
      case 'task_assignment':
        return '📋'
      case 'task_completion':
        return '✅'
      case 'establishment_update':
        return '🏢'
      case 'mention':
        return '💬'
      default:
        return '🔔'
    }
  }

  // Filter and search notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          notif.title.toLowerCase().includes(query) || notif.message.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Type filter
      if (typeFilter !== 'all' && notif.type !== typeFilter) {
        return false
      }

      // Status filter (read/unread)
      if (statusFilter === 'read' && !notif.is_read) return false
      if (statusFilter === 'unread' && notif.is_read) return false

      // Date filter
      if (dateFilter !== 'all') {
        const notifDate = new Date(notif.created_at)
        const now = new Date()
        const diffInHours = (now.getTime() - notifDate.getTime()) / (1000 * 60 * 60)

        if (dateFilter === 'today' && diffInHours > 24) return false
        if (dateFilter === 'week' && diffInHours > 168) return false
        if (dateFilter === 'month' && diffInHours > 720) return false
      }

      return true
    })
  }, [notifications, searchQuery, typeFilter, statusFilter, dateFilter])

  const handleNotificationClick = (notification: InAppNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    // Navigate to related item
    if (notification.related_type === 'etablissement' && notification.related_id) {
      navigate(`/etablissements/${notification.related_id}`)
    } else if (notification.related_type === 'tache' && notification.related_id) {
      // Navigate to task - adjust based on your routing
      navigate(`/projets`)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setDateFilter('all')
  }

  const hasActiveFilters =
    searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} non lues)` : 'Notifications'}
          className={cn(
            'relative',
            isGhostWhite && 'text-white/80 hover:text-white hover:bg-card/20'
          )}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0 bg-popover z-50" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Diagnostic des notifications"
                    onClick={() => setShowDiagnostic(!showDiagnostic)}
                  >
                    <Bug className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Diagnostic</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createTestNotification()}
                    disabled={isCreating}
                    className="h-8 text-xs"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Test
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Créer une notification de test</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {unreadCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsRead()}
                      className="h-8 text-xs"
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Tout lu
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Marquer toutes les notifications comme lues</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Diagnostic Panel */}
        {showDiagnostic && (
          <div className="p-3 bg-muted/50 border-b border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <code className="text-[10px] bg-muted px-1 rounded truncate max-w-[180px]">
                {user?.id || 'N/A'}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notifications:</span>
              <span>
                {notifications.length} total, {unreadCount} non lues
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Statut:</span>
              <span>{isLoading ? 'Chargement...' : 'Chargé'}</span>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="p-3 space-y-3 bg-muted/30 border-b border-border">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-3 gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="ai_suggestion">🤖 Suggestions IA</SelectItem>
                <SelectItem value="task_assignment">📋 Tâches</SelectItem>
                <SelectItem value="task_completion">✅ Terminées</SelectItem>
                <SelectItem value="establishment_update">🏢 Établissements</SelectItem>
                <SelectItem value="mention">💬 Mentions</SelectItem>
                <SelectItem value="other">🔔 Autres</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="unread">Non lues</SelectItem>
                <SelectItem value="read">Lues</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full h-8 text-xs">
              <X className="w-3 h-3 mr-1" />
              Réinitialiser les filtres
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Chargement...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {notifications.length === 0
                  ? 'Aucune notification'
                  : 'Aucune notification ne correspond aux filtres'}
              </p>
              {hasActiveFilters && notifications.length > 0 && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-muted/50 transition-colors cursor-pointer group',
                    !notification.is_read && 'bg-muted/30'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={cn(
                            'text-sm font-medium truncate',
                            !notification.is_read && 'font-semibold'
                          )}
                        >
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.is_read && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    aria-label="Marquer comme lu"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      markAsRead(notification.id)
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Marquer comme lu</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  aria-label="Supprimer la notification"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNotification(notification.id)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
