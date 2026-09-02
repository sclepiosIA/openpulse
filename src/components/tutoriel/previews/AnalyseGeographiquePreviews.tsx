import { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Building2,
  TrendingUp,
  Layers,
  ZoomIn,
  ZoomOut,
  Navigation,
  Table,
  Download,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// MAP PREVIEW
// ============================================

export const MapPreview = memo(() => {
  const [markersVisible, setMarkersVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMarkersVisible(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const markers = [
    { x: 25, y: 30, name: 'Groupe Vallois', status: 'production', count: 3 },
    { x: 45, y: 25, name: 'Agence Grenoble', status: 'production', count: 1 },
    { x: 70, y: 40, name: 'CH Marseille', status: 'deploiement', count: 2 },
    { x: 30, y: 60, name: 'Groupe Aubier', status: 'production', count: 1 },
    { x: 50, y: 15, name: 'CH Paris', status: 'prospect', count: 4 },
    { x: 60, y: 55, name: 'CH Toulouse', status: 'deploiement', count: 1 },
  ]

  const statusColors = {
    production: 'bg-green-500',
    deploiement: 'bg-orange-500',
    prospect: 'bg-blue-500',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4 text-primary" />
          Carte des établissements
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Zoomer">
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Dézoomer">
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Calques">
            <Layers className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Simulated map */}
      <div className="relative h-48 rounded-lg border bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30 overflow-hidden">
        {/* France outline simulation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-4 border-2 border-dashed border-muted-foreground/30 rounded-lg"
          style={{
            clipPath: 'polygon(45% 5%, 75% 15%, 85% 35%, 75% 70%, 60% 85%, 35% 90%, 15% 70%, 20% 40%, 30% 15%)'
          }}
        />

        {/* Markers */}
        <AnimatePresence>
          {markersVisible && markers.map((marker, index) => (
            <motion.div
              key={marker.name}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.12, type: 'spring' }}
              className="absolute group cursor-pointer"
              style={{ left: `${marker.x}%`, top: `${marker.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="relative">
                <motion.div
                  className={`w-4 h-4 rounded-full ${statusColors[marker.status as keyof typeof statusColors]} shadow-lg`}
                  whileHover={{ scale: 1.3 }}
                />
                {marker.count > 1 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.12 + 0.2 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-background rounded-full text-[10px] font-bold flex items-center justify-center border shadow-sm"
                  >
                    {marker.count}
                  </motion.div>
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover rounded shadow-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {marker.name}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        {[
          { status: 'Production', color: 'bg-green-500' },
          { status: 'Déploiement', color: 'bg-orange-500' },
          { status: 'Prospect', color: 'bg-blue-500' },
        ].map((item) => (
          <div key={item.status} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-muted-foreground">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
MapPreview.displayName = 'MapPreview'

// ============================================
// TABLEAU GEOGRAPHIQUE PREVIEW
// ============================================

export const TableauGeoPreview = memo(() => {
  const data = [
    { region: 'Rhône-Alpes', etablissements: 12, ca: 485000, progression: 92 },
    { region: 'Île-de-France', etablissements: 8, ca: 320000, progression: 78 },
    { region: 'PACA', etablissements: 6, ca: 245000, progression: 85 },
    { region: 'Nouvelle-Aquitaine', etablissements: 5, ca: 180000, progression: 65 },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Table className="h-4 w-4 text-primary" />
          Données par région
        </div>
        <Button size="sm" variant="outline" className="h-7">
          <Download className="h-3 w-3 mr-1" />
          Exporter
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-4 gap-2 p-2 bg-muted/50 text-xs font-medium">
          <span>Région</span>
          <span className="text-center">Établissements</span>
          <span className="text-center">CA</span>
          <span className="text-center">Progression</span>
        </div>
        <div className="divide-y">
          {data.map((row, index) => (
            <motion.div
              key={row.region}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="grid grid-cols-4 gap-2 p-2 items-center text-sm hover:bg-accent/50 cursor-pointer"
            >
              <span className="font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {row.region}
              </span>
              <span className="text-center">
                <TutorielCountUpAnimation value={row.etablissements} delay={index * 100 + 200} duration={600} />
              </span>
              <span className="text-center">
                <TutorielCountUpAnimation value={row.ca} delay={index * 100 + 300} duration={800} suffix=" €" />
              </span>
              <span className="text-center">
                <Badge 
                  variant="outline" 
                  className={row.progression >= 80 ? 'text-green-600 border-green-200' : row.progression >= 60 ? 'text-orange-600 border-orange-200' : 'text-red-600 border-red-200'}
                >
                  <TutorielCountUpAnimation value={row.progression} delay={index * 100 + 400} duration={600} suffix="%" />
                </Badge>
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
})
TableauGeoPreview.displayName = 'TableauGeoPreview'

// ============================================
// REGION DETAIL PREVIEW
// ============================================

export const RegionDetailPreview = memo(() => {
  const region = {
    nom: 'Rhône-Alpes',
    stats: {
      etablissements: 12,
      enProduction: 8,
      enDeploiement: 3,
      prospects: 1,
      caTotalPrevu: 485000,
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{region.nom}</h3>
            </div>
            <Button size="sm" variant="ghost" className="h-7">
              Voir détails
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total', value: region.stats.etablissements, icon: Building2 },
              { label: 'Production', value: region.stats.enProduction, icon: TrendingUp, color: 'text-green-500' },
              { label: 'Déploiement', value: region.stats.enDeploiement, color: 'text-orange-500' },
              { label: 'Prospects', value: region.stats.prospects, color: 'text-blue-500' },
            ].map((stat, index) => {
              const Icon = stat.icon || Building2
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className="p-2 rounded-lg bg-muted/50 text-center"
                >
                  <div className={`text-lg font-bold ${stat.color || ''}`}>
                    <TutorielCountUpAnimation value={stat.value} delay={index * 100 + 200} duration={600} />
                  </div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </motion.div>
              )
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-between p-2 rounded-lg border bg-card"
          >
            <span className="text-sm text-muted-foreground">CA Total Prévu</span>
            <span className="font-semibold">
              <TutorielCountUpAnimation value={region.stats.caTotalPrevu} delay={600} duration={1000} suffix=" €" />
            </span>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
})
RegionDetailPreview.displayName = 'RegionDetailPreview'
