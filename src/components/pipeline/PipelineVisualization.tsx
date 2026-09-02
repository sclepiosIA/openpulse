import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Target,
  Phone,
  Calendar,
  Users,
  FileText,
  Handshake,
  CheckCircle2,
  Clock,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react"
import { useAllEtablissements } from "@/hooks/crm/useProspects"
import { StageCard } from "@/components/pipeline/StageCard"
import { calculateEtablissementValue } from "@/lib/valueCalculations"
import { formatNumber } from "@/lib/utils"
import { debug } from "@/lib/debug"

/**
 * PipelineVisualization - Affiche le pipeline commercial global
 * 
 * Organisation en 3 phases calculées par STATUT (pas par index) :
 * - Début de cycle : Prospect, Contacté, Attente RDV
 * - Phase active : RDV pris → Contractualisation
 * - Phase finale : Vendu → Production
 * 
 * ⚠️ Important : Les phases sont calculées par NOM DE STATUT, pas par index du tableau,
 * pour éviter les incohérences quand certains statuts n'ont pas d'établissements.
 */

interface PipelineStage {
  name: string
  count: number
  value: number
  color: string
  icon: React.ReactNode
  percentage: number
}

// Définition stricte des phases par statut
const PHASE_DEFINITIONS = {
  debut_cycle: ['Prospect', 'Contacté', 'Attente RDV'],
  phase_active: ['RDV pris', 'Attente post RDV', 'Dans les RDV', 'Etude émise', 'Dans les RDV post EME', 'Négociation', 'Contractualisation'],
  phase_finale: ['Vendu', 'Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live', 'Production']
} as const

export function PipelineVisualization() {
  const { data: allEtablissements } = useAllEtablissements()
  const navigate = useNavigate()

  // Debug pour vérifier les calculs
  // Log pour debug si nécessaire en développement
  if (import.meta.env.DEV) {
    debug.log('PipelineVisualization - Total établissements:', allEtablissements?.length || 0)
  }

  const handleStageClick = (stageName: string) => {
    debug.log(`Navigating to etablissements with status: ${stageName}`)
    navigate(`/etablissements?statut=${encodeURIComponent(stageName)}`)
  }

  const pipelineData = useMemo(() => {
    if (!allEtablissements || allEtablissements.length === 0) {
      return []
    }

    // Inclure TOUS les statuts pour une vue complète du pipeline global
    const stageOrder = [
      'Prospect',
      'Contacté',
      'Attente RDV', 
      'RDV pris',
      'Attente post RDV',
      'Dans les RDV',
      'Etude émise',
      'Dans les RDV post EME',
      'Négociation',
      'Contractualisation',
      'Vendu',
      'Contractuel',
      'Conformité',
      'Déploiement',
      'Formation',
      'Go-Live',
      'Production'
    ]

    const stageConfig = {
      'Prospect': { color: 'bg-muted-foreground', icon: <Target className="h-4 w-4" /> },
      'Contacté': { color: 'bg-primary', icon: <Phone className="h-4 w-4" /> },
      'Attente RDV': { color: 'bg-primary/80', icon: <Calendar className="h-4 w-4" /> },
      'RDV pris': { color: 'bg-success/80', icon: <CheckCircle2 className="h-4 w-4" /> },
      'Attente post RDV': { color: 'bg-warning/80', icon: <Clock className="h-4 w-4" /> },
      'Dans les RDV': { color: 'bg-primary/90', icon: <Users className="h-4 w-4" /> },
      'Etude émise': { color: 'bg-accent', icon: <FileText className="h-4 w-4" /> },
      'Dans les RDV post EME': { color: 'bg-accent/90', icon: <Users className="h-4 w-4" /> },
      'Négociation': { color: 'bg-warning', icon: <Handshake className="h-4 w-4" /> },
      'Contractualisation': { color: 'bg-success/90', icon: <FileText className="h-4 w-4" /> },
      'Vendu': { color: 'bg-success', icon: <CheckCircle2 className="h-4 w-4" /> },
      'Contractuel': { color: 'bg-secondary', icon: <FileText className="h-4 w-4" /> },
      'Conformité': { color: 'bg-secondary/90', icon: <CheckCircle2 className="h-4 w-4" /> },
      'Déploiement': { color: 'bg-accent/70', icon: <Users className="h-4 w-4" /> },
      'Formation': { color: 'bg-accent/80', icon: <Users className="h-4 w-4" /> },
      'Go-Live': { color: 'bg-success/70', icon: <CheckCircle2 className="h-4 w-4" /> },
      'Production': { color: 'bg-success/60', icon: <CheckCircle2 className="h-4 w-4" /> }
    }

    // Compter les établissements RÉELS par statut avec calcul de valeur UNIFIÉ
    const stageCounts = allEtablissements.reduce((acc, etablissement) => {
      const statut = etablissement.statut
      if (!acc[statut]) {
        acc[statut] = { count: 0, value: 0 }
      }
      acc[statut].count++
      
      // Utiliser la fonction unifiée de calcul de valeur
      const valeurEtablissement = calculateEtablissementValue(etablissement)
      
      acc[statut].value += valeurEtablissement
      return acc
    }, {} as Record<string, { count: number, value: number }>)

    // Compter TOUS les établissements pour le pipeline global
    const totalInPipeline = allEtablissements.length

    // Créer les données du pipeline avec TOUS les statuts qui ont des données
    return stageOrder.map(stageName => {
      const stageData = stageCounts[stageName] || { count: 0, value: 0 }
      const config = stageConfig[stageName as keyof typeof stageConfig]
      
      return {
        name: stageName,
        count: stageData.count,
        value: stageData.value,
        color: config?.color || 'bg-gray-500',
        icon: config?.icon || <Target className="h-4 w-4" />,
        percentage: totalInPipeline > 0 ? Math.round((stageData.count / totalInPipeline) * 100) : 0
      }
    }).filter(stage => stage.count > 0) // Ne montrer que les étapes avec des établissements RÉELS
  }, [allEtablissements])

  const totalValue = pipelineData.reduce((sum, stage) => sum + stage.value, 0)
  // Utiliser directement le nombre total d'établissements pour éviter les incohérences
  const totalEtablissements = allEtablissements?.length || 0

  // Calculer les statistiques par phase en fonction du NOM du statut
  const phaseStats = useMemo(() => {
    const stats = {
      debut_cycle: { count: 0, value: 0 },
      phase_active: { count: 0, value: 0 },
      phase_finale: { count: 0, value: 0 }
    }

    pipelineData.forEach(stage => {
      if (PHASE_DEFINITIONS.debut_cycle.includes(stage.name as any)) {
        stats.debut_cycle.count += stage.count
        stats.debut_cycle.value += stage.value
      } else if (PHASE_DEFINITIONS.phase_active.includes(stage.name as any)) {
        stats.phase_active.count += stage.count
        stats.phase_active.value += stage.value
      } else if (PHASE_DEFINITIONS.phase_finale.includes(stage.name as any)) {
        stats.phase_finale.count += stage.count
        stats.phase_finale.value += stage.value
      }
    })

    // Validation en développement
    if (import.meta.env.DEV) {
      const sumPhases = stats.debut_cycle.count + stats.phase_active.count + stats.phase_finale.count
      debug.log('[PipelineVisualization] Total établissements:', totalEtablissements)
      debug.log('[PipelineVisualization] Début de cycle:', stats.debut_cycle.count)
      debug.log('[PipelineVisualization] Phase active:', stats.phase_active.count)
      debug.log('[PipelineVisualization] Phase finale:', stats.phase_finale.count)
      debug.log('[PipelineVisualization] Somme des phases:', sumPhases)
      
      if (sumPhases !== totalEtablissements) {
        debug.warn('[PipelineVisualization] ⚠️ Incohérence détectée! Différence:', totalEtablissements - sumPhases)
      }
    }

    return stats
  }, [pipelineData, totalEtablissements])

  // Gestionnaires de clic pour naviguer vers les établissements filtrés par phase
  const handlePhaseClick = (phase: keyof typeof PHASE_DEFINITIONS) => {
    const statuts = PHASE_DEFINITIONS[phase].join(',')
    navigate(`/etablissements?statut=${encodeURIComponent(statuts)}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Pipeline Commercial Global
        </CardTitle>
        <CardDescription>
          Vue unifiée de la progression • {totalEtablissements} établissements • {formatNumber(totalValue)} € de valeur totale
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Grille unifiée des étapes */}
          {pipelineData.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
              Aucun établissement dans le pipeline avec les filtres actuels.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {pipelineData.map((stage) => (
                <StageCard
                  key={stage.name}
                  stage={stage}
                  onClick={() => handleStageClick(stage.name)}
                />
              ))}
            </div>
          )}

          {/* Indicateurs de conversion par phase (calculés par statut, pas par index) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
            <button
              onClick={() => handlePhaseClick('debut_cycle')}
              className="flex flex-col items-center justify-center space-y-2 p-3 rounded-md bg-card border hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">
                  {phaseStats.debut_cycle.count}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">Début de cycle</div>
                <div className="text-xs text-muted-foreground">Prospect → Attente RDV</div>
                <div className="text-xs font-semibold text-primary mt-1">
                  {formatNumber(phaseStats.debut_cycle.value)} €
                </div>
              </div>
            </button>
            
            <button
              onClick={() => handlePhaseClick('phase_active')}
              className="flex flex-col items-center justify-center space-y-2 p-3 rounded-md bg-card border hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Activity className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="text-2xl font-bold text-accent-foreground">
                  {phaseStats.phase_active.count}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">Phase active</div>
                <div className="text-xs text-muted-foreground">RDV pris → Contractualisation</div>
                <div className="text-xs font-semibold text-accent-foreground mt-1">
                  {formatNumber(phaseStats.phase_active.value)} €
                </div>
              </div>
            </button>
            
            <button
              onClick={() => handlePhaseClick('phase_finale')}
              className="flex flex-col items-center justify-center space-y-2 p-3 rounded-md bg-card border hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <Zap className="h-5 w-5 text-success" />
                </div>
                <div className="text-2xl font-bold text-success">
                  {phaseStats.phase_finale.count}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium">Phase finale</div>
                <div className="text-xs text-muted-foreground">Vendu → Production</div>
                <div className="text-xs font-semibold text-success mt-1">
                  {formatNumber(phaseStats.phase_finale.value)} €
                </div>
              </div>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}