import React, { useState, useRef, useEffect } from 'react'
import { useCreatePersonalTodo } from '@/hooks/tasks/usePersonalTodos'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, Flag, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CsrfToken } from '@/components/security/CsrfToken'

const MAX_TITLE_LENGTH = 255
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format, addDays, nextMonday } from 'date-fns'
import { fr } from 'date-fns/locale'

interface TodoQuickAddProps {
  projectId?: string | null
  etablissementId?: string | null
}

export function TodoQuickAdd({ projectId, etablissementId }: TodoQuickAddProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const inputRef = useRef<HTMLInputElement>(null)
  const createTodo = useCreatePersonalTodo()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (
          target.tagName !== 'INPUT' &&
          target.tagName !== 'TEXTAREA' &&
          !target.isContentEditable
        ) {
          e.preventDefault()
          setIsExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const trimmedLength = title.trim().length
  const overLimit = trimmedLength > MAX_TITLE_LENGTH
  const showRequiredError = title.length > 0 && trimmedLength === 0

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Le titre de la tâche est obligatoire')
      return
    }
    if (overLimit) {
      toast.error(`Le titre ne peut dépasser ${MAX_TITLE_LENGTH} caractères`)
      return
    }

    createTodo.mutate({
      title: title.trim(),
      project_id: projectId,
      etablissement_id: etablissementId,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      priority,
    })

    setTitle('')
    setDueDate(undefined)
    setPriority('medium')
    setIsExpanded(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setIsExpanded(false)
      setTitle('')
    }
  }

  const quickDates = [
    { label: "Aujourd'hui", date: new Date() },
    { label: 'Demain', date: addDays(new Date(), 1) },
    { label: 'Lundi', date: nextMonday(new Date()) },
  ]

  const priorities: {
    value: 'low' | 'medium' | 'high' | 'urgent'
    label: string
    color: string
  }[] = [
    { value: 'low', label: 'Basse', color: 'text-muted-foreground' },
    { value: 'medium', label: 'Moyenne', color: 'text-amber-500' },
    { value: 'high', label: 'Haute', color: 'text-orange-500' },
    { value: 'urgent', label: 'Urgente', color: 'text-destructive' },
  ]

  if (!isExpanded) {
    return (
      <button
        className="w-full p-4 text-left text-muted-foreground hover:bg-primary/5 border-b border-primary/10 flex items-center gap-2 transition-colors"
        onClick={() => {
          setIsExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
      >
        <Plus className="h-4 w-4" />
        <span>Ajouter une tâche</span>
        <span className="ml-auto text-xs opacity-50">Q</span>
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="p-4 border-b border-primary/10 bg-gradient-to-r from-slate-50/80 to-white/60 backdrop-blur-sm space-y-3"
      noValidate
    >
      <CsrfToken />
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
        onKeyDown={handleKeyDown}
        placeholder="Que devez-vous faire ?"
        maxLength={MAX_TITLE_LENGTH}
        aria-invalid={showRequiredError || overLimit}
        aria-describedby="todo-title-help"
        className="text-base rounded-xl bg-card/80 border-primary/10"
        autoFocus
      />
      <p
        id="todo-title-help"
        className={cn(
          'text-xs',
          showRequiredError || overLimit ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {showRequiredError
          ? 'Le titre est obligatoire.'
          : overLimit
            ? `Le titre dépasse ${MAX_TITLE_LENGTH} caractères.`
            : `${trimmedLength}/${MAX_TITLE_LENGTH} caractères`}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 rounded-lg bg-card/80 hover:bg-card border-slate-200/50',
                dueDate && 'text-primary border-primary/30'
              )}
            >
              <Calendar className="h-4 w-4" />
              {dueDate ? format(dueDate, 'd MMM', { locale: fr }) : 'Date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-2 border-b border-border space-y-1">
              {quickDates.map((qd) => (
                <Button
                  key={qd.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start rounded-lg"
                  onClick={() => setDueDate(qd.date)}
                >
                  {qd.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground rounded-lg"
                onClick={() => setDueDate(undefined)}
              >
                Pas de date
              </Button>
            </div>
            <CalendarComponent
              mode="single"
              selected={dueDate}
              onSelect={setDueDate}
              locale={fr}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Priority picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 rounded-lg bg-card/80 hover:bg-card border-slate-200/50',
                priority !== 'medium' && priorities.find((p) => p.value === priority)?.color
              )}
            >
              <Flag className="h-4 w-4" />
              {priorities.find((p) => p.value === priority)?.label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            {priorities.map((p) => (
              <Button
                key={p.value}
                type="button"
                variant={priority === p.value ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('w-full justify-start gap-2 rounded-lg', p.color)}
                onClick={() => setPriority(p.value)}
              >
                <Flag className="h-4 w-4" />
                {p.label}
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-lg bg-slate-50/80 hover:bg-slate-100/80 text-foreground"
          onClick={() => {
            setIsExpanded(false)
            setTitle('')
            setDueDate(undefined)
            setPriority('medium')
          }}
        >
          Annuler
        </Button>

        <Button
          type="submit"
          size="sm"
          disabled={createTodo.isPending || !title.trim() || overLimit}
          className="gap-2 rounded-xl bg-primary hover:bg-primary/90"
        >
          <Send className="h-4 w-4" />
          Ajouter
        </Button>
      </div>
    </form>
  )
}
