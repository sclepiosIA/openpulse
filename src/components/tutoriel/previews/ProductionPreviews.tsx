import { memo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Activity, Users, Calendar, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// SCORE DE SANTÉ CLIENT
// ============================================

interface HealthGaugeProps {
  score: number
  label: string
  trend?: 'up' | 'down' | 'stable'
}

const HealthGauge = memo(({ score, label, trend }: HealthGaugeProps) => {
  const getColor = (s: number) => {
    if (s >= 80) return { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50' }
    if (s >= 60) return { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' }
    return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' }
  }
  const colors = getColor(score)

  return (
    <div className={`p-3 rounded-lg ${colors.light} border`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {trend && (
          trend === 'up' ? <TrendingUp className="h-3 w-3 text-green-500" /> :
          trend === 'down' ? <TrendingDown className="h-3 w-3 text-red-500" /> :
          <Activity className="h-3 w-3 text-gray-400" />
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${colors.text}`}>
          <TutorielCountUpAnimation value={score} duration={1500} />
        </span>
        <span className={`text-sm ${colors.text}`}>/100</span>
      </div>
      <Progress value={score} className="h-1.5 mt-2" />
    </div>
  )
})
HealthGauge.displayName = 'HealthGauge'

export const ProductionHealthScorePreview = memo(() => (
  <div className="p-4 space-y-4">
    <div className="flex items-center justify-between">
      <h4 className="font-semibold">Score de Santé</h4>
      <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
        +3pts ce mois
      </Badge>
    </div>

    {/* Score global avec jauge circulaire simulée */}
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center justify-center py-4"
    >
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            className="text-muted"
          />
          <motion.circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            className="text-green-500"
            strokeLinecap="round"
            initial={{ strokeDasharray: '0 352' }}
            animate={{ strokeDasharray: '280 352' }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-green-600">
            <TutorielCountUpAnimation value={82} duration={1500} />
          </span>
          <span className="text-xs text-muted-foreground">Score global</span>
        </div>
      </div>
    </motion.div>

    {/* Sous-scores */}
    <div className="grid grid-cols-2 gap-3">
      <HealthGauge score={85} label="Adoption" trend="up" />
      <HealthGauge score={78} label="Satisfaction" trend="stable" />
      <HealthGauge score={92} label="Engagement" trend="up" />
      <HealthGauge score={65} label="Support" trend="down" />
    </div>
  </div>
))
ProductionHealthScorePreview.displayName = 'ProductionHealthScorePreview'

// ============================================
// ANALYSE PAR COHORTES
// ============================================

const cohortes = [
  { mois: 'Jan 2024', clients: 8, retention: [100, 88, 75, 75, 63] },
  { mois: 'Fév 2024', clients: 12, retention: [100, 92, 83, 75] },
  { mois: 'Mar 2024', clients: 6, retention: [100, 100, 83] },
  { mois: 'Avr 2024', clients: 10, retention: [100, 90] },
  { mois: 'Mai 2024', clients: 15, retention: [100] },
]

export const ProductionCohortsPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Analyse par Cohortes</h4>
    
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Cohorte</th>
            <th className="text-center p-2">Clients</th>
            <th className="text-center p-2">M+1</th>
            <th className="text-center p-2">M+2</th>
            <th className="text-center p-2">M+3</th>
            <th className="text-center p-2">M+4</th>
          </tr>
        </thead>
        <tbody>
          {cohortes.map((cohorte, index) => (
            <motion.tr
              key={cohorte.mois}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-b"
            >
              <td className="p-2 font-medium">{cohorte.mois}</td>
              <td className="text-center p-2">{cohorte.clients}</td>
              {cohorte.retention.map((val, i) => {
                const bgColor = val >= 90 ? 'bg-green-100' : val >= 75 ? 'bg-yellow-100' : 'bg-red-100'
                return (
                  <td key={`${cohorte.mois}-r${i}`} className={`text-center p-2 ${bgColor}`}>
                    {val}%
                  </td>
                )
              })}
              {/* Cellules vides pour aligner */}
              {Array.from({ length: 5 - cohorte.retention.length }).map((_, i) => (
                <td key={`empty-${i}`} className="p-2 bg-muted/30" />
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="flex items-center gap-4 mt-4 text-xs">
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-green-100 border" />
        <span>≥90%</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-yellow-100 border" />
        <span>75-89%</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-3 h-3 rounded bg-red-100 border" />
        <span>&lt;75%</span>
      </div>
    </div>
  </div>
))
ProductionCohortsPreview.displayName = 'ProductionCohortsPreview'

// ============================================
// ACTIONS CSM RAPIDES
// ============================================

const csmActions = [
  { icon: MessageSquare, label: 'Ajouter une note', color: 'text-blue-500 bg-blue-50' },
  { icon: Calendar, label: 'Planifier un RDV', color: 'text-green-500 bg-green-50' },
  { icon: AlertCircle, label: 'Créer une alerte', color: 'text-orange-500 bg-orange-50' },
  { icon: CheckCircle2, label: 'Valider le renouvellement', color: 'text-purple-500 bg-purple-50' },
]

export const ProductionCSMActionsPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Actions rapides CSM</h4>
    
    <div className="grid grid-cols-2 gap-3">
      {csmActions.map((action, index) => {
        const Icon = action.icon
        return (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-3 p-3 rounded-lg border ${action.color} transition-all hover:shadow-md`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-sm font-medium text-foreground">{action.label}</span>
          </motion.button>
        )
      })}
    </div>

    {/* Client récent */}
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Clinique Saint-Jean</span>
          <Badge className="bg-green-500">Santé: 85</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>42 utilisateurs actifs</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Renouvellement dans 45 jours</span>
        </div>
      </CardContent>
    </Card>
  </div>
))
ProductionCSMActionsPreview.displayName = 'ProductionCSMActionsPreview'

// ============================================
// ALERTES RENOUVELLEMENT
// ============================================

export const ProductionRenewalAlertsPreview = memo(() => (
  <div className="p-4 space-y-3">
    <h4 className="font-semibold mb-4">Alertes renouvellement</h4>
    
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <div>
          <p className="text-sm font-medium">CH de Bordeaux</p>
          <p className="text-xs text-red-600">Expire dans 15 jours</p>
        </div>
      </div>
      <Badge variant="destructive">Urgent</Badge>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200"
    >
      <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-yellow-600" />
        <div>
          <p className="text-sm font-medium">Agence du Parc</p>
          <p className="text-xs text-yellow-700">Expire dans 45 jours</p>
        </div>
      </div>
      <Badge variant="outline" className="text-yellow-700 border-yellow-300">À planifier</Badge>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200"
    >
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <div>
          <p className="text-sm font-medium">Groupe Estuaire</p>
          <p className="text-xs text-green-700">Renouvelé pour 2 ans</p>
        </div>
      </div>
      <Badge variant="outline" className="text-green-700 border-green-300">OK</Badge>
    </motion.div>
  </div>
))
ProductionRenewalAlertsPreview.displayName = 'ProductionRenewalAlertsPreview'
