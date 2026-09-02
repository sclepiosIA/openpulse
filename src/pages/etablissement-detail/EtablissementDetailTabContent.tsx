import { useNavigate } from 'react-router-dom'
import { Edit, BarChart3, BookOpen, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { PhaseKey } from '@/config/phases'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { EtablissementInfo } from '@/components/etablissement/EtablissementInfo'
import { EtablissementTasks } from '@/components/etablissement/EtablissementTasks'
import { EtablissementContacts } from '@/components/etablissement/EtablissementContacts'
import { EtablissementTeam } from '@/components/etablissement/EtablissementTeam'
import { EtablissementDocuments } from '@/components/etablissement/EtablissementDocuments'
import { EtablissementGantt } from '@/components/etablissement/EtablissementGantt'
import { CalendarAgendaView } from '@/components/calendrier/CalendarAgendaView'
import { EtablissementEmailsTab } from '@/components/etablissement/EtablissementEmailsTab'
import { EtablissementPortalTab } from '@/components/portail-client/EtablissementPortalTab'
import { CustomerActivitiesTimelineV2 } from '@/components/etablissement/CustomerActivitiesTimelineV2'
import { EtablissementActivityTimeline } from '@/components/etablissement/EtablissementActivityTimeline'
import { CommunicationAISynthesis } from '@/components/etablissement/CommunicationAISynthesis'
import { CallHistoryTab } from '@/components/cti/CallHistoryTab'
import { BehavioralScoreCard } from '@/components/scoring/BehavioralScoreCard'
import { BehavioralEventsTimeline } from '@/components/scoring/BehavioralEventsTimeline'
import { ScoreEvolutionChart } from '@/components/scoring/ScoreEvolutionChart'
import { AttributionFunnel } from '@/components/scoring/AttributionFunnel'
import { StatsIframeViewer } from '@/components/etablissement/StatsIframeViewer'
import { EtablissementCsmTabs } from './EtablissementCsmTabs'
import { EtablissementEnquetesTab } from '@/components/etablissement/EtablissementEnquetesTab'
import { EtablissementFacturationConfig } from '@/components/etablissement/EtablissementFacturationConfig'
import { FacturationDetaillee } from '@/components/etablissement/FacturationDetaillee'

type CsmTab = 'csm-sante' | 'csm-parcours' | 'csm-facturation' | 'csm-kpis-mensuels' | 'csm-kpis-trimestriels' | 'csm-playbooks'

interface Props {
  activeTab: string
  uiActiveTab: string
  etablissement: any
  id: string
  phaseFilter: PhaseKey | null
  taches: any[] | undefined
  onTaskClick: (task: unknown) => void
  onEditOpen: () => void
}

export function EtablissementDetailTabContent({
  activeTab,
  uiActiveTab,
  etablissement,
  id,
  phaseFilter,
  taches,
  onTaskClick,
  onEditOpen,
}: Props) {
  const navigate = useNavigate()
  const showStatsLocal = etablissement.statut === 'Production'

  switch (activeTab) {
    case 'infos':
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Informations de l'établissement</h3>
            <Button onClick={onEditOpen} className="gap-2">
              <Edit className="w-4 h-4" />
              Modifier
            </Button>
          </div>
          <EtablissementInfo etablissement={etablissement} />
        </div>
      )

    case 'contacts':
      return <div className="space-y-6"><EtablissementContacts etablissementId={id} /></div>

    case 'taches':
      return (
        <div className="space-y-6">
          <EtablissementTasks etablissementId={id} initialPhaseFilter={phaseFilter || undefined} />
        </div>
      )

    case 'kanban':
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Vue Kanban - Gestion des tâches</h3>
          </div>
          <div className="h-[600px] bg-muted/20 rounded-lg p-4 overflow-auto">
            <KanbanBoard etablissementId={id} />
          </div>
        </div>
      )

    case 'documents':
      return <div className="space-y-6"><EtablissementDocuments etablissementId={id} /></div>

    case 'facturation':
      return (
        <div className="space-y-6">
          <EtablissementFacturationConfig etablissementId={id} etablissement={etablissement} />
          <FacturationDetaillee etablissementId={id} etablissement={etablissement} />
        </div>
      )

    case 'portail-client':
      return <EtablissementPortalTab etablissementId={id} initialBackendUrl={(etablissement as { backend_url?: string }).backend_url} />


    case 'gantt':
      return (
        <div className="space-y-6">
          <EtablissementGantt key={`gantt-${id}-${activeTab}`} etablissementId={id} />
        </div>
      )

    case 'agenda':
      return taches ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Agenda - Vue chronologique</h3>
            <Badge variant="secondary">
              {taches.filter((t: any) => t.echeance).length} tâche(s) planifiée(s)
            </Badge>
          </div>
          <CalendarAgendaView tasks={taches} onTaskClick={onTaskClick} />
        </div>
      ) : null

    case 'equipe':
      return (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Équipe assignée</h3>
          <EtablissementTeam commercial={etablissement.commercial} chef_projet={etablissement.chef_projet} csm={etablissement.csm} />
        </div>
      )

    case 'scoring':
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Scoring & Attribution</h3>
            <p className="text-sm text-muted-foreground">
              Score de conversion (statique + comportemental), évolution et canaux contributeurs.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <BehavioralScoreCard etablissementId={id} staticScore={(etablissement as { score_conversion?: number }).score_conversion ?? 0} />
            <ScoreEvolutionChart etablissementId={id} days={90} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <AttributionFunnel etablissementId={id} />
            <BehavioralEventsTimeline etablissementId={id} limit={20} />
          </div>
        </div>
      )

    case 'csm-sante':
    case 'csm-parcours':
    case 'csm-facturation':
    case 'csm-kpis-mensuels':
    case 'csm-kpis-trimestriels':
    case 'csm-playbooks':
      if (!showStatsLocal) return null
      return <EtablissementCsmTabs tab={uiActiveTab as CsmTab} etablissementId={id} />

    case 'enquetes':
      if (!showStatsLocal) return null
      return <EtablissementEnquetesTab etablissementId={id} />


    case 'stats-utilisation':
      if (!showStatsLocal) return null
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Statistiques d'utilisation</h3>
              <p className="text-sm text-muted-foreground">Graphiques et métriques d'utilisation de la plateforme</p>
            </div>
            <Badge variant="outline">Production</Badge>
          </div>
          <StatsIframeViewer
            url={etablissement.stats_utilisation_url}
            title="Statistiques d'utilisation"
            description="Consultez les données d'utilisation en temps réel depuis le backend OpenPulse-IA"
            etablissementId={id}
            fieldName="stats_utilisation_url"
          />
        </div>
      )

    case 'stats-urgences':
      if (!showStatsLocal) return null
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Activité des urgences</h3>
              <p className="text-sm text-muted-foreground">Analyse de l'activité DPI aux urgences</p>
            </div>
            <Badge variant="outline">Production</Badge>
          </div>
          <StatsIframeViewer
            url={etablissement.stats_urgences_url}
            title="Activité des urgences"
            description="Visualisez les statistiques DPI groupées par mois"
            etablissementId={id}
            fieldName="stats_urgences_url"
          />
        </div>
      )

    case 'emails':
      return <div className="space-y-6"><EtablissementEmailsTab etablissementId={id} etablissementNom={etablissement?.nom} /></div>

    case 'appels':
      return <div className="space-y-6"><CallHistoryTab etablissementId={id} /></div>

    case 'interactions':
      return <div className="space-y-6"><CustomerActivitiesTimelineV2 etablissementId={id} /></div>

    case 'activite-unifiee':
      return <div className="space-y-6"><EtablissementActivityTimeline etablissementId={id} /></div>

    case 'synthese-ia':
      return (
        <div className="space-y-6">
          <CommunicationAISynthesis etablissementId={id} etablissementNom={etablissement?.nom || 'Établissement'} />
        </div>
      )

    default:
      return null
  }
}
