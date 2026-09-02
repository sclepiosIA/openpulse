import { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  Download,
  FileText,
  Calendar,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TutorielCountUpAnimation, TutorielChartBar } from '../TutorielCountUpAnimation'

// ============================================
// RAPPORT DASHBOARD PREVIEW
// ============================================

export const RapportDashboardPreview = memo(() => {
  const kpis = [
    { label: 'Établissements actifs', value: 47, trend: '+5%', icon: CheckCircle2, color: 'text-green-500' },
    { label: 'CA mensuel', value: 125000, suffix: ' €', trend: '+12%', icon: TrendingUp, color: 'text-blue-500' },
    { label: 'Tâches complétées', value: 156, trend: '+8%', icon: Clock, color: 'text-purple-500' },
    { label: 'Score satisfaction', value: 92, suffix: '%', trend: '+2%', icon: Eye, color: 'text-orange-500' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" />
          Tableau de bord
        </div>
        <Badge variant="secondary">Janvier 2026</Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                      {kpi.trend}
                    </Badge>
                  </div>
                  <div className="text-xl font-bold">
                    <TutorielCountUpAnimation 
                      value={kpi.value} 
                      delay={index * 100 + 200}
                      duration={1000}
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
    </div>
  )
})
RapportDashboardPreview.displayName = 'RapportDashboardPreview'

// ============================================
// RAPPORT CHART PREVIEW
// ============================================

export const RapportChartPreview = memo(() => {
  const data = [
    { label: 'Jan', value: 85 },
    { label: 'Fév', value: 92 },
    { label: 'Mar', value: 78 },
    { label: 'Avr', value: 105 },
    { label: 'Mai', value: 112 },
    { label: 'Juin', value: 125 },
  ]

  const maxValue = Math.max(...data.map(d => d.value))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />
          Évolution CA (k€)
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7">
            <Calendar className="h-3 w-3 mr-1" />
            6 mois
          </Button>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end justify-between gap-2 h-32 pt-4">
        {data.map((item, index) => (
          <div key={item.label} className="flex flex-col items-center gap-1 flex-1">
            <TutorielChartBar
              value={item.value}
              maxValue={maxValue}
              label={item.label}
              delay={index * 0.1}
            />
          </div>
        ))}
      </div>

      {/* Trend line simulation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex items-center justify-center gap-2 text-sm"
      >
        <TrendingUp className="h-4 w-4 text-green-500" />
        <span className="text-muted-foreground">Tendance :</span>
        <span className="font-medium text-green-500">+47% sur la période</span>
      </motion.div>
    </div>
  )
})
RapportChartPreview.displayName = 'RapportChartPreview'

// ============================================
// RAPPORT EXPORT PREVIEW
// ============================================

export const RapportExportPreview = memo(() => {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setExporting(true), 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!exporting) return
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 200)
    return () => clearInterval(interval)
  }, [exporting])

  const formats = [
    { name: 'PDF', icon: FileText, description: 'Rapport formaté' },
    { name: 'Excel', icon: BarChart3, description: 'Données brutes' },
    { name: 'CSV', icon: FileText, description: 'Export simplifié' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Download className="h-4 w-4 text-primary" />
        Export de rapport
      </div>

      {/* Format selection */}
      <div className="grid grid-cols-3 gap-2">
        {formats.map((format, index) => {
          const Icon = format.icon
          return (
            <motion.div
              key={format.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`cursor-pointer transition-colors ${index === 0 ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}>
                <CardContent className="p-3 text-center">
                  <Icon className={`h-5 w-5 mx-auto mb-1 ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="text-sm font-medium">{format.name}</p>
                  <p className="text-xs text-muted-foreground">{format.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Export progress */}
      <AnimatePresence>
        {exporting && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {progress < 100 ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <RefreshCw className="h-4 w-4 text-primary" />
                  </motion.div>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {progress < 100 ? 'Génération en cours...' : 'Export terminé !'}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
                className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
RapportExportPreview.displayName = 'RapportExportPreview'

// ============================================
// RAPPORT FILTERS PREVIEW
// ============================================

export const RapportFiltersPreview = memo(() => {
  const filters = [
    { label: 'Période', value: 'Janvier 2026' },
    { label: 'Région', value: 'Rhône-Alpes' },
    { label: 'Type', value: 'Grand compte, Groupement' },
    { label: 'Statut', value: 'Production' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="h-4 w-4 text-primary" />
        Filtres appliqués
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter, index) => (
          <motion.div
            key={filter.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Badge variant="secondary" className="gap-1">
              <span className="text-muted-foreground">{filter.label}:</span>
              <span className="font-medium">{filter.value}</span>
            </Badge>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-2"
      >
        <Button size="sm" variant="outline" className="h-7">
          <RefreshCw className="h-3 w-3 mr-1" />
          Réinitialiser
        </Button>
        <Button size="sm" className="h-7">
          Appliquer
        </Button>
      </motion.div>
    </div>
  )
})
RapportFiltersPreview.displayName = 'RapportFiltersPreview'
