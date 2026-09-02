import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Users,
  Building2,
  Mail,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Plus,
  Calendar,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// DASHBOARD KPIs PREVIEW
// ============================================

export const DashboardKPIsPreview = memo(() => {
  const kpis = [
    {
      label: 'CA Annuel',
      value: 847500,
      prefix: '',
      suffix: ' €',
      trend: 12,
      icon: TrendingUp,
      color: 'text-green-500',
    },
    { label: 'Clients Actifs', value: 47, trend: 3, icon: Building2, color: 'text-blue-500' },
    { label: 'Prospects', value: 23, trend: -2, icon: Users, color: 'text-orange-500' },
    { label: 'Tâches en cours', value: 12, trend: 0, icon: Clock, color: 'text-purple-500' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.15, duration: 0.4 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {kpi.trend !== 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.15 + 0.3 }}
                    >
                      <Badge
                        variant="outline"
                        className={
                          kpi.trend > 0
                            ? 'text-green-600 border-green-200'
                            : 'text-red-600 border-red-200'
                        }
                      >
                        {kpi.trend > 0 ? '+' : ''}
                        {kpi.trend}%
                      </Badge>
                    </motion.div>
                  )}
                </div>
                <div className="text-2xl font-bold">
                  <TutorielCountUpAnimation
                    value={kpi.value}
                    duration={1500}
                    delay={index * 150}
                    prefix={kpi.prefix}
                    suffix={kpi.suffix}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
})
DashboardKPIsPreview.displayName = 'DashboardKPIsPreview'

// ============================================
// DASHBOARD PIPELINE PREVIEW
// ============================================

export const DashboardPipelinePreview = memo(() => {
  const columns = [
    { name: 'Prospect', count: 8, value: 245000, color: 'bg-slate-500' },
    { name: 'Qualification', count: 5, value: 180000, color: 'bg-blue-500' },
    { name: 'Proposition', count: 3, value: 120000, color: 'bg-purple-500' },
    { name: 'Négociation', count: 2, value: 85000, color: 'bg-orange-500' },
    { name: 'Gagné', count: 4, value: 320000, color: 'bg-green-500' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <TrendingUp className="h-4 w-4 text-primary" />
        Pipeline Commercial
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {columns.map((col, index) => (
          <motion.div
            key={col.name}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="min-w-[100px] flex-1"
          >
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <span className="text-xs font-medium truncate">{col.name}</span>
              </div>
              <div className="text-lg font-bold">
                <TutorielCountUpAnimation
                  value={col.count}
                  delay={index * 100 + 200}
                  duration={800}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <TutorielCountUpAnimation
                  value={col.value}
                  delay={index * 100 + 400}
                  duration={1000}
                  suffix=" €"
                />
              </div>
              {/* Simulated cards */}
              <div className="mt-3 space-y-1.5">
                {Array.from({ length: Math.min(col.count, 2) }).map((_, i) => (
                  // stable: static array length within fixed column
                  <motion.div
                    key={`${col.name}-card-${i}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.5 + i * 0.1 }}
                    className="h-8 rounded bg-muted/50 border border-border/50"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
})
DashboardPipelinePreview.displayName = 'DashboardPipelinePreview'

// ============================================
// DASHBOARD ACTIONS RAPIDES PREVIEW
// ============================================

export const DashboardActionsPreview = memo(() => {
  const actions = [
    { text: 'Appeler Groupe Aubier', type: 'call', done: false, priority: 'high' },
    {
      text: 'Envoyer proposition Clinique du Parc',
      type: 'email',
      done: false,
      priority: 'medium',
    },
    { text: 'Préparer démo Agence Lille', type: 'meeting', done: true, priority: 'low' },
    { text: 'Relancer CH Marseille', type: 'followup', done: false, priority: 'high' },
  ]

  const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-orange-500',
    low: 'bg-green-500',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Actions du jour
        </div>
        <Badge variant="secondary">{actions.filter((a) => !a.done).length} restantes</Badge>
      </div>
      <div className="space-y-2">
        {actions.map((action, index) => (
          <motion.div
            key={action.text}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.12, duration: 0.3 }}
            className={`flex items-center gap-3 p-3 rounded-lg border ${action.done ? 'bg-muted/50 opacity-60' : 'bg-card hover:bg-accent/50'} transition-colors`}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.12 + 0.2, type: 'spring' }}
              className={`w-2 h-2 rounded-full ${priorityColors[action.priority as keyof typeof priorityColors]}`}
            />
            <div className="flex-1">
              <span
                className={`text-sm ${action.done ? 'line-through text-muted-foreground' : ''}`}
              >
                {action.text}
              </span>
            </div>
            {action.done ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.12 + 0.3, type: 'spring' }}
              >
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </motion.div>
            ) : (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
})
DashboardActionsPreview.displayName = 'DashboardActionsPreview'

// ============================================
// DASHBOARD FLUX ACTIVITÉS PREVIEW
// ============================================

export const DashboardFluxActivitesPreview = memo(() => {
  const activities = [
    {
      user: 'Marie D.',
      action: 'a ajouté une note sur',
      target: 'Groupe Vallois',
      time: 'Il y a 5 min',
      icon: Plus,
    },
    {
      user: 'Thomas B.',
      action: 'a envoyé un email à',
      target: 'Clinique Saint-Jean',
      time: 'Il y a 15 min',
      icon: Mail,
    },
    {
      user: 'Sophie L.',
      action: 'a planifié une démo pour',
      target: 'CH Nantes',
      time: 'Il y a 30 min',
      icon: Calendar,
    },
    {
      user: 'IA',
      action: 'a détecté une opportunité chez',
      target: 'Agence Toulouse',
      time: 'Il y a 1h',
      icon: Sparkles,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4 text-primary" />
        Activité récente
      </div>
      <div className="space-y-1">
        {activities.map((activity, index) => {
          const Icon = activity.icon
          return (
            <motion.div
              key={`activity-${activity.user}-${activity.action}-${index}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15, duration: 0.3 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.15 + 0.1, type: 'spring' }}
                className={`p-1.5 rounded-full ${activity.user === 'IA' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              >
                <Icon className="h-3 w-3" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user}</span>
                  <span className="text-muted-foreground"> {activity.action} </span>
                  <span className="font-medium text-primary">{activity.target}</span>
                </p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
})
DashboardFluxActivitesPreview.displayName = 'DashboardFluxActivitesPreview'
