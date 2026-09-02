/**
 * JarvisDashboardWidget - Widget inline Jarvis pour le Dashboard
 *
 * Affiche les suggestions proactives et permet des interactions rapides
 */

import { useState, useCallback } from 'react'
import {
  Send,
  Maximize2,
  ChevronRight,
  Bot,
  AlertTriangle,
  Mail,
  ListTodo,
  TrendingDown,
  Ticket,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useJarvis } from '@/hooks/jarvis/useJarvis'
import {
  useJarvisProactiveAlerts,
  type ProactiveAlert,
} from '@/hooks/jarvis/useJarvisProactiveAlerts'
import { useNavigate } from 'react-router-dom'
// Cadre carre de 32 px : symbole, pas lettrage horizontal.
import symboleMarque from '@/assets/marque/symbole.svg'

interface JarvisDashboardWidgetProps {
  maxSuggestions?: number
  showQuickInput?: boolean
  compact?: boolean
  onOpenModal?: () => void
  className?: string
}

// Icon mapping for alert types
const getAlertIcon = (type: string) => {
  switch (type) {
    case 'overdue_task':
      return ListTodo
    case 'pending_emails':
      return Mail
    case 'cold_prospect':
      return TrendingDown
    case 'unpaid_invoices':
      return AlertTriangle
    case 'pending_ticket':
      return Ticket
    default:
      return Sparkles
  }
}

// Priority colors
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical':
      return 'text-red-500 bg-red-500/10'
    case 'high':
      return 'text-orange-500 bg-orange-500/10'
    case 'medium':
      return 'text-amber-500 bg-amber-500/10'
    default:
      return 'text-blue-500 bg-blue-500/10'
  }
}

export function JarvisDashboardWidget({
  maxSuggestions = 3,
  showQuickInput = true,
  compact = false,
  onOpenModal,
  className,
}: JarvisDashboardWidgetProps) {
  const navigate = useNavigate()
  const [quickInput, setQuickInput] = useState('')

  const { alerts, unreadCount, markAsRead, dismissAlert } = useJarvisProactiveAlerts()
  const { chat, isTyping } = useJarvis()

  // Handle quick input submission
  const handleQuickSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!quickInput.trim() || isTyping) return

      const message = quickInput
      setQuickInput('')

      await chat(message)

      // Optionally open the modal to show the response
      onOpenModal?.()
    },
    [quickInput, isTyping, chat, onOpenModal]
  )

  // Handle alert action
  const handleAlertAction = useCallback(
    async (alert: ProactiveAlert) => {
      // Mark as read
      await markAsRead(alert.id)

      // Execute action
      if (alert.action_type === 'navigate' && alert.action_data.path) {
        navigate(alert.action_data.path as string)
      } else if (alert.action_type === 'open_jarvis' && alert.action_data.command) {
        setQuickInput(alert.action_data.command as string)
        onOpenModal?.()
      }
    },
    [markAsRead, navigate, onOpenModal]
  )

  // Handle dismiss
  const handleDismiss = useCallback(
    (e: React.MouseEvent, alertId: string) => {
      e.stopPropagation()
      dismissAlert(alertId)
    },
    [dismissAlert]
  )

  // Open Jarvis modal
  const openJarvisModal = useCallback(() => {
    // Dispatch custom event to open Jarvis modal
    window.dispatchEvent(new CustomEvent('open-jarvis'))
    onOpenModal?.()
  }, [onOpenModal])

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur-sm',
        className
      )}
    >
      {/* Header avec avatar Jarvis animé */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/30">
        <motion.div
          className="relative"
          animate={{ scale: isTyping ? [1, 1.1, 1] : 1 }}
          transition={{ repeat: isTyping ? Infinity : 0, duration: 1.5 }}
        >
          <div className="p-2 rounded-xl bg-card/80 shadow-md">
            <img
              loading="lazy"
              decoding="async"
              src={symboleMarque}
              className="h-8 w-8 object-contain"
              alt="Jarvis"
            />
          </div>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1"
            >
              <Badge className="h-5 min-w-[20px] px-1.5 bg-red-500 text-white border-0 text-[10px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            </motion.div>
          )}
        </motion.div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">JARVIS</h3>
          <p className="text-xs text-muted-foreground truncate">
            {isTyping ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Réfléchit...
              </span>
            ) : alerts.length > 0 ? (
              `${alerts.length} suggestion${alerts.length > 1 ? 's' : ''}`
            ) : (
              'Tout est en ordre ✨'
            )}
          </p>
        </div>

        {/* Bouton ouvrir modal complète */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={openJarvisModal}
          aria-label="Agrandir"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Suggestions proactives */}
      <div className="px-3 py-2 space-y-1.5 max-h-[200px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {alerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 py-4 text-center"
            >
              <div className="p-3 rounded-full bg-emerald-500/10">
                <Bot className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground">Aucune action urgente</p>
            </motion.div>
          ) : (
            alerts.slice(0, maxSuggestions).map((alert, index) => {
              const Icon = getAlertIcon(alert.type)
              const priorityColor = getPriorityColor(alert.priority)

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all',
                    'hover:bg-muted/80',
                    !alert.read && 'bg-muted/50'
                  )}
                  onClick={() => handleAlertAction(alert)}
                >
                  <div className={cn('p-1.5 rounded-lg', priorityColor)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{alert.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{alert.message}</p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => handleDismiss(e, alert.id)}
                      aria-label="Ignorer l'alerte"
                      title="Ignorer"
                    >
                      <span className="text-[10px]">✕</span>
                    </Button>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>

        {alerts.length > maxSuggestions && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground"
            onClick={openJarvisModal}
          >
            Voir {alerts.length - maxSuggestions} autres suggestions
          </Button>
        )}
      </div>

      {/* Quick Input */}
      {showQuickInput && !compact && (
        <div className="p-3 border-t border-border/30">
          <form onSubmit={handleQuickSubmit} className="flex gap-2">
            <Input
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Demander à Jarvis..."
              className="h-8 text-xs"
              disabled={isTyping}
            />
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!quickInput.trim() || isTyping}
              aria-label="Chargement"
            >
              {isTyping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      )}
    </Card>
  )
}
