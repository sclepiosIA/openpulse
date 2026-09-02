import { useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EditableCell } from '@/components/csm/EditableCell'
import { EditableSelectCell } from '@/components/csm/EditableSelectCell'
import { useCsmFacturation } from '@/hooks/csm/useCsmFacturation'
import { useProduction } from '@/hooks/production/useProduction'
import { cn } from '@/lib/utils'

const MODELE_OPTIONS = [
  { value: 'Statique', label: 'Statique' },
  { value: 'Succes +3', label: 'Succès +3' },
  { value: 'Succes +6', label: 'Succès +6' },
  { value: 'Succes +12', label: 'Succès +12' },
]

const FACTURATION_OPTIONS = [
  { value: 'OUI', label: 'OUI' },
  { value: 'NON - En cours', label: 'NON - En cours' },
  { value: 'NA', label: 'NA' },
]

const FACTURATION_BADGE_STYLE: Record<string, string> = {
  'OUI': 'bg-emerald-100 text-emerald-700',
  'NON - En cours': 'bg-amber-100 text-amber-700',
  'NA': 'bg-gray-100 text-muted-foreground',
}

export function CsmFacturationView() {
  const { data: etablissements } = useProduction()
  const { data: facturations, upsert } = useCsmFacturation()

  const factMap = useMemo(() => {
    const map = new Map<string, typeof facturations[0]>()
    facturations.forEach(f => map.set(f.etablissement_id, f))
    return map
  }, [facturations])

  const handleUpdate = (etabId: string, field: string, value: string) => {
    const existing = factMap.get(etabId) || {}
    upsert({ ...existing, etablissement_id: etabId, [field]: value || null })
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[180px] sticky left-0 bg-muted/50 z-10">Compte</TableHead>
            <TableHead className="min-w-[80px]">Type</TableHead>
            <TableHead className="min-w-[110px]">Signature</TableHead>
            <TableHead className="min-w-[110px]">Déploiement</TableHead>
            <TableHead className="min-w-[120px]">Modèle</TableHead>
            <TableHead className="min-w-[110px]">Début période</TableHead>
            <TableHead className="min-w-[110px]">Fin période</TableHead>
            <TableHead className="min-w-[110px]">Dernière relance</TableHead>
            <TableHead className="min-w-[130px]">Facturation</TableHead>
            <TableHead className="min-w-[200px]">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(etablissements || []).map(etab => {
            const fact = factMap.get(etab.id)
            const factStatus = fact?.facturation_effectuee || 'NA'
            return (
              <TableRow key={etab.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm sticky left-0 bg-background z-10">{etab.nom}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {(etab as any).type_etablissement || '-'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{etab.date_signature || '-'}</TableCell>
                <TableCell>
                  <EditableCell
                    value={fact?.date_deploiement}
                    placeholder="Date..."
                    onSave={(v) => handleUpdate(etab.id, 'date_deploiement', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableSelectCell
                    value={fact?.modele_facturation}
                    options={MODELE_OPTIONS}
                    onSave={(v) => handleUpdate(etab.id, 'modele_facturation', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={fact?.date_debut_periode}
                    placeholder="Date..."
                    onSave={(v) => handleUpdate(etab.id, 'date_debut_periode', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={fact?.date_fin_periode}
                    placeholder="Date..."
                    onSave={(v) => handleUpdate(etab.id, 'date_fin_periode', v)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={fact?.derniere_relance}
                    placeholder="Date..."
                    onSave={(v) => handleUpdate(etab.id, 'derniere_relance', v)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <EditableSelectCell
                      value={factStatus}
                      options={FACTURATION_OPTIONS}
                      onSave={(v) => handleUpdate(etab.id, 'facturation_effectuee', v)}
                    />
                    <Badge className={cn("text-xs whitespace-nowrap", FACTURATION_BADGE_STYLE[factStatus] || FACTURATION_BADGE_STYLE['NA'])}>
                      {factStatus}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={fact?.notes}
                    placeholder="Notes..."
                    onSave={(v) => handleUpdate(etab.id, 'notes', v)}
                    multiline
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}