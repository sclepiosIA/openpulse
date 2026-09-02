import { useMemo } from 'react'
import { ApporteurCard, type ApporteurTopEntry } from './ApporteurCard'
import { ApporteurContextCards } from './ApporteurContextCards'
import { ApporteurProspectsTable } from './ApporteurProspectsTable'
import { useApporteurProspects } from './useApporteurProspects'
import { APPORTEUR_CLIENT_STATUTS } from './useApporteursArr'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { useProspects } from '@/hooks/crm/useProspects'
import type { Apporteur } from './types'

interface ApporteurDetailTabProps {
  apporteur: Apporteur
}

export function ApporteurDetailTab({ apporteur }: ApporteurDetailTabProps) {
  const { prospects, isLoading } = useApporteurProspects(apporteur.partenaireId)
  const clientStatuts = APPORTEUR_CLIENT_STATUTS as readonly string[]
  const clientsCount = prospects.filter((p) => clientStatuts.includes(p.statut)).length
  const tauxConversion = isLoading
    ? undefined
    : prospects.length === 0
      ? null
      : (clientsCount / prospects.length) * 100

  const enrichedProspects = useMemo(() => {
    return prospects.map((p) => ({
      nom: p.nom,
      statut: p.statut as string,
      ca: calculateEtablissementValue(p as Parameters<typeof calculateEtablissementValue>[0]),
    }))
  }, [prospects])

  const arrGenere = useMemo(() => {
    if (isLoading) return undefined
    return enrichedProspects
      .filter((p) => clientStatuts.includes(p.statut))
      .reduce((sum, p) => sum + p.ca, 0)
  }, [enrichedProspects, isLoading, clientStatuts])

  const topClients: ApporteurTopEntry[] | undefined = useMemo(() => {
    if (isLoading) return undefined
    return enrichedProspects
      .filter((p) => clientStatuts.includes(p.statut))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 3)
  }, [enrichedProspects, isLoading, clientStatuts])

  const topProspects: ApporteurTopEntry[] | undefined = useMemo(() => {
    if (isLoading) return undefined
    return enrichedProspects
      .filter((p) => !clientStatuts.includes(p.statut))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 3)
  }, [enrichedProspects, isLoading, clientStatuts])

  const { data: allProspects } = useProspects()
  const prospectsCiblesTousPartenaires = allProspects?.length ?? 0

  const prospectsCibles = isLoading
    ? apporteur.metrics.prospectsActifs + apporteur.metrics.clientsApportes
    : prospects.length

  return (
    <div className="space-y-4">
      <ApporteurCard
        apporteur={apporteur}
        compact
        nameLinkTo="partenaire"
        prospectsActifsOverride={isLoading ? undefined : prospects.length}
        clientsApportesOverride={isLoading ? undefined : clientsCount}
        tauxConversionOverride={tauxConversion}
        arrGenereOverride={arrGenere}
        topClientsOverride={topClients}
        topProspectsOverride={topProspects}
      />
      <ApporteurContextCards
        apporteurId={apporteur.id}
        dateDebut={apporteur.dateDebut}
        dateFin={apporteur.dateFin ?? null}
        prospectsCibles={prospectsCibles}
        clientsSignes={isLoading ? apporteur.metrics.clientsApportes : clientsCount}
        prospectsCiblesTousPartenaires={prospectsCiblesTousPartenaires}
      />
      <ApporteurProspectsTable partenaireId={apporteur.partenaireId} />
    </div>
  )
}
