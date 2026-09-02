import { EtablissementGanttContainer } from '@/components/etablissement-gantt/EtablissementGanttContainer'

interface EtablissementGanttProps {
  etablissementId: string
}

export function EtablissementGantt({ etablissementId }: EtablissementGanttProps) {
  return <EtablissementGanttContainer etablissementId={etablissementId} />
}
