import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ActivityRichEditor } from './ActivityRichEditor'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { useCustomerActivities, useCreateActivity, ActivityType } from '@/hooks/crm/useCustomerActivities'
import { useAuth } from '@/hooks/shared/useAuth'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Calendar,
  Plus,
  Loader2,
  Filter,
  ChevronDown,
  ChevronRight,
  BarChart3,
  GraduationCap,
  Ticket,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ClipboardList,
  Heart,
  StickyNote,
  Users,
  Mail,
  AlertCircle,
  Phone,
  Video,
  FileText,
  CalendarIcon,
  Clock,
  UserCircle,
  Linkedin,
  Link,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface CustomerActivitiesTimelineV2Props {
  etablissementId: string
}

const activityIcons: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  qbr: { icon: BarChart3, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  training: { icon: GraduationCap, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
  support_ticket: { icon: Ticket, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  escalation: { icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
  renewal: { icon: RefreshCw, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  upsell: { icon: TrendingUp, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
  nps_survey: { icon: ClipboardList, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30' },
  health_change: { icon: Heart, color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/30' },
  note: { icon: StickyNote, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
  meeting: { icon: Users, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30' },
  email: { icon: Mail, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  incident: { icon: AlertCircle, color: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
  call: { icon: Phone, color: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
  visio: { icon: Video, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
  demo: { icon: Video, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
  document: { icon: FileText, color: 'text-foreground bg-slate-100 dark:bg-slate-900/30' },
  linkedin: { icon: Linkedin, color: 'text-[#0A66C2] bg-blue-100 dark:bg-blue-900/30' },
}

const activityLabels: Record<string, string> = {
  qbr: 'QBR',
  training: 'Formation',
  support_ticket: 'Support',
  escalation: 'Escalation',
  renewal: 'Renouvellement',
  upsell: 'Upsell',
  nps_survey: 'Enquête NPS',
  health_change: 'Santé client',
  note: 'Note',
  meeting: 'Réunion',
  email: 'Email',
  incident: 'Incident',
  call: 'Appel',
  visio: 'Visio',
  demo: 'Démo',
  document: 'Document',
  linkedin: 'LinkedIn',
}

const activityTypeOptions = Object.entries(activityLabels).map(([value, label]) => ({
  value,
  label
}))

// Quick-access types shown as buttons at the top of the form
const quickTypes: { type: ActivityType; label: string; icon: React.ComponentType<any> }[] = [
  { type: 'call', label: 'Appel', icon: Phone },
  { type: 'visio', label: 'Visio', icon: Video },
  { type: 'meeting', label: 'Réunion', icon: Users },
  { type: 'note', label: 'Note', icon: StickyNote },
  { type: 'linkedin', label: 'LinkedIn', icon: Linkedin },
]

function groupByMonth(activities: any[]) {
  const groups: Record<string, any[]> = {}
  
  activities.forEach(activity => {
    const date = parseISO(activity.activity_date)
    const monthKey = format(date, 'yyyy-MM')
    const monthLabel = format(date, 'MMMM yyyy', { locale: fr })
    
    if (!groups[monthKey]) {
      groups[monthKey] = []
    }
    groups[monthKey].push({ ...activity, monthLabel })
  })
  
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: items[0].monthLabel,
      items
    }))
}

export function CustomerActivitiesTimelineV2({ etablissementId }: CustomerActivitiesTimelineV2Props) {
  const { user } = useAuth()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  
  // Enriched form state
  const [newActivity, setNewActivity] = useState({
    title: '',
    description: '',
    activity_type: 'note' as ActivityType,
    activity_date: new Date(),
    duration_minutes: '',
    attendees: '',
    followup_notes: '',
    linkedin_url: '',
  })

  const { data: activities, isLoading } = useCustomerActivities(
    etablissementId, 
    { type: typeFilter !== 'all' ? typeFilter as ActivityType : undefined, limit: 100 }
  )
  
  const createActivity = useCreateActivity()

  const filteredActivities = activities || []
  const groupedActivities = groupByMonth(filteredActivities)

  if (expandedMonths.size === 0 && groupedActivities.length > 0) {
    const initialExpanded = new Set(groupedActivities.slice(0, 2).map(g => g.key))
    setExpandedMonths(initialExpanded)
  }

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey)
    } else {
      newExpanded.add(monthKey)
    }
    setExpandedMonths(newExpanded)
  }

  const toggleDescription = (id: string) => {
    const next = new Set(expandedDescriptions)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedDescriptions(next)
  }

  const resetForm = () => {
    setNewActivity({
      title: '',
      description: '',
      activity_type: 'note',
      activity_date: new Date(),
      duration_minutes: '',
      attendees: '',
      followup_notes: '',
      linkedin_url: '',
    })
  }

  const handleCreateActivity = async () => {
    if (!newActivity.title.trim()) return
    
    const metadata: Record<string, any> = {}
    if (newActivity.duration_minutes) {
      metadata.duration_minutes = parseInt(newActivity.duration_minutes, 10)
    }
    if (newActivity.attendees.trim()) {
      metadata.attendees = newActivity.attendees.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (newActivity.followup_notes.trim()) {
      metadata.followup_notes = newActivity.followup_notes
    }
    if (newActivity.linkedin_url.trim()) {
      metadata.linkedin_url = newActivity.linkedin_url
    }

    await createActivity.mutateAsync({
      etablissement_id: etablissementId,
      title: newActivity.title,
      description: newActivity.description || null,
      activity_type: newActivity.activity_type,
      activity_date: newActivity.activity_date.toISOString(),
      status: 'completed',
      scheduled_date: null,
      completed_date: new Date().toISOString(),
      metadata,
      created_by: user?.id || null,
      assigned_to: null
    })
    
    resetForm()
    setIsAddDialogOpen(false)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-5 h-5" />
            Historique client
            <Badge variant="secondary" className="ml-2">{filteredActivities.length}</Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] h-8">
                <Filter className="w-3 h-3 mr-2" />
                <SelectValue placeholder="Filtrer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {activityTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvelle activité</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Quick type buttons */}
                  <div className="space-y-2">
                    <Label>Type rapide</Label>
                    <div className="flex flex-wrap gap-2">
                      {quickTypes.map(qt => {
                        const Icon = qt.icon
                        return (
                          <Button
                            key={qt.type}
                            type="button"
                            size="sm"
                            variant={newActivity.activity_type === qt.type ? 'default' : 'outline'}
                            onClick={() => setNewActivity(prev => ({ ...prev, activity_type: qt.type }))}
                          >
                            <Icon className="w-4 h-4 mr-1" />
                            {qt.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Full type select */}
                  <div className="space-y-2">
                    <Label>Type d'activité</Label>
                    <Select 
                      value={newActivity.activity_type} 
                      onValueChange={(v) => setNewActivity(prev => ({ ...prev, activity_type: v as ActivityType }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activityTypeOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="activity-title">Titre</Label>
                    <Input
                      id="activity-title"
                      value={newActivity.title}
                      onChange={(e) => setNewActivity(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Appel de suivi mensuel"
                    />
                  </div>

                  {/* Date + Duration row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date de l'activité</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newActivity.activity_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(newActivity.activity_date, 'dd/MM/yyyy', { locale: fr })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={newActivity.activity_date}
                            onSelect={(d) => d && setNewActivity(prev => ({ ...prev, activity_date: d }))}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="activity-duration">Durée (minutes)</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="activity-duration"
                          type="number"
                          min="0"
                          className="pl-9"
                          value={newActivity.duration_minutes}
                          onChange={(e) => setNewActivity(prev => ({ ...prev, duration_minutes: e.target.value }))}
                          placeholder="30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Attendees */}
                  <div className="space-y-2">
                    <Label htmlFor="activity-attendees">Participants</Label>
                    <div className="relative">
                      <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="activity-attendees"
                        className="pl-9"
                        value={newActivity.attendees}
                        onChange={(e) => setNewActivity(prev => ({ ...prev, attendees: e.target.value }))}
                        placeholder="Jean Dupont, Marie Martin..."
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Séparez les noms par des virgules</p>
                  </div>
                  
                  {/* Description / CR - WYSIWYG */}
                  <div className="space-y-2">
                    <Label>Compte-rendu / Notes</Label>
                    <ActivityRichEditor
                      content={newActivity.description}
                      onChange={(html) => setNewActivity(prev => ({ ...prev, description: html }))}
                      placeholder="Points abordés, décisions prises, actions convenues..."
                    />
                  </div>

                  {/* Follow-up */}
                  <div className="space-y-2">
                    <Label htmlFor="activity-followup">Actions de suivi (optionnel)</Label>
                    <Textarea
                      id="activity-followup"
                      value={newActivity.followup_notes}
                      onChange={(e) => setNewActivity(prev => ({ ...prev, followup_notes: e.target.value }))}
                      placeholder="Prochaines étapes, relances à faire..."
                      rows={2}
                    />
                  </div>

                  {/* LinkedIn URL - only when type is linkedin */}
                  {newActivity.activity_type === 'linkedin' && (
                    <div className="space-y-2">
                      <Label htmlFor="activity-linkedin-url">Lien LinkedIn (optionnel)</Label>
                      <div className="relative">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="activity-linkedin-url"
                          className="pl-9"
                          value={newActivity.linkedin_url}
                          onChange={(e) => setNewActivity(prev => ({ ...prev, linkedin_url: e.target.value }))}
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { resetForm(); setIsAddDialogOpen(false) }}>
                      Annuler
                    </Button>
                    <Button 
                      onClick={handleCreateActivity}
                      disabled={!newActivity.title.trim() || createActivity.isPending}
                    >
                      {createActivity.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Créer
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucune activité enregistrée</p>
            <Button variant="link" onClick={() => setIsAddDialogOpen(true)}>
              Ajouter la première activité
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedActivities.map((group) => (
              <Collapsible 
                key={group.key} 
                open={expandedMonths.has(group.key)}
                onOpenChange={() => toggleMonth(group.key)}
              >
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between p-2 h-auto hover:bg-accent/50"
                  >
                    <span className="font-medium capitalize">{group.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {group.items.length} activité{group.items.length > 1 ? 's' : ''}
                      </Badge>
                      {expandedMonths.has(group.key) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-2">
                  <div className="relative pl-6 space-y-3">
                    <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-border" />
                    
                    {group.items.map((activity: any) => {
                      const iconConfig = activityIcons[activity.activity_type] || activityIcons.note
                      const IconComponent = iconConfig.icon
                      const meta = activity.metadata || {}
                      const isExpanded = expandedDescriptions.has(activity.id)
                      const hasLongDesc = activity.description && activity.description.length > 120
                      
                      return (
                        <div key={activity.id} className="relative">
                          <div className={cn(
                            "absolute -left-3.5 top-3 w-6 h-6 rounded-full flex items-center justify-center",
                            iconConfig.color
                          )}>
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          
                          <div className="ml-4 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{activity.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {activityLabels[activity.activity_type] || activity.activity_type}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(activity.activity_date), { 
                                      addSuffix: true, 
                                      locale: fr 
                                    })}
                                    {' • '}
                                    {format(new Date(activity.activity_date), 'dd MMM yyyy', { locale: fr })}
                                  </p>
                                  {meta.duration_minutes && (
                                    <Badge variant="secondary" className="text-xs gap-1">
                                      <Clock className="w-3 h-3" />
                                      {meta.duration_minutes} min
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Attendees */}
                            {meta.attendees && Array.isArray(meta.attendees) && meta.attendees.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <UserCircle className="w-3 h-3 shrink-0" />
                                <span className="truncate">{meta.attendees.join(', ')}</span>
                              </div>
                            )}
                            
                            {/* Description / CR */}
                            {activity.description && (
                              <div className="mt-2">
                                <p className={cn(
                                  "text-sm text-muted-foreground whitespace-pre-line",
                                  !isExpanded && hasLongDesc && "line-clamp-2"
                                )}>
                                  {activity.description}
                                </p>
                                {hasLongDesc && (
                                  <button
                                    onClick={() => toggleDescription(activity.id)}
                                    className="text-xs text-primary hover:underline mt-1"
                                  >
                                    {isExpanded ? 'Voir moins' : 'Voir plus'}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Follow-up notes */}
                            {meta.followup_notes && (
                              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-2 border-l-2 border-primary/30">
                                <span className="font-medium">Suivi : </span>{meta.followup_notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}