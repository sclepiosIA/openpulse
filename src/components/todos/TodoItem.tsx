import React from 'react'
import { UnifiedTodo, formatDueDate, getDueDateColor } from '@/hooks/tasks/useUnifiedTodos'
import { useTogglePersonalTodo } from '@/hooks/tasks/usePersonalTodos'
import { useToggleTodoItem } from '@/hooks/pulse/usePulseTodos'
import { useUpdateTache } from '@/hooks/tasks/useTaches'

import { Badge } from '@/components/ui/badge'
import {
  Building2,
  User,
  MessageCircle,
  Calendar,
  Flag,
  ChevronRight,
  Lightbulb,
  Headphones,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TodoItemProps {
  todo: UnifiedTodo
  isSelected?: boolean
  onClick?: () => void
}

export function TodoItem({ todo, isSelected, onClick }: TodoItemProps) {
  const [optimisticDone, setOptimisticDone] = React.useState<boolean | null>(null)
  const togglePersonalTodo = useTogglePersonalTodo()
  const togglePulseTodo = useToggleTodoItem()
  const updateTache = useUpdateTache()

  // Reset optimistic state when server data catches up
  React.useEffect(() => {
    setOptimisticDone(null)
  }, [todo.is_done])

  const isDone = optimisticDone !== null ? optimisticDone : todo.is_done

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const newIsDone = !isDone
    setOptimisticDone(newIsDone)

    if (todo.source === 'personal') {
      togglePersonalTodo.mutate({ id: todo.id, is_done: newIsDone })
    } else if (todo.source === 'etablissement') {
      updateTache.mutate({
        id: todo.id,
        data: { statut: newIsDone ? 'Terminé' : 'A faire' },
      })
    } else if (todo.source === 'pulse' && todo.pulse_item_id) {
      togglePulseTodo.mutate({
        itemId: todo.pulse_item_id,
        isDone: newIsDone,
      })
    }
  }

  const priorityColors = {
    urgent: 'text-destructive',
    high: 'text-orange-500',
    medium: 'text-amber-500',
    low: 'text-muted-foreground',
  }

  const priorityBorderColors = {
    urgent: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-amber-400',
    low: 'border-l-slate-300',
  }

  const sourceIcons = {
    personal: <User className="h-3 w-3" />,
    etablissement: <Building2 className="h-3 w-3" />,
    pulse: <MessageCircle className="h-3 w-3" />,
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all',
        'bg-card/70 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none',
        'border-l-4 md:border-l-0 md:border border-transparent',
        priorityBorderColors[todo.priority],
        'hover:bg-card/90 md:hover:bg-primary/5 hover:shadow-sm md:hover:shadow-none',
        isSelected &&
          'bg-card md:bg-primary/10 shadow-sm md:shadow-none ring-1 ring-primary/20 md:ring-0 md:border-primary/20',
        isDone && 'opacity-60'
      )}
      onClick={onClick}
    >
      {/* Checkbox - larger hit area */}
      <button
        type="button"
        className="mt-0.5 flex-shrink-0 p-1 -m-1 rounded-lg hover:bg-muted/50 transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleToggle}
      >
        <div
          className={cn(
            'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-300',
            isDone
              ? 'bg-primary border-primary scale-110'
              : cn('border-muted-foreground/50 hover:border-primary', priorityColors[todo.priority])
          )}
        >
          {isDone && (
            <svg
              className="h-3 w-3 text-primary-foreground animate-in zoom-in-50 duration-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate transition-all duration-300',
            isDone && 'line-through text-muted-foreground'
          )}
        >
          {todo.title}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
          {/* Source */}
          <span className="flex items-center gap-1">
            {sourceIcons[todo.source]}
            {todo.source === 'etablissement' && todo.etablissement_name && (
              <span className="truncate max-w-[100px]">{todo.etablissement_name}</span>
            )}
            {todo.source === 'personal' && todo.project_name && (
              <span
                className="truncate max-w-[100px]"
                style={{ color: todo.project_color || undefined }}
              >
                {todo.project_name}
              </span>
            )}
            {todo.source === 'pulse' && todo.conversation_name && (
              <span className="truncate max-w-[100px]">{todo.conversation_name}</span>
            )}
          </span>

          {/* Assigned to */}
          {todo.assigned_to_name && (
            <span className="flex items-center gap-1 text-blue-500">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{todo.assigned_to_name}</span>
            </span>
          )}

          {/* Team visibility */}
          {todo.visibility === 'all' && (
            <span className="flex items-center gap-1 text-violet-500">
              <Users className="h-3 w-3" />
            </span>
          )}

          {/* Due date */}
          {todo.due_date && (
            <span className={cn('flex items-center gap-1', getDueDateColor(todo.due_date, isDone))}>
              <Calendar className="h-3 w-3" />
              {formatDueDate(todo.due_date)}
            </span>
          )}

          {/* Priority indicator for high/urgent */}
          {(todo.priority === 'high' || todo.priority === 'urgent') && !isDone && (
            <Flag className={cn('h-3 w-3', priorityColors[todo.priority])} />
          )}

          {/* R&D User Story badge */}
          {todo.rd_user_story_id && (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] bg-violet-50/80 text-violet-600 border-violet-200/50 rounded-md"
            >
              <Lightbulb className="h-2.5 w-2.5 mr-0.5" />
              R&D
            </Badge>
          )}

          {/* Support Ticket badge */}
          {todo.support_ticket_id && (
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] bg-blue-50/80 text-blue-600 border-blue-200/50 rounded-md"
            >
              <Headphones className="h-2.5 w-2.5 mr-0.5" />
              Support
            </Badge>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
    </div>
  )
}
