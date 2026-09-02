import { memo } from 'react'
import { motion } from 'framer-motion'
import { Building2, CheckCircle2, Clock, PlayCircle, Users, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// PHASES DE DÉPLOIEMENT AVEC TIMELINE ANIMÉE
// ============================================

const phases = [
  { id: 1, name: 'Cadrage', icon: Users, status: 'completed', days: 5 },
  { id: 2, name: 'Formation', icon: PlayCircle, status: 'completed', days: 10 },
  { id: 3, name: 'Paramétrage', icon: Clock, status: 'active', days: 8, progress: 60 },
  { id: 4, name: 'Recette', icon: CheckCircle2, status: 'pending', days: 7 },
  { id: 5, name: 'Go-Live', icon: Building2, status: 'pending', days: 3 },
]

export const DeploiementPhasesPreview = memo(() => (
  <div className="p-4 space-y-4">
    <div className="flex items-center justify-between mb-4">
      <h4 className="font-semibold">Phases de déploiement</h4>
      <Badge variant="secondary">Groupe Vallois</Badge>
    </div>

    {/* Timeline horizontale */}
    <div className="relative">
      <div className="absolute top-6 left-0 right-0 h-1 bg-muted rounded-full" />
      <div className="flex justify-between relative">
        {phases.map((phase, index) => {
          const Icon = phase.icon
          const isCompleted = phase.status === 'completed'
          const isActive = phase.status === 'active'
          
          return (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              className="flex flex-col items-center relative z-10"
            >
              <motion.div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center border-2
                  ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
                  ${isActive ? 'bg-primary border-primary text-white animate-pulse' : ''}
                  ${!isCompleted && !isActive ? 'bg-muted border-border text-muted-foreground' : ''}
                `}
                whileHover={{ scale: 1.1 }}
              >
                <Icon className="h-5 w-5" />
              </motion.div>
              <span className={`text-xs mt-2 font-medium ${isActive ? 'text-primary' : ''}`}>
                {phase.name}
              </span>
              <span className="text-xs text-muted-foreground">{phase.days}j</span>
              {isActive && phase.progress && (
                <div className="w-16 mt-1">
                  <Progress value={phase.progress} className="h-1" />
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>

    {/* Statistiques */}
    <div className="grid grid-cols-3 gap-3 mt-6">
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
76:             <TutorielCountUpAnimation value={15} duration={1200} />
77:           </p>
78:           <p className="text-xs text-green-700">Jours écoulés</p>
79:         </CardContent>
80:       </Card>
81:       <Card className="bg-blue-50 border-blue-200">
82:         <CardContent className="p-3 text-center">
83:           <p className="text-2xl font-bold text-blue-600">
84:             <TutorielCountUpAnimation value={18} duration={1200} />
85:           </p>
          <p className="text-xs text-blue-700">Jours restants</p>
        </CardContent>
      </Card>
      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">45%</p>
          <p className="text-xs text-orange-700">Progression</p>
        </CardContent>
      </Card>
    </div>
  </div>
))
DeploiementPhasesPreview.displayName = 'DeploiementPhasesPreview'

// ============================================
// KANBAN PAR PHASE DE DÉPLOIEMENT
// ============================================

const kanbanItems = [
  { phase: 'Cadrage', items: ['Réunion kickoff', 'Analyse besoins'] },
  { phase: 'Formation', items: ['Formation admins', 'Formation users'] },
  { phase: 'Paramétrage', items: ['Config modules', 'Import données'] },
]

export const DeploiementKanbanPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Vue Kanban</h4>
    <div className="flex gap-3 overflow-x-auto pb-2">
      {kanbanItems.map((column, colIndex) => (
        <motion.div
          key={column.phase}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: colIndex * 0.1 }}
          className="min-w-[160px] bg-muted/50 rounded-lg p-3"
        >
          <h5 className="font-medium text-sm mb-3 flex items-center gap-2">
            {column.phase}
            <Badge variant="secondary" className="text-xs">{column.items.length}</Badge>
          </h5>
          <div className="space-y-2">
            {column.items.map((item, itemIndex) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: colIndex * 0.1 + itemIndex * 0.05 }}
                className="bg-background p-2 rounded border text-xs shadow-sm"
                whileHover={{ scale: 1.02, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              >
                {item}
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  </div>
))
DeploiementKanbanPreview.displayName = 'DeploiementKanbanPreview'

// ============================================
// GANTT SIMPLIFIÉ DÉPLOIEMENT
// ============================================

const ganttTasks = [
  { name: 'Cadrage', start: 0, duration: 20, color: 'bg-green-500' },
  { name: 'Formation', start: 10, duration: 35, color: 'bg-blue-500' },
  { name: 'Paramétrage', start: 30, duration: 40, color: 'bg-yellow-500' },
  { name: 'Recette', start: 55, duration: 25, color: 'bg-orange-500' },
  { name: 'Go-Live', start: 75, duration: 15, color: 'bg-purple-500' },
]

export const DeploiementGanttPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Diagramme de Gantt</h4>
    <div className="space-y-3">
      {ganttTasks.map((task, index) => (
        <motion.div
          key={task.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center gap-3"
        >
          <span className="text-xs font-medium w-24 text-right">{task.name}</span>
          <div className="flex-1 h-6 bg-muted rounded relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${task.duration}%` }}
              transition={{ delay: index * 0.15, duration: 0.8, ease: 'easeOut' }}
              className={`absolute h-full rounded ${task.color}`}
              style={{ left: `${task.start}%` }}
            />
          </div>
        </motion.div>
      ))}
    </div>
    
    {/* Légende mois */}
    <div className="flex justify-between mt-4 text-xs text-muted-foreground">
      <span>Jan</span>
      <span>Fév</span>
      <span>Mar</span>
      <span>Avr</span>
    </div>
  </div>
))
DeploiementGanttPreview.displayName = 'DeploiementGanttPreview'

// ============================================
// ALERTES ET BLOCAGES
// ============================================

export const DeploiementAlertesPreview = memo(() => (
  <div className="p-4 space-y-3">
    <h4 className="font-semibold mb-4">Alertes & Blocages</h4>
    
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200"
    >
      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-red-700">Retard sur la formation</p>
        <p className="text-xs text-red-600">2 sessions reportées - Impact Go-Live estimé</p>
      </div>
    </motion.div>
    
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200"
    >
      <Clock className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-yellow-700">Validation en attente</p>
        <p className="text-xs text-yellow-600">Spécifications techniques à valider par DSI</p>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200"
    >
      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-green-700">Cadrage terminé</p>
        <p className="text-xs text-green-600">Toutes les étapes validées</p>
      </div>
    </motion.div>
  </div>
))
DeploiementAlertesPreview.displayName = 'DeploiementAlertesPreview'
