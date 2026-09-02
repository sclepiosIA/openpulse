import React, { useState, useEffect } from 'react'
import { UnifiedTodo, formatDueDate, getDueDateColor } from '@/hooks/tasks/useUnifiedTodos'
import { useUpdatePersonalTodo, useDeletePersonalTodo } from '@/hooks/tasks/usePersonalTodos'
import { useTodoProjects } from '@/hooks/tasks/useTodoProjects'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useActiveProfiles } from '@/hooks/profile/useProfiles'
import { useRDUserStoriesSelect } from '@/hooks/rd/useRDUserStoriesSelect'
import { useSupportTicketsSelect } from '@/hooks/support/useSupportTicketsSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  X,
  Calendar as CalendarIcon,
  Building2,
  Flag,
  Trash2,
  ExternalLink,
  MessageCircle,
  User,
  Lightbulb,
  Headphones,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

interface TodoDetailPanelProps {
  todo: UnifiedTodo
  onClose: () => void
}

export function TodoDetailPanel({ todo, onClose }: TodoDetailPanelProps) {
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description || '')
  const [dueDate, setDueDate] = useState<Date | undefined>(
    todo.due_date ? new Date(todo.due_date) : undefined
  )
  const [priority, setPriority] = useState(todo.priority)
  const [projectId, setProjectId] = useState<string | null>(todo.project_id)
  const [etablissementId, setEtablissementId] = useState<string | null>(todo.etablissement_id)

  const updateTodo = useUpdatePersonalTodo()
  const deleteTodo = useDeletePersonalTodo()
  const { data: projects = [] } = useTodoProjects()
  const { data: etablissements = [] } = useEtablissements()
  const { data: activeProfiles = [] } = useActiveProfiles()
  const { data: rdUserStories = [] } = useRDUserStoriesSelect()
  const { data: supportTickets = [] } = useSupportTicketsSelect()

  // Update local state when todo changes
  useEffect(() => {
    setTitle(todo.title)
    setDescription(todo.description || '')
    setDueDate(todo.due_date ? new Date(todo.due_date) : undefined)
    setPriority(todo.priority)
    setProjectId(todo.project_id)
    setEtablissementId(todo.etablissement_id)
  }, [todo])

  const handleSave = () => {
    if (todo.source !== 'personal') return

    updateTodo.mutate({
      id: todo.id,
      title,
      description: description || null,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      priority,
      project_id: projectId,
      etablissement_id: etablissementId,
    })
  }

  const handleDelete = () => {
    if (todo.source !== 'personal') return
    deleteTodo.mutate(todo.id)
    onClose()
  }

  const isEditable = todo.source === 'personal'

  const priorities: { value: typeof priority; label: string; color: string }[] = [
    { value: 'low', label: 'Basse', color: 'text-muted-foreground' },
    { value: 'medium', label: 'Moyenne', color: 'text-amber-500' },
    { value: 'high', label: 'Haute', color: 'text-orange-500' },
    { value: 'urgent', label: 'Urgente', color: 'text-destructive' },
  ]

  const sourceInfo = {
    personal: { icon: <User className="h-4 w-4" />, label: 'Personnel' },
    etablissement: { icon: <Building2 className="h-4 w-4" />, label: 'Établissement' },
    pulse: { icon: <MessageCircle className="h-4 w-4" />, label: 'Pulse' },
  }

  // Find linked items
  const linkedUserStory = rdUserStories.find((s) => s.id === todo.rd_user_story_id)
  const linkedTicket = supportTickets.find((t) => t.id === todo.support_ticket_id)
  const assignedProfile = activeProfiles.find((p) => p.id === todo.assigned_to_id)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-primary/10 bg-gradient-to-r from-slate-50/80 to-white/60">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {sourceInfo[todo.source].icon}
          <span>{sourceInfo[todo.source].label}</span>
          {todo.visibility === 'all' && (
            <Badge variant="outline" className="ml-2 rounded-md">
              <Users className="h-3 w-3 mr-1" />
              Équipe
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-lg bg-slate-50/80 hover:bg-slate-100"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          {isEditable ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              className="text-lg font-semibold border-none px-0 focus-visible:ring-0"
              placeholder="Titre de la tâche"
            />
          ) : (
            <h2 className="text-lg font-semibold">{title}</h2>
          )}
        </div>

        {/* Description */}
        <div>
          <Label className="text-xs text-muted-foreground">Description</Label>
          {isEditable ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              placeholder="Ajouter une description..."
              className="mt-1 min-h-[100px] resize-none rounded-lg"
            />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {description || 'Aucune description'}
            </p>
          )}
        </div>

        {/* Assigned To */}
        {(todo.assigned_to_id || assignedProfile) && (
          <div>
            <Label className="text-xs text-muted-foreground">Assigné à</Label>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-blue-500" />
              <span>
                {todo.assigned_to_name || `${assignedProfile?.prenom} ${assignedProfile?.nom}`}
              </span>
            </div>
          </div>
        )}

        {/* Due Date */}
        <div>
          <Label className="text-xs text-muted-foreground">Date d'échéance</Label>
          {isEditable ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start mt-1 rounded-lg bg-card/80 border-slate-200/50 hover:border-primary/30',
                    !dueDate && 'text-muted-foreground',
                    dueDate && getDueDateColor(format(dueDate, 'yyyy-MM-dd'), todo.is_done)
                  )}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dueDate ? format(dueDate, 'd MMMM yyyy', { locale: fr }) : 'Choisir une date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    setDueDate(date)
                    setTimeout(handleSave, 100)
                  }}
                  locale={fr}
                />
                {dueDate && (
                  <div className="p-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-lg"
                      onClick={() => {
                        setDueDate(undefined)
                        setTimeout(handleSave, 100)
                      }}
                    >
                      Supprimer la date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          ) : (
            <p
              className={cn(
                'mt-1 text-sm flex items-center gap-2',
                getDueDateColor(todo.due_date, todo.is_done)
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {todo.due_date ? formatDueDate(todo.due_date) : 'Aucune date'}
            </p>
          )}
        </div>

        {/* Priority */}
        <div>
          <Label className="text-xs text-muted-foreground">Priorité</Label>
          {isEditable ? (
            <Select
              value={priority}
              onValueChange={(value: typeof priority) => {
                setPriority(value)
                setTimeout(handleSave, 100)
              }}
            >
              <SelectTrigger className="mt-1 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className={cn('flex items-center gap-2', p.color)}>
                      <Flag className="h-4 w-4" />
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p
              className={cn(
                'mt-1 text-sm flex items-center gap-2',
                priorities.find((p) => p.value === priority)?.color
              )}
            >
              <Flag className="h-4 w-4" />
              {priorities.find((p) => p.value === priority)?.label}
            </p>
          )}
        </div>

        {/* Project */}
        {isEditable && (
          <div>
            <Label className="text-xs text-muted-foreground">Projet</Label>
            <Select
              value={projectId || 'none'}
              onValueChange={(value) => {
                setProjectId(value === 'none' ? null : value)
                setTimeout(handleSave, 100)
              }}
            >
              <SelectTrigger className="mt-1 rounded-lg">
                <SelectValue placeholder="Aucun projet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun projet</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: project.color }}
                      />
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Etablissement */}
        {isEditable && (
          <div>
            <Label className="text-xs text-muted-foreground">Établissement</Label>
            <Select
              value={etablissementId || 'none'}
              onValueChange={(value) => {
                setEtablissementId(value === 'none' ? null : value)
                setTimeout(handleSave, 100)
              }}
            >
              <SelectTrigger className="mt-1 rounded-lg">
                <SelectValue placeholder="Aucun établissement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun établissement</SelectItem>
                {etablissements.slice(0, 20).map((etab) => (
                  <SelectItem key={etab.id} value={etab.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3" />
                      {etab.nom}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Linked Operations Section */}
        {(linkedUserStory ||
          linkedTicket ||
          todo.rd_user_story_title ||
          todo.support_ticket_title) && (
          <div className="space-y-2 pt-2 border-t border-primary/10">
            <Label className="text-xs text-muted-foreground">Lié à</Label>

            {/* R&D User Story Link */}
            {(linkedUserStory || todo.rd_user_story_title) && (
              <Link
                to="/rd"
                className="flex items-center gap-2 p-3 rounded-xl bg-violet-50/80 text-violet-600 hover:bg-violet-100/80 border border-violet-200/30 transition-all"
              >
                <Lightbulb className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {linkedUserStory?.titre || todo.rd_user_story_title}
                  </p>
                  {linkedUserStory?.projet_nom && (
                    <p className="text-xs opacity-70">{linkedUserStory.projet_nom}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
              </Link>
            )}

            {/* Support Ticket Link */}
            {(linkedTicket || todo.support_ticket_title) && (
              <Link
                to="/support"
                className="flex items-center gap-2 p-3 rounded-xl bg-blue-50/80 text-blue-600 hover:bg-blue-100/80 border border-blue-200/30 transition-all"
              >
                <Headphones className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {linkedTicket?.titre || todo.support_ticket_title}
                  </p>
                  {linkedTicket?.numero_ticket && (
                    <p className="text-xs opacity-70">#{linkedTicket.numero_ticket}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
              </Link>
            )}
          </div>
        )}

        {/* Links for non-personal todos */}
        {todo.source === 'etablissement' && todo.etablissement_id && (
          <Link
            to={`/etablissements/${todo.etablissement_id}`}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Voir l'établissement
          </Link>
        )}

        {todo.source === 'pulse' && todo.conversation_id && (
          <Link
            to={`/m/pulse?conversation=${todo.conversation_id}`}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Voir la conversation Pulse
          </Link>
        )}
      </div>

      {/* Footer with delete */}
      {isEditable && (
        <div className="p-4 border-t border-primary/10">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full gap-2 rounded-xl">
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-lg">Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="rounded-lg">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
