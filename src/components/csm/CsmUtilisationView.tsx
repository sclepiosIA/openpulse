import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Plus, Trash2, BarChart3, Users, TrendingUp, TrendingDown } from 'lucide-react'
import { EditableCell } from '@/components/csm/EditableCell'
import { useCsmKpisMensuels } from '@/hooks/csm/useCsmKpisMensuels'
import { useProduction } from '@/hooks/production/useProduction'
import { cn } from '@/lib/utils'

function calcEvolution(current: number | null, previous: number | null): string {
  if (current == null || previous == null || previous === 0) return '-'
  const diff = ((current - previous) / previous) * 100
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
}

function EvolutionBadge({ current, previous }: { current: number | null; previous: number | null }) {
  const evo = calcEvolution(current, previous)
  if (evo === '-') return <span className="text-xs text-muted-foreground">-</span>
  const isPositive = evo.startsWith('+')
  return (
    <span className={cn("text-xs font-medium", isPositive ? "text-emerald-600" : "text-red-600")}>
      {evo}
    </span>
  )
}

export function CsmUtilisationView() {
  const { data: etablissements } = useProduction()
  const { data: kpis, upsert, remove } = useCsmKpisMensuels()

  const kpisMap = useMemo(() => {
    const map = new Map<string, typeof kpis>()
    kpis.forEach(k => {
      if (!map.has(k.etablissement_id)) map.set(k.etablissement_id, [])
      map.get(k.etablissement_id)!.push(k)
    })
    return map
  }, [kpis])

  const stats = useMemo(() => {
    const total = etablissements?.length || 0
    const withData = new Set(kpis.map(k => k.etablissement_id)).size
    const above60 = new Set(kpis.filter(k => (k.taux_utilisation || 0) >= 60).map(k => k.etablissement_id)).size
    const below40 = new Set(kpis.filter(k => (k.taux_utilisation || 0) < 40).map(k => k.etablissement_id)).size
    return { total, withData, above60, below40 }
  }, [etablissements, kpis])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Comptes suivis', value: stats.total },
          { icon: BarChart3, label: 'Avec données', value: stats.withData },
          { icon: TrendingUp, label: 'Util. > 60%', value: stats.above60 },
          { icon: TrendingDown, label: 'Util. < 40%', value: stats.below40 },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(etablissements || []).map(etab => {
        const etabKpis = kpisMap.get(etab.id) || []
        const avgUtil = etabKpis.length > 0
          ? Math.round(etabKpis.reduce((s, k) => s + (k.taux_utilisation || 0), 0) / etabKpis.length)
          : 0
        const avgUhcdBackend = etabKpis.length > 0
          ? (etabKpis.reduce((s, k) => s + (k.taux_uhcd_backend || 0), 0) / etabKpis.length).toFixed(1)
          : '-'
        const avgUhcdCompte = etabKpis.length > 0
          ? (etabKpis.reduce((s, k) => s + (k.taux_uhcd_compte || 0), 0) / etabKpis.length).toFixed(1)
          : '-'

        return (
          <Collapsible key={etab.id} defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-3 w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <ChevronDown className="w-4 h-4 transition-transform" />
              <span className="font-semibold text-sm">{etab.nom}</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                avgUtil >= 60 ? "bg-emerald-100 text-emerald-700" :
                avgUtil >= 40 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              )}>
                Moy. {avgUtil}%
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="min-w-[120px]">Période</TableHead>
                      <TableHead className="min-w-[100px]">UHCD Backend</TableHead>
                      <TableHead className="min-w-[100px]">UHCD Compte</TableHead>
                      <TableHead className="min-w-[100px]">Palier EME</TableHead>
                      <TableHead className="min-w-[100px]">Objectif EME</TableHead>
                      <TableHead className="min-w-[150px]">Utilisation</TableHead>
                      <TableHead className="min-w-[70px]">Évo. Util.</TableHead>
                      <TableHead className="min-w-[70px]">Évo. UHCD</TableHead>
                      <TableHead className="min-w-[100px]">Passages</TableHead>
                      <TableHead className="min-w-[100px]">Dossiers</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etabKpis.map((kpi, idx) => {
                      const prev = idx > 0 ? etabKpis[idx - 1] : null
                      return (
                        <TableRow key={kpi.id} className="hover:bg-muted/20">
                          <TableCell>
                            <EditableCell value={kpi.mois} placeholder="Mois" onSave={(v) => upsert({ ...kpi, mois: v })} />
                          </TableCell>
                          <TableCell>
                            <EditableCell value={kpi.taux_uhcd_backend?.toString()} placeholder="%" onSave={(v) => upsert({ ...kpi, taux_uhcd_backend: v ? Number(v) : null })} />
                          </TableCell>
                          <TableCell>
                            <EditableCell value={kpi.taux_uhcd_compte?.toString()} placeholder="%" onSave={(v) => upsert({ ...kpi, taux_uhcd_compte: v ? Number(v) : null })} />
                          </TableCell>
                          <TableCell>
                            <EditableCell value={kpi.palier_eme} placeholder="Palier" onSave={(v) => upsert({ ...kpi, palier_eme: v })} />
                          </TableCell>
                          <TableCell>
                            <EditableCell value={kpi.objectif_eme} placeholder="Objectif" onSave={(v) => upsert({ ...kpi, objectif_eme: v })} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={kpi.taux_utilisation || 0} className="h-2 flex-1" />
                              <EditableCell
                                value={kpi.taux_utilisation?.toString()}
                                placeholder="%"
                                className="w-14"
                                onSave={(v) => upsert({ ...kpi, taux_utilisation: v ? Number(v) : null })}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <EvolutionBadge current={kpi.taux_utilisation} previous={prev?.taux_utilisation ?? null} />
                          </TableCell>
                          <TableCell className="text-center">
                            <EvolutionBadge current={kpi.taux_uhcd_backend} previous={prev?.taux_uhcd_backend ?? null} />
                          </TableCell>
                          <TableCell>
                            <EditableCell value={kpi.passages_total?.toString()} placeholder="0" onSave={(v) => upsert({ ...kpi, passages_total: v ? Number(v) : null })} />
                          </TableCell>
                          <TableCell>
                            <EditableCell value={kpi.dossiers_traites?.toString()} placeholder="0" onSave={(v) => upsert({ ...kpi, dossiers_traites: v ? Number(v) : null })} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(kpi.id)} aria-label="Supprimer">
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Ligne de moyenne */}
                    {etabKpis.length > 0 && (
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell className="text-sm">Moyenne</TableCell>
                        <TableCell className="text-sm text-center">{avgUhcdBackend}%</TableCell>
                        <TableCell className="text-sm text-center">{avgUhcdCompte}%</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={avgUtil} className="h-2 flex-1" />
                            <span className="text-sm">{avgUtil}%</span>
                          </div>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 gap-1 text-xs"
                onClick={() => upsert({
                  etablissement_id: etab.id,
                  mois: `Mois ${etabKpis.length + 1}`,
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
