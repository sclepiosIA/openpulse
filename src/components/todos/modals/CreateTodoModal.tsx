import React, { useState } from 'react'
import { toast } from 'sonner'
import { useCreatePersonalTodo } from '@/hooks/tasks/usePersonalTodos'
import { useTodoProjects } from '@/hooks/tasks/useTodoProjects'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useActiveProfiles } from '@/hooks/profile/useProfiles'
import { useRDUserStoriesSelect } from '@/hooks/rd/useRDUserStoriesSelect'
import { useSupportTicketsSelect } from '@/hooks/support/useSupportTicketsSelect'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  CalendarIcon,
  Flag,
  Building2,
  Loader2,
  User,
  Users,
  ChevronDown,
  Link2,
  Lightbulb,
  Headphones,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface CreateTodoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string | null
  defaultEtablissementId?: string | null
}

type VisibilityType = 'personal' | 'assigned' | 'team'

export function CreateTodoModal({
  open,
  onOpenChange,
  defaultProjectId,
  defaultEtablissementId,
}: CreateTodoModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId || null)
  const [etablissementId, setEtablissementId] = useState<string | null>(
    defaultEtablissementId || null
  )

  // New fields
  const [visibilityType, setVisibilityType] = useState<VisibilityType>('personal')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [rdUserStoryId, setRdUserStoryId] = useState<string | null>(null)
  const [supportTicketId, setSupportTicketId] = useState<string | null>(null)
  const [operationsOpen, setOperationsOpen] = useState(false)

  const createTodo = useCreatePersonalTodo()
  const { data: projects = [] } = useTodoProjects()
  const { data: etablissements = [] } = useEtablissements()
  const { data: activeProfiles = [] } = useActiveProfiles()
  const { data: rdUserStories = [] } = useRDUserStoriesSelect()
  const { data: supportTickets = [] } = useSupportTicketsSelect()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Le titre de la tâche est obligatoire')
      return
    }

    // Determine visibility based on type
    const visibility = visibilityType === 'team' ? 'all' : 'personal'

    await createTodo.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      project_id: projectId,
      etablissement_id: etablissementId,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      priority,
      assigned_to: visibilityType === 'assigned' ? assignedTo : null,
      rd_user_story_id: rdUserStoryId,
      support_ticket_id: supportTicketId,
      visibility,
    })

    // Reset and close
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setDueDate(undefined)
    setPriority('medium')
    setProjectId(defaultProjectId || null)
    setEtablissementId(defaultEtablissementId || null)
    setVisibilityType('personal')
    setAssignedTo(null)
    setRdUserStoryId(null)
    setSupportTicketId(null)
    setOperationsOpen(false)
  }

  const priorities: { value: typeof priority; label: string; color: string }[] = [
    { value: 'low', label: 'Basse', color: 'text-muted-foreground' },
    { value: 'medium', label: 'Moyenne', color: 'text-amber-500' },
    { value: 'high', label: 'Haute', color: 'text-orange-500' },
    { value: 'urgent', label: 'Urgente', color: 'text-destructive' },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm()
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Que devez-vous faire ?"
              autoFocus
              className="mt-1 rounded-lg"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajouter des détails..."
              className="mt-1 min-h-[80px] resize-none rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Due Date */}
            <div>
              <Label>Date d'échéance</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start mt-1 rounded-lg',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dueDate ? format(dueDate, 'd MMM', { locale: fr }) : 'Choisir'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={fr} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Priority */}
            <div>
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v: typeof priority) => setPriority(v)}>
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
            </div>
          </div>

          {/* Visibility Section */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Visibilité
            </Label>
            <RadioGroup
              value={visibilityType}
              onValueChange={(v) => {
                setVisibilityType(v as VisibilityType)
                if (v !== 'assigned') setAssignedTo(null)
              }}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personal" id="vis-personal" />
                <Label
                  htmlFor="vis-personal"
                  className="flex items-center gap-1 cursor-pointer text-sm"
                >
                  <User className="h-4 w-4" />
                  Pour moi
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="assigned" id="vis-assigned" />
                <Label
                  htmlFor="vis-assigned"
                  className="flex items-center gap-1 cursor-pointer text-sm"
                >
                  <User className="h-4 w-4" />
                  Pour un membre
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="team" id="vis-team" />
                <Label
                  htmlFor="vis-team"
                  className="flex items-center gap-1 cursor-pointer text-sm"
                >
                  <Users className="h-4 w-4" />
                  Pour l'équipe
                </Label>
              </div>
            </RadioGroup>

            {/* Assignee select when "assigned" is selected */}
            {visibilityType === 'assigned' && (
              <div>
                <Label>Assigner à</Label>
                <Select
                  value={assignedTo || 'none'}
                  onValueChange={(v) => setAssignedTo(v === 'none' ? null : v)}
                >
                  <SelectTrigger className="mt-1 rounded-lg">
                    <SelectValue placeholder="Sélectionner un membre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sélectionner...</SelectItem>
                    {activeProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {profile.prenom} {profile.nom}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Project */}
            <div>
              <Label>Projet</Label>
              <Select
                value={projectId || 'none'}
                onValueChange={(v) => setProjectId(v === 'none' ? null : v)}
              >
                <SelectTrigger className="mt-1 rounded-lg">
                  <SelectValue placeholder="Aucun" />
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

            {/* Etablissement */}
            <div>
              <Label>Établissement</Label>
              <Select
                value={etablissementId || 'none'}
                onValueChange={(v) => setEtablissementId(v === 'none' ? null : v)}
              >
                <SelectTrigger className="mt-1 rounded-lg">
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {etablissements.slice(0, 20).map((etab) => (
                    <SelectItem key={etab.id} value={etab.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{etab.nom}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Operations Link Section */}
          <Collapsible open={operationsOpen} onOpenChange={setOperationsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground rounded-lg"
              >
                <span className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Lier à une opération
                </span>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', operationsOpen && 'rotate-180')}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {/* R&D User Story */}
              <div>
                <Label className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4 text-violet-500" />
                  User Story R&D
                </Label>
                <Select
                  value={rdUserStoryId || 'none'}
                  onValueChange={(v) => setRdUserStoryId(v === 'none' ? null : v)}
                >
                  <SelectTrigger className="mt-1 rounded-lg">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {rdUserStories.map((story) => (
                      <SelectItem key={story.id} value={story.id}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{story.titre}</span>
                          <span className="text-xs text-muted-foreground">
                            ({story.projet_nom})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Support Ticket */}
              <div>
                <Label className="flex items-center gap-2 text-sm">
                  <Headphones className="h-4 w-4 text-blue-500" />
                  Ticket Support
                </Label>
                <Select
                  value={supportTicketId || 'none'}
                  onValueChange={(v) => setSupportTicketId(v === 'none' ? null : v)}
                >
                  <SelectTrigger className="mt-1 rounded-lg">
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {supportTickets.map((ticket) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{ticket.numero_ticket}
                          </span>
                          <span className="truncate">{ticket.titre}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createTodo.isPending}
              className="rounded-xl bg-primary hover:bg-primary/90"
            >
              {createTodo.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
