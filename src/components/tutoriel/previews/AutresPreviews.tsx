import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  Home,
  Mail,
  Building2,
  Users,
  FileText,
  Settings,
  ChevronRight,
  MapPin,
  BarChart3,
  MessageSquare,
  Eye,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { TutorielCountUpAnimation } from '../TutorielCountUpAnimation'

// ============================================
// PRISE EN MAIN - NAVIGATION SIDEBAR
// ============================================

const sidebarItems = [
  { icon: Home, label: 'Dashboard', active: true },
  { icon: Mail, label: 'Emails', badge: 12 },
  { icon: Building2, label: 'Établissements' },
  { icon: Users, label: 'People' },
  { icon: FileText, label: 'Projets' },
  { icon: Settings, label: 'Paramètres' },
]

export const PriseEnMainNavigationPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Navigation principale</h4>
    
    <div className="w-56 bg-sidebar rounded-xl border overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <span className="font-semibold">OpenPulse</span>
        </div>
      </div>
      
      <nav className="p-2 space-y-1">
        {sidebarItems.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`
                flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all
                ${item.active 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {item.badge && (
                <Badge variant={item.active ? 'secondary' : 'default'} className="h-5 text-xs">
                  {item.badge}
                </Badge>
              )}
            </motion.div>
          )
        })}
      </nav>
    </div>
  </div>
))
PriseEnMainNavigationPreview.displayName = 'PriseEnMainNavigationPreview'

// ============================================
// GROUPES & PARTENAIRES
// ============================================

const groupes = [
  { name: 'Groupement Nord-Alsace', type: 'Groupement', etablissements: 5, logo: null },
  { name: 'Groupe Ramsay', type: 'Groupe privé', etablissements: 12, logo: null },
  { name: 'Réseau Santé Bretagne', type: 'Réseau', etablissements: 8, logo: null },
]

export const GroupesPartenairesPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4">Groupes d'organisations</h4>
    
    <div className="space-y-3">
      {groupes.map((groupe, index) => (
        <motion.div
          key={groupe.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 p-3 rounded-lg border bg-background cursor-pointer hover:shadow-md transition-all"
        >
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {groupe.name.split(' ').slice(0, 2).map(w => w[0]).join('')}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <p className="font-medium">{groupe.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{groupe.type}</Badge>
              <span className="text-xs text-muted-foreground">
                {groupe.etablissements} établissements
              </span>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      ))}
    </div>
  </div>
))
GroupesPartenairesPreview.displayName = 'GroupesPartenairesPreview'

// ============================================
// ANALYSE GÉOGRAPHIQUE - MINI CARTE
// ============================================

const regions = [
  { name: 'Île-de-France', count: 45, percent: 30 },
  { name: 'Auvergne-Rhône-Alpes', count: 32, percent: 21 },
  { name: 'Occitanie', count: 28, percent: 19 },
  { name: 'Nouvelle-Aquitaine', count: 22, percent: 15 },
  { name: 'Autres', count: 23, percent: 15 },
]

export const AnalyseGeoMapPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4 flex items-center gap-2">
      <MapPin className="h-4 w-4" />
      Répartition géographique
    </h4>

    {/* Simulation carte avec points */}
    <div className="relative h-40 bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg mb-4 overflow-hidden">
      <svg viewBox="0 0 200 120" className="w-full h-full">
        {/* Points représentant les établissements */}
        {[
          { x: 120, y: 30, size: 8 },  // Paris
          { x: 140, y: 70, size: 6 },  // Lyon
          { x: 100, y: 90, size: 5 },  // Toulouse
          { x: 60, y: 80, size: 5 },   // Bordeaux
          { x: 160, y: 50, size: 4 },  // Strasbourg
          { x: 80, y: 30, size: 4 },   // Nantes
        ].map((point, i) => (
          <motion.circle
            key={`map-point-${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r={point.size}
            fill="hsl(var(--primary))"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
          />
        ))}
      </svg>
      <div className="absolute bottom-2 right-2">
        <Badge variant="secondary" className="text-xs">
          <TutorielCountUpAnimation value={150} duration={1500} /> établissements
        </Badge>
      </div>
    </div>

    {/* Répartition par région */}
    <div className="space-y-2">
      {regions.map((region, index) => (
        <motion.div
          key={region.name}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + index * 0.05 }}
          className="space-y-1"
        >
          <div className="flex justify-between text-xs">
            <span>{region.name}</span>
            <span className="text-muted-foreground">{region.count}</span>
          </div>
          <Progress value={region.percent} className="h-1.5" />
        </motion.div>
      ))}
    </div>
  </div>
))
AnalyseGeoMapPreview.displayName = 'AnalyseGeoMapPreview'

// ============================================
// RAPPORTS - GRAPHIQUES
// ============================================

export const RapportsChartPreview = memo(() => (
  <div className="p-4 space-y-4">
    <h4 className="font-semibold flex items-center gap-2">
      <BarChart3 className="h-4 w-4" />
      Rapports d'activité
    </h4>

    {/* KPIs du rapport */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Prospects', value: 45, trend: 'up', change: '+12%' },
        { label: 'Contrats', value: 8, trend: 'up', change: '+3' },
        { label: 'Churn', value: 2, trend: 'down', change: '-1%' },
      ].map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold">
                <TutorielCountUpAnimation value={kpi.value} duration={1200} />
              </p>
              <div className={`flex items-center justify-center gap-1 text-xs ${
                kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {kpi.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {kpi.change}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>

    {/* Mini graphique barres */}
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Évolution mensuelle</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-24">
          {[40, 55, 45, 60, 75, 65, 80, 85, 70, 90, 85, 95].map((height, i) => (
            <motion.div
              key={`bar-${i}-${height}`}
              className="flex-1 bg-primary rounded-t"
              initial={{ height: 0 }}
              animate={{ height: `${height}%` }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Jan</span>
          <span>Juin</span>
          <span>Déc</span>
        </div>
      </CardContent>
    </Card>
  </div>
))
RapportsChartPreview.displayName = 'RapportsChartPreview'

// ============================================
// FORUM - DISCUSSIONS
// ============================================

const forumThreads = [
  { title: 'Comment optimiser l\'import Excel ?', author: 'Marie D.', replies: 12, views: 156, solved: true },
  { title: 'Problème de synchronisation emails', author: 'Thomas L.', replies: 5, views: 89, solved: false },
  { title: 'Nouvelle fonctionnalité Gantt', author: 'Admin', replies: 23, views: 312, solved: true },
]

export const ForumThreadsPreview = memo(() => (
  <div className="p-4">
    <h4 className="font-semibold mb-4 flex items-center gap-2">
      <MessageSquare className="h-4 w-4" />
      Forum communautaire
    </h4>

    <div className="space-y-2">
      {forumThreads.map((thread, index) => (
        <motion.div
          key={thread.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{thread.title}</p>
                {thread.solved && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
                    Résolu
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                par {thread.author}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {thread.replies}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {thread.views}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
))
ForumThreadsPreview.displayName = 'ForumThreadsPreview'
