import { ApporteurCard, type ApporteurTopEntry } from './ApporteurCard'
import { useApporteurProspects } from './useApporteurProspects'
import { useApporteursArr, APPORTEUR_CLIENT_STATUTS } from './useApporteursArr'
import { useProspects } from '@/hooks/crm/useProspects'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import {
  calcScoreCommercial,
  calcScoreDependance,
  calcScoreGlobal,
  monthsSince,
} from '@/config/partenariatSante'
import { useApporteurManualScores } from './useApporteurManualScores'
import type { Apporteur } from './types'

interface ApporteurDashboardProps {
  apporteurs: Apporteur[]
}

function computeTops(prospects: ReturnType<typeof useApporteurProspects>['prospects']) {
  const clientStatuts = APPORTEUR_CLIENT_STATUTS as readonly string[]
  const enriched = prospects.map((p) => ({
    nom: p.nom,
    statut: p.statut as string,
    ca: calculateEtablissementValue(p as Parameters<typeof calculateEtablissementValue>[0]),
  }))
  const topClients: ApporteurTopEntry[] = enriched
    .filter((p) => clientStatuts.includes(p.statut))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 3)
  const topProspects: ApporteurTopEntry[] = enriched
    .filter((p) => !clientStatuts.includes(p.statut))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 3)
  return { topClients, topProspects }
}

function ApporteurDashboardCard({
  apporteur,
  arrOverride,
  prospectsCiblesTousPartenaires,
}: {
  apporteur: Apporteur
  arrOverride: number | undefined
  prospectsCiblesTousPartenaires: number
}) {
  const { prospects, isLoading } = useApporteurProspects(apporteur.partenaireId)
  const { scores: manualScores } = useApporteurManualScores(apporteur.id)
  const clientsCount = prospects.filter((p) =>
    (APPORTEUR_CLIENT_STATUTS as readonly string[]).includes(p.statut)
  ).length
  const tauxConversion = isLoading
    ? undefined
    : prospects.length === 0
      ? null
      : (clientsCount / prospects.length) * 100

  const { topClients, topProspects } = isLoading
    ? { topClients: undefined, topProspects: undefined }
    : computeTops(prospects)

  let santeScore: number | undefined
  if (!isLoading) {
    const moisAnciennete = monthsSince(apporteur.dateDebut)
    const scoreCommercial = calcScoreCommercial({
      prospectsCibles: prospects.length,
      clientsSignes: clientsCount,
      moisAnciennete,
    })
    const scoreDependance = calcScoreDependance({
      prospectsCiblesPartenaire: prospects.length,
      prospectsCiblesTousPartenaires,
    })
    santeScore = calcScoreGlobal({
      commercial: scoreCommercial,
      organisation: manualScores.organisation.value,
      relation: manualScores.relation.value,
      dependance: scoreDependance,
    })
  }

  return (
    <ApporteurCard
      apporteur={apporteur}
      prospectsActifsOverride={isLoading ? undefined : prospects.length}
      clientsApportesOverride={isLoading ? undefined : clientsCount}
      tauxConversionOverride={tauxConversion}
      arrGenereOverride={arrOverride}
      topClientsOverride={topClients}
      topProspectsOverride={topProspects}
      santeScoreOverride={santeScore}
    />
  )
}

export function ApporteurDashboard({ apporteurs }: ApporteurDashboardProps) {
  const { arrByApporteurId, isReady } = useApporteursArr(apporteurs)
  const { data: allProspects } = useProspects()
  const prospectsCiblesTousPartenaires = allProspects?.length ?? 0
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {apporteurs.map((a) => (
        <ApporteurDashboardCard
          key={a.id}
          apporteur={a}
          arrOverride={isReady ? (arrByApporteurId[a.id] ?? 0) : undefined}
          prospectsCiblesTousPartenaires={prospectsCiblesTousPartenaires}
        />
      ))}
    </div>
  )
}
