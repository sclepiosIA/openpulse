import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  SortAsc,
  BarChart3,
  Users,
  Calendar,
  Tag,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// LISTE DES TÂCHES AVEC PRIORITÉS
// ============================================

const mockTasks = [
  {
    id: 1,
    title: 'Préparer la démo client',
    priority: 'haute',
    status: 'en_cours',
    assignee: 'Marie D.',
    dueDate: "Aujourd'hui",
    category: 'Commercial',
  },
  {
    id: 2,
    title: 'Corriger bug interface email',
    priority: 'haute',
    status: 'a_faire',
    assignee: 'Thomas L.',
    dueDate: 'Demain',
    category: 'Support',
  },
  {
    id: 3,
    title: 'Documenter API v2',
    priority: 'moyenne',
    status: 'en_cours',
    assignee: 'Julie M.',
    dueDate: 'Vendredi',
    category: 'Dev',
  },
  {
    id: 4,
    title: 'Relancer Clinique ABC',
    priority: 'basse',
    status: 'a_faire',
    assignee: 'Pierre V.',
    dueDate: 'Semaine pro',
    category: 'Commercial',
  },
  {
    id: 5,
    title: 'Mise à jour serveur staging',
    priority: 'moyenne',
    status: 'termine',
    assignee: 'Thomas L.',
    dueDate: 'Hier',
    category: 'Dev',
  },
]

const priorityConfig = {
  haute: { color: 'bg-red-500', label: 'Haute', textColor: 'text-red-700' },
  moyenne: { color: 'bg-yellow-500', label: 'Moyenne', textColor: 'text-yellow-700' },
  basse: { color: 'bg-green-500', label: 'Basse', textColor: 'text-green-700' },
}

const statusConfig = {
  a_faire: { icon: Circle, color: 'text-muted-foreground' },
  en_cours: { icon: Clock, color: 'text-blue-500' },
  termine: { icon: CheckCircle2, color: 'text-green-500' },
}

export const ProjetsTaskListPreview = memo(() => (
  <div className="p-4">
    <div className="flex items-center justify-between mb-4">
      <h4 className="font-semibold">Mes tâches</h4>
      <Badge variant="secondary">
        <TutorielCountUpAnimation value={5} duration={500} /> tâches
      </Badge>
    </div>

    <div className="space-y-2">
      {mockTasks.map((task, index) => {
        const priority = priorityConfig[task.priority as keyof typeof priorityConfig]
        const status = statusConfig[task.status as keyof typeof statusConfig]
        const StatusIcon = status.icon

        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            whileHover={{ backgroundColor: 'hsl(var(--muted))' }}
            className="flex items-center gap-3 p-3 rounded-lg border bg-background cursor-pointer group"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />

            <StatusIcon className={`h-5 w-5 ${status.color} shrink-0`} />

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${task.status === 'termine' ? 'line-through text-muted-foreground' : ''}`}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{task.assignee}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{task.dueDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {task.category}
              </Badge>
              <div className={`w-2 h-2 rounded-full ${priority.color}`} title={priority.label} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              aria-label="Plus d'options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </motion.div>
        )
      })}
    </div>
  </div>
))
ProjetsTaskListPreview.displayName = 'ProjetsTaskListPreview'

// ============================================
// BARRE DE FILTRES INTERACTIVE
// ============================================

const filterOptions = [
  { label: 'Statut', icon: Circle, active: true, value: 'En cours' },
  { label: 'Priorité', icon: AlertTriangle, active: false, value: null },
  { label: 'Assigné', icon: Users, active: true, value: 'Moi' },
  { label: 'Échéance', icon: Calendar, active: false, value: null },
  { label: 'Catégorie', icon: Tag, active: false, value: null },
]

export const ProjetsFiltresPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Filtres et Tri</h4>

    {/* Barre de filtres */}
    <div className="flex flex-wrap gap-2 mb-4">
      {filterOptions.map((filter, index) => {
        const Icon = filter.icon
        return (
          <motion.button
            key={filter.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-all
              ${
                filter.active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              }
            `}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{filter.label}</span>
            {filter.value && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-card/20">
                {filter.value}
              </Badge>
            )}
          </motion.button>
        )
      })}
    </div>

    {/* Options de tri */}
    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <SortAsc className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Trier par</span>
      </div>
      <div className="flex gap-2">
        {['Date', 'Priorité', 'Assigné'].map((option, i) => (
          <Button key={option} variant={i === 0 ? 'secondary' : 'ghost'} size="sm" className="h-7">
            {option}
          </Button>
        ))}
      </div>
    </div>

    {/* Résultat filtres */}
    <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">12 tâches</span> correspondent à vos filtres
      </p>
    </div>
  </div>
))
ProjetsFiltresPreview.displayName = 'ProjetsFiltresPreview'

// ============================================
// ANALYTICS PROJETS / KPIs
// ============================================

const kpis = [
  { label: 'Tâches terminées', value: 24, total: 35, trend: '+8 cette semaine', color: 'green' },
  { label: 'En retard', value: 3, trend: '-2 vs semaine dernière', color: 'red' },
  { label: 'À venir (7j)', value: 12, trend: '5 haute priorité', color: 'blue' },
]

const teamPerformance = [
  { name: 'Marie D.', completed: 8, inProgress: 3, percent: 73 },
  { name: 'Thomas L.', completed: 6, inProgress: 4, percent: 60 },
  { name: 'Julie M.', completed: 5, inProgress: 2, percent: 71 },
  { name: 'Pierre V.', completed: 5, inProgress: 5, percent: 50 },
]

export const ProjetsAnalyticsPreview = memo(() => (
  <div className="p-4 space-y-4">
    <h4 className="font-semibold">Analytics Projets</h4>

    {/* KPIs */}
    <div className="grid grid-cols-3 gap-3">
      {kpis.map((kpi, index) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold text-${kpi.color}-600`}>
                  <TutorielCountUpAnimation value={kpi.value} duration={1200} />
                </span>
                {kpi.total && <span className="text-sm text-muted-foreground">/{kpi.total}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.trend}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>

    {/* Performance équipe */}
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Performance équipe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {teamPerformance.map((member, index) => (
          <motion.div
            key={member.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="space-y-1"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{member.name}</span>
              <span className="text-muted-foreground">{member.completed} terminées</span>
            </div>
            <Progress value={member.percent} className="h-2" />
          </motion.div>
        ))}
      </CardContent>
    </Card>
  </div>
))
ProjetsAnalyticsPreview.displayName = 'ProjetsAnalyticsPreview'

// ============================================
// ACTIONS EN MASSE
// ============================================

export const ProjetsActionsEnMassePreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Actions en masse</h4>

    {/* Sélection */}
    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">3 tâches sélectionnées</span>
        <Button variant="ghost" size="sm">
          Tout désélectionner
        </Button>
      </div>
    </div>

    {/* Actions disponibles */}
    <div className="flex flex-wrap gap-2">
      {['Changer le statut', 'Réassigner', 'Modifier la priorité', 'Supprimer'].map((action, i) => (
        <motion.div
          key={action}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <Button variant={action === 'Supprimer' ? 'destructive' : 'outline'} size="sm">
            {action}
          </Button>
        </motion.div>
      ))}
    </div>

    {/* Aperçu des tâches sélectionnées */}
    <div className="mt-4 space-y-2">
      {['Préparer la démo client', 'Corriger bug interface', 'Documenter API v2'].map((task, i) => (
        <motion.div
          key={task}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.05 }}
          className="flex items-center gap-2 p-2 bg-muted rounded"
        >
          <input type="checkbox" checked readOnly className="rounded" />
          <span className="text-sm">{task}</span>
        </motion.div>
      ))}
    </div>
  </div>
))
ProjetsActionsEnMassePreview.displayName = 'ProjetsActionsEnMassePreview'
