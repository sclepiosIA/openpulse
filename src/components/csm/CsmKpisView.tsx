import { useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { EditableCell } from '@/components/csm/EditableCell'
import { useCsmKpisTrimestriels } from '@/hooks/csm/useCsmKpisTrimestriels'
import { useProduction } from '@/hooks/production/useProduction'
import { cn } from '@/lib/utils'

const KPI_COLUMNS = [
  { key: 'taux_satisfaction', label: 'Satisfaction' },
  { key: 'dossiers_traites', label: 'Dossiers' },
  { key: 'taux_utilisation_formatage', label: 'Formatage' },
  { key: 'taux_utilisation_ocr', label: 'OCR/Dictée' },
  { key: 'taux_utilisation_cotations', label: 'Cotations' },
  { key: 'taux_utilisation_courriers', label: 'Courriers' },
  { key: 'taux_utilisation_traduction', label: 'Traduction' },
  { key: 'taux_utilisation_examens', label: 'Examens' },
  { key: 'taux_utilisation_chatbot', label: 'Chatbot' },
  { key: 'taux_uhcd_marque', label: 'UHCD OpenPulse' },
  { key: 'taux_uhcd_compte', label: 'UHCD Compte' },
  { key: 'ccm2_plus', label: 'CCM2+' },
  { key: 'ccmu3_plus', label: 'CCMU3+' },
  { key: 'avis_specialise', label: 'Avis spé.' },
  { key: 'temps_passage_urgences', label: 'Temps passage' },
]

export function CsmKpisView() {
  const { data: etablissements } = useProduction()
  const { data: kpis, upsert, remove } = useCsmKpisTrimestriels()

  const kpisMap = useMemo(() => {
    const map = new Map<string, typeof kpis>()
    kpis.forEach(k => {
      if (!map.has(k.etablissement_id)) map.set(k.etablissement_id, [])
      map.get(k.etablissement_id)!.push(k)
    })
    return map
  }, [kpis])

  return (
    <div className="space-y-4">
      {(etablissements || []).map(etab => {
        const etabKpis = kpisMap.get(etab.id) || []

        // Find last evolution row index
        let lastEvolutionIdx = -1
        etabKpis.forEach((kpi, idx) => {
          if (kpi.periode.toLowerCase().includes('evolution') || kpi.periode.toLowerCase().includes('évolution')) {
            lastEvolutionIdx = idx
          }
        })

        return (
          <Collapsible key={etab.id} defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-3 w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <ChevronDown className="w-4 h-4 transition-transform" />
              <span className="font-semibold text-sm">{etab.nom}</span>
              <span className="text-xs text-muted-foreground">({etabKpis.length} périodes)</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="min-w-[140px] sticky left-0 bg-muted/30 z-10">Période</TableHead>
                      {KPI_COLUMNS.map(col => (
                        <TableHead key={col.key} className="min-w-[90px] text-center text-xs">{col.label}</TableHead>
                      ))}
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etabKpis.map((kpi, idx) => {
                      const isEvolution = kpi.periode.toLowerCase().includes('evolution') || kpi.periode.toLowerCase().includes('évolution')
                      const isBilan = kpi.periode.toLowerCase().includes('bilan')
                      const isLastEvolution = idx === lastEvolutionIdx

                      return (
                        <TableRow
                          key={kpi.id}
                          className={cn(
                            "hover:bg-muted/20",
                            isEvolution && "bg-pink-50/50",
                            isBilan && "bg-muted/40 border-t-2 font-semibold"
                          )}
                        >
                          <TableCell className="sticky left-0 bg-background z-10">
                            <div>
                              <EditableCell value={kpi.periode} placeholder="Période" onSave={(v) => upsert({ ...kpi, periode: v })} />
                              {isLastEvolution && (
                                <p className="text-[10px] italic text-muted-foreground mt-0.5">*si données N-1 disponibles</p>
                              )}
                            </div>
                          </TableCell>
                          {KPI_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-center">
                              <EditableCell
                                value={(kpi as any)[col.key]?.toString()}
                                placeholder="-"
                                className="text-center text-xs"
                                onSave={(v) => upsert({ ...kpi, [col.key]: v ? Number(v) : null })}
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(kpi.id)} aria-label="Supprimer">
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 gap-1 text-xs"
                onClick={() => upsert({
                  etablissement_id: etab.id,
                  periode: `Trimestre ${etabKpis.length + 1}`,
                  sort_order: etabKpis.length,
                })}
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une période
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
