import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Target,
  TrendingUp,
  BarChart3,
  Euro,
  Calendar,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  FileText,
  Handshake,
  Rocket,
  GraduationCap,
  Zap,
} from "lucide-react"
import { useAllEtablissements } from "@/hooks/crm/useProspects"
import { PhaseSection } from "@/components/dashboard/PhaseSection"
import { DpiAnalysisTabs } from "@/components/dashboard/DpiAnalysisTabs"
import { calculateEtablissementValue } from "@/lib/valueCalculations"
import { cn, formatNumber } from "@/lib/utils"
import { IconCircle } from "@/components/ui/icon-circle"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader } from "@/components/ui/enhanced-card"
import { motion } from "framer-motion"

interface StatsByStatus {
  [key: string]: {
    count: number
    percentage: number
    totalPassages: number
    totalValue: number
  }
}

interface StatsByDPI {
  [key: string]: {
    count: number
    percentage: number
    totalPassages: number
    totalValue: number
  }
}

interface StatsBySpecificDPI {
  [key: string]: {
    count: number
    percentage: number
    totalPassages: number
    totalValue: number
  }
}

interface StatsByYear {
  [key: string]: {
    count: number
    percentage: number
    totalValue: number
  }
}

const safeNumber = (value: unknown): number => {
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

export function ProspectStatsDashboard() {
  const { data: allEtablissements } = useAllEtablissements()
  const navigate = useNavigate()

  const prospects = allEtablissements || []

  const handleStatusClick = (statut: string) => {
    navigate(`/etablissements?statut=${encodeURIComponent(statut)}`)
  }

  const handleDpiTypeClick = (dpiType: string) => {
    const dpiLourds = ['ORBIS', 'Cerner', 'UrQual', 'DxCare', 'Xtreme Santé', 'M-Crossway', 'Mediburn', 'Maincare', 'Autre Lourd']
    const dpiWebs = ['Hopital Manager', 'Care4U', 'Easily', 'Axigate', 'ResUrgences', 'Terminal Urgences', 'Sillage', 'TrakCare', 'Autre Web']
    
    let dpiFilter = ''
    if (dpiType === 'Lourd') {
      dpiFilter = dpiLourds.join(',')
    } else if (dpiType === 'Web') {
      dpiFilter = dpiWebs.join(',')
    } else if (dpiType === 'Inconnu') {
      dpiFilter = 'Inconnu'
    }
    
    navigate(`/etablissements?dpi=${encodeURIComponent(dpiFilter)}`)
  }

  const handleSpecificDpiClick = (dpi: string) => {
    navigate(`/etablissements?dpi=${encodeURIComponent(dpi)}`)
  }

  const handleSignatureYearClick = (year: string) => {
    navigate(`/etablissements?signature_year=${encodeURIComponent(year)}`)
  }

  const stats = useMemo(() => {
    if (!prospects || prospects.length === 0) {
      return {
        total: 0,
        byStatus: {} as StatsByStatus,
        byDPI: {} as StatsByDPI,
        bySpecificDPI: {} as StatsBySpecificDPI,
        bySignatureYear: {} as StatsByYear,
        totalValue: 0,
        totalPassages: 0
      }
    }

    const total = prospects.length
    const totalPassages = prospects.reduce((sum, p) => sum + safeNumber(p.nombre_passages_urgences_annuel), 0)
    const totalValue = prospects.reduce((sum, p) => sum + calculateEtablissementValue(p), 0)
    
    // Statistiques par statut
    const byStatus = prospects.reduce((acc, prospect) => {
      const statut = prospect.statut
      if (!acc[statut]) {
        acc[statut] = { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }
      }
      acc[statut].count++
      acc[statut].totalPassages += safeNumber(prospect.nombre_passages_urgences_annuel)
      acc[statut].totalValue += calculateEtablissementValue(prospect)
      return acc
    }, {} as StatsByStatus)

    Object.keys(byStatus).forEach(statut => {
      byStatus[statut].percentage = Math.round((byStatus[statut].count / total) * 100)
    })

    // Statistiques par DPI
    const byDPI = prospects.reduce((acc, prospect) => {
      let dpiType = 'Inconnu'
      if (prospect.dpi) {
        const dpiLourds = ['ORBIS', 'Cerner', 'UrQual', 'DxCare', 'Xtreme Santé', 'M-Crossway', 'Mediburn', 'Maincare', 'Autre Lourd']
        const dpiWebs = ['Hopital Manager', 'Care4U', 'Easily', 'Axigate', 'ResUrgences', 'Terminal Urgences', 'Sillage', 'TrakCare', 'Autre Web']
        
        if (dpiLourds.includes(prospect.dpi)) dpiType = 'Lourd'
        else if (dpiWebs.includes(prospect.dpi)) dpiType = 'Web'
      }
      
      if (!acc[dpiType]) {
        acc[dpiType] = { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }
      }
      acc[dpiType].count++
      acc[dpiType].totalPassages += safeNumber(prospect.nombre_passages_urgences_annuel)
      acc[dpiType].totalValue += calculateEtablissementValue(prospect)
      return acc
    }, {} as StatsByDPI)

    Object.keys(byDPI).forEach(dpi => {
      byDPI[dpi].percentage = Math.round((byDPI[dpi].count / total) * 100)
    })

    // Statistiques par DPI spécifique
    const bySpecificDPI = prospects.reduce((acc, prospect) => {
      const dpiName = prospect.dpi || 'Inconnu'
      
      if (!acc[dpiName]) {
        acc[dpiName] = { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }
      }
      acc[dpiName].count++
      acc[dpiName].totalPassages += safeNumber(prospect.nombre_passages_urgences_annuel)
      acc[dpiName].totalValue += calculateEtablissementValue(prospect)
      return acc
    }, {} as StatsBySpecificDPI)

    Object.keys(bySpecificDPI).forEach(dpi => {
      bySpecificDPI[dpi].percentage = Math.round((bySpecificDPI[dpi].count / total) * 100)
    })

    // Statistiques par année de signature
    const bySignatureYear = prospects.reduce((acc, prospect) => {
      if (!prospect.date_previsionnelle_signature) return acc
      
      const year = new Date(prospect.date_previsionnelle_signature).getFullYear().toString()
      if (!acc[year]) {
        acc[year] = { count: 0, percentage: 0, totalValue: 0 }
      }
      acc[year].count++
      acc[year].totalValue += calculateEtablissementValue(prospect)
      return acc
    }, {} as StatsByYear)

    const totalWithDate = Object.values(bySignatureYear).reduce((sum, stat) => sum + stat.count, 0)
    Object.keys(bySignatureYear).forEach(year => {
      bySignatureYear[year].percentage = totalWithDate > 0 ? Math.round((bySignatureYear[year].count / totalWithDate) * 100) : 0
    })

    return {
      total,
      byStatus,
      byDPI,
      bySpecificDPI,
      bySignatureYear,
      totalValue,
      totalPassages
    }
  }, [prospects])

  const getStatusIcon = (statut: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Refus': <AlertTriangle className="h-4 w-4 text-destructive" />,
      'Reporté': <Clock className="h-4 w-4 text-warning" />,
      'Bloqué': <AlertTriangle className="h-4 w-4 text-destructive" />,
      'Contacté': <Phone className="h-4 w-4 text-primary" />,
      'Attente RDV': <Calendar className="h-4 w-4 text-primary" />,
      'RDV pris': <CheckCircle2 className="h-4 w-4 text-success" />,
      'Attente post RDV': <Clock className="h-4 w-4 text-warning" />,
      'Dans les RDV': <Users className="h-4 w-4 text-primary" />,
      'Etude émise': <FileText className="h-4 w-4 text-accent-foreground" />,
      'Dans les RDV post EME': <Users className="h-4 w-4 text-accent-foreground" />,
      'Négociation': <Handshake className="h-4 w-4 text-warning" />,
      'Contractualisation': <FileText className="h-4 w-4 text-success" />,
      'Vendu': <CheckCircle2 className="h-4 w-4 text-success" />,
      'Contractuel': <FileText className="h-4 w-4 text-success" />,
      'Conformité': <CheckCircle2 className="h-4 w-4 text-success" />,
      'Déploiement': <Rocket className="h-4 w-4 text-success" />,
      'Formation': <GraduationCap className="h-4 w-4 text-success" />,
      'Go-Live': <Zap className="h-4 w-4 text-success" />,
      'Production': <Zap className="h-4 w-4 text-success" />
    }
    return icons[statut] || <Target className="h-4 w-4 text-muted-foreground" />
  }

  const getStatusColor = (statut: string) => {
    const colors: Record<string, string> = {
      'Refus': 'bg-destructive/10 text-destructive border-destructive/20',
      'Reporté': 'bg-warning/10 text-warning border-warning/20',
      'Bloqué': 'bg-destructive/10 text-destructive border-destructive/20',
      'Contacté': 'bg-primary/10 text-primary border-primary/20',
      'Attente RDV': 'bg-primary/10 text-primary border-primary/20',
      'RDV pris': 'bg-success/10 text-success border-success/20',
      'Attente post RDV': 'bg-warning/10 text-warning border-warning/20',
      'Dans les RDV': 'bg-primary/10 text-primary border-primary/20',
      'Etude émise': 'bg-accent/10 text-accent-foreground border-accent/20',
      'Dans les RDV post EME': 'bg-accent/10 text-accent-foreground border-accent/20',
      'Négociation': 'bg-warning/10 text-warning border-warning/20',
      'Contractualisation': 'bg-success/10 text-success border-success/20',
      'Vendu': 'bg-success/10 text-success border-success/20',
      'Contractuel': 'bg-success/10 text-success border-success/20',
      'Conformité': 'bg-success/10 text-success border-success/20',
      'Déploiement': 'bg-success/10 text-success border-success/20',
      'Formation': 'bg-success/10 text-success border-success/20',
      'Go-Live': 'bg-success/10 text-success border-success/20',
      'Production': 'bg-success/10 text-success border-success/20'
    }
    return colors[statut] || 'bg-muted text-muted-foreground'
  }

  const chartConfig = {
    Lourd: { label: "DPI Lourd", color: "hsl(var(--chart-1))" },
    Web: { label: "DPI Web", color: "hsl(var(--chart-2))" },
    Inconnu: { label: "Inconnu", color: "hsl(var(--chart-3))" }
  }

  const getSpecificDpiColor = (dpi: string, index: number): string => {
    if (dpi === 'Inconnu') return 'hsl(var(--muted-foreground))'
    
    const colors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))'
    ]
    
    return colors[index % colors.length]
  }

  // Organisation par phases pour l'accordéon détaillé
  const detailedPhases = useMemo(() => {
    return [
      {
        name: 'Phase Commerciale',
        icon: <Target className="h-5 w-5" />,
        color: 'bg-primary',
        statuses: [
          { name: 'Prospect', data: stats.byStatus['Prospect'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Prospect'), colorClasses: getStatusColor('Prospect') },
          { name: 'Contacté', data: stats.byStatus['Contacté'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Contacté'), colorClasses: getStatusColor('Contacté') },
          { name: 'Attente RDV', data: stats.byStatus['Attente RDV'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Attente RDV'), colorClasses: getStatusColor('Attente RDV') },
          { name: 'RDV pris', data: stats.byStatus['RDV pris'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('RDV pris'), colorClasses: getStatusColor('RDV pris') },
          { name: 'Dans les RDV', data: stats.byStatus['Dans les RDV'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Dans les RDV'), colorClasses: getStatusColor('Dans les RDV') }
        ]
      },
      {
        name: 'Phase Négociation',
        icon: <Handshake className="h-5 w-5" />,
        color: 'bg-warning',
        statuses: [
          { name: 'Etude émise', data: stats.byStatus['Etude émise'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Etude émise'), colorClasses: getStatusColor('Etude émise') },
          { name: 'Dans les RDV post EME', data: stats.byStatus['Dans les RDV post EME'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Dans les RDV post EME'), colorClasses: getStatusColor('Dans les RDV post EME') },
          { name: 'Négociation', data: stats.byStatus['Négociation'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Négociation'), colorClasses: getStatusColor('Négociation') },
          { name: 'Contractualisation', data: stats.byStatus['Contractualisation'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Contractualisation'), colorClasses: getStatusColor('Contractualisation') }
        ]
      },
      {
        name: 'Phase Déploiement',
        icon: <Rocket className="h-5 w-5" />,
        color: 'bg-success',
        statuses: [
          { name: 'Vendu', data: stats.byStatus['Vendu'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Vendu'), colorClasses: getStatusColor('Vendu') },
          { name: 'Contractuel', data: stats.byStatus['Contractuel'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Contractuel'), colorClasses: getStatusColor('Contractuel') },
          { name: 'Conformité', data: stats.byStatus['Conformité'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Conformité'), colorClasses: getStatusColor('Conformité') },
          { name: 'Déploiement', data: stats.byStatus['Déploiement'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Déploiement'), colorClasses: getStatusColor('Déploiement') },
          { name: 'Formation', data: stats.byStatus['Formation'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Formation'), colorClasses: getStatusColor('Formation') },
          { name: 'Go-Live', data: stats.byStatus['Go-Live'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Go-Live'), colorClasses: getStatusColor('Go-Live') }
        ]
      },
      {
        name: 'Statuts Spéciaux',
        icon: <AlertTriangle className="h-5 w-5" />,
        color: 'bg-destructive',
        statuses: [
          { name: 'Refus', data: stats.byStatus['Refus'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Refus'), colorClasses: getStatusColor('Refus') },
          { name: 'Reporté', data: stats.byStatus['Reporté'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Reporté'), colorClasses: getStatusColor('Reporté') },
          { name: 'Bloqué', data: stats.byStatus['Bloqué'] || { count: 0, percentage: 0, totalPassages: 0, totalValue: 0 }, icon: getStatusIcon('Bloqué'), colorClasses: getStatusColor('Bloqué') }
        ]
      }
    ]
  }, [stats.byStatus])

  const getStatusWeight = (status: string): number => {
    const weights: Record<string, number> = {
      'Refus': 0, 'Reporté': 10, 'Bloqué': 5, 'Contacté': 15,
      'Attente RDV': 25, 'RDV pris': 35, 'Attente post RDV': 40,
      'Dans les RDV': 45, 'Etude émise': 60, 'Dans les RDV post EME': 70,
      'Négociation': 80, 'Contractualisation': 90, 'Vendu': 100,
      'Prospect': 10
    }
    return weights[status] || 10
  }

  const metricCards = [
    { 
      label: 'Pipeline', 
      value: stats.total, 
      subtitle: 'Établissements',
      icon: Target, 
      color: 'blue' as const,
      iconColor: 'primary' as const
    },
    { 
      label: 'Passages', 
      value: `${Math.round(stats.totalPassages / 1000)}k`, 
      subtitle: 'Urgences annuelles',
      icon: Users, 
      color: 'cyan' as const,
      iconColor: 'success' as const
    },
    { 
      label: 'Valeur', 
      value: `${formatNumber(stats.totalValue)}€`, 
      subtitle: 'CA potentiel',
      icon: Euro, 
      color: 'green' as const,
      iconColor: 'success' as const
    },
    { 
      label: 'Avancement', 
      value: `${Object.keys(stats.byStatus).length > 0 ? Math.round(
        Object.entries(stats.byStatus).reduce((sum, [status, data]) => {
          return sum + (data.count * getStatusWeight(status))
        }, 0) / stats.total
      ) : 0}%`, 
      subtitle: 'Pipeline moyen',
      icon: TrendingUp, 
      color: 'orange' as const,
      iconColor: 'accent' as const
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header premium avec icône */}
      <div className="flex items-center gap-3 mb-2">
        <IconCircle 
          icon={BarChart3} 
          variant="gradient" 
          color="primary" 
          size="lg"
        />
        <div>
          <h2 className="text-xl font-bold">Analyse Détaillée de l'Activité</h2>
          <p className="text-sm text-muted-foreground">Vue d'ensemble du pipeline commercial</p>
        </div>
      </div>

      {/* Métriques principales avec EnhancedCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
          >
            <EnhancedCard 
              accentColor={metric.color} 
              accentPosition="top"
              hoverable
              glowOnHover
              className="h-full"
            >
              <EnhancedCardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <IconCircle 
                    icon={metric.icon} 
                    variant="soft" 
                    color={metric.iconColor} 
                    size="sm"
                  />
                </div>
              </EnhancedCardHeader>
              <EnhancedCardContent className="pt-0">
                <div className="text-3xl font-black">{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
              </EnhancedCardContent>
            </EnhancedCard>
          </motion.div>
        ))}
      </div>

      {/* Sections détaillées en accordéon avec style premium */}
      <Accordion type="multiple" className="space-y-3">
        {/* Détails par statut */}
        <AccordionItem 
          value="statuts" 
          className={cn(
            "border-2 rounded-xl overflow-hidden",
            "bg-gradient-to-r from-primary/5 to-transparent",
            "border-l-4 border-l-primary"
          )}
        >
          <AccordionTrigger className="hover:no-underline px-4 py-3">
            <div className="flex items-center gap-3">
              <IconCircle icon={BarChart3} variant="soft" color="primary" size="sm" />
              <span className="font-semibold">Détails par Statut</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {stats.total} établissements
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            {detailedPhases.map(phase => (
              <PhaseSection
                key={phase.name}
                name={phase.name}
                icon={phase.icon}
                color={phase.color}
                statuses={phase.statuses}
                onStatusClick={handleStatusClick}
              />
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Analyse DPI */}
        <AccordionItem 
          value="dpi" 
          className={cn(
            "border-2 rounded-xl overflow-hidden",
            "bg-gradient-to-r from-accent/5 to-transparent",
            "border-l-4 border-l-accent"
          )}
        >
          <AccordionTrigger className="hover:no-underline px-4 py-3">
            <div className="flex items-center gap-3">
              <IconCircle icon={Building2} variant="soft" color="accent" size="sm" />
              <span className="font-semibold">Analyse DPI</span>
              <Badge variant="secondary" className="bg-accent/10 text-accent">
                {Object.keys(stats.bySpecificDPI).length} DPI différents
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <DpiAnalysisTabs
              byDPI={stats.byDPI}
              bySpecificDPI={stats.bySpecificDPI}
              onDpiTypeClick={handleDpiTypeClick}
              onSpecificDpiClick={handleSpecificDpiClick}
              chartConfig={chartConfig}
              getSpecificDpiColor={getSpecificDpiColor}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Signatures prévisionnelles */}
        {Object.keys(stats.bySignatureYear).length > 0 && (
          <AccordionItem 
            value="signatures" 
            className={cn(
              "border-2 rounded-xl overflow-hidden",
              "bg-gradient-to-r from-success/5 to-transparent",
              "border-l-4 border-l-success"
            )}
          >
            <AccordionTrigger className="hover:no-underline px-4 py-3">
              <div className="flex items-center gap-3">
                <IconCircle icon={Calendar} variant="soft" color="success" size="sm" />
                <span className="font-semibold">Signatures Prévisionnelles</span>
                <Badge variant="secondary" className="bg-success/10 text-success">
                  {Object.keys(stats.bySignatureYear).length} années
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Object.entries(stats.bySignatureYear)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([year, data], index) => (
                    <motion.div
                      key={year}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSignatureYearClick(year)}
                      className={cn(
                        "p-4 rounded-xl border-2 bg-card cursor-pointer",
                        "hover:shadow-glow-cyan hover:-translate-y-0.5 transition-all duration-300",
                        "border-t-4 border-t-success"
                      )}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl font-black">{year}</span>
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          {data.count}
                        </Badge>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                        <motion.div
                          className="h-full bg-gradient-to-r from-success to-primary-light rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${data.percentage}%` }}
                          transition={{ duration: 0.6, delay: index * 0.05 }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">{data.percentage}% du pipeline</div>
                        <div className="text-sm font-bold text-success">{formatNumber(data.totalValue)}€</div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}
