import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Users, Building2, UserCheck, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { EditableCell } from '@/components/csm/EditableCell'
import { EditableSelectCell } from '@/components/csm/EditableSelectCell'
import { EditableCheckboxCell } from '@/components/csm/EditableCheckboxCell'
import { useProduction } from '@/hooks/production/useProduction'
import { useProfilesMap } from '@/hooks/profile/useProfilesMap'
import { useCsmComptesMutations } from '@/hooks/csm/useCsmComptesMutations'

const TYPE_OPTIONS = [
  { value: 'Public', label: 'Public' },
  { value: 'Privé', label: 'Privé' },
]

export function CsmComptesView() {
  const { data: etablissements } = useProduction()
  const { map: profilesMap } = useProfilesMap()
  const { handleUpdate, handleAdd, handleDelete } = useCsmComptesMutations()

  const stats = useMemo(() => {
    const total = etablissements?.length || 0
    const clients = etablissements?.filter(e => e.statut === 'Production').length || 0
    const actionsEnAttente = etablissements?.filter(e => (e as any).prochaine_action_csm).length || 0
    return { total, clients, actionsEnAttente }
  }, [etablissements])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Building2, label: 'Total comptes', value: stats.total },
          { icon: UserCheck, label: 'Clients actifs', value: stats.clients },
          { icon: Users, label: 'Propriétaire Charlotte', value: etablissements?.filter(e => {
            const name = e.csm_id ? profilesMap.get(e.csm_id)?.full_name : ''
            return name?.toLowerCase().includes('charlotte')
          }).length || 0 },
          { icon: ClipboardList, label: 'Actions en attente', value: stats.actionsEnAttente },
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

      <div className="flex justify-end">
        <Button size="sm" className="gap-1" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
          Ajouter un compte
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[180px] sticky left-0 bg-muted/50 z-10">Compte</TableHead>
              <TableHead className="min-w-[80px]">Région</TableHead>
              <TableHead className="min-w-[100px]">Type</TableHead>
              <TableHead className="min-w-[60px]">Client</TableHead>
              <TableHead className="min-w-[110px]">Date signature</TableHead>
              <TableHead className="min-w-[100px]">DPI</TableHead>
              <TableHead className="min-w-[120px]">Propriétaire</TableHead>
              <TableHead className="min-w-[120px]">Dernière venue</TableHead>
              <TableHead className="min-w-[200px]">Contexte</TableHead>
              <TableHead className="min-w-[200px]">Besoins</TableHead>
              <TableHead className="min-w-[180px]">Action Orga</TableHead>
              <TableHead className="min-w-[100px]">Date</TableHead>
              <TableHead className="min-w-[180px]">Action CSM</TableHead>
              <TableHead className="min-w-[100px]">Date</TableHead>
              <TableHead className="min-w-[200px]">Point hebdo</TableHead>
              <TableHead className="min-w-[150px]">Modules</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(etablissements || []).map(etab => {
              const e = etab as any
              return (
                <TableRow key={etab.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm sticky left-0 bg-background z-10">{etab.nom}</TableCell>
                  <TableCell className="text-sm">{etab.region || '-'}</TableCell>
                  <TableCell>
                    <EditableSelectCell
                      value={(etab as any).type_etablissement}
                      options={TYPE_OPTIONS}
                      onSave={(v) => handleUpdate(etab.id, 'type_etablissement', v)}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCheckboxCell
                      value={etab.statut === 'Production'}
                      onSave={(v) => handleUpdate(etab.id, 'statut', v ? 'Production' : 'Prospect')}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={etab.date_signature} placeholder="Date..." onSave={(v) => handleUpdate(etab.id, 'date_signature', v)} />
                  </TableCell>
                  <TableCell className="text-sm">{etab.dpi || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {etab.csm_id ? profilesMap.get(etab.csm_id)?.full_name || '-' : '-'}
                  </TableCell>
                  <TableCell>
                    <EditableCell value={e.derniere_venue_site} placeholder="Dernière venue..." onSave={(v) => handleUpdate(etab.id, 'derniere_venue_site', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={e.contexte_csm} placeholder="Contexte..." onSave={(v) => handleUpdate(etab.id, 'contexte_csm', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={e.besoins_du_compte} placeholder="Besoins..." onSave={(v) => handleUpdate(etab.id, 'besoins_du_compte', v)} />
                  </TableCell>
                   <TableCell>
                    <EditableCell 
                      value={Array.isArray(e.prochaine_action_orga) ? e.prochaine_action_orga.map((a: any) => a.text + (a.date ? ` (${a.date})` : '')).join(', ') : ''} 
                      placeholder="Action orga..." 
                      onSave={(v) => {
                        if (!v) { handleUpdate(etab.id, 'prochaine_action_orga', null); return; }
                        const items = v.split(',').map((s: string) => s.trim()).filter(Boolean).map((t: string) => ({ text: t, date: null }));
                        handleUpdate(etab.id, 'prochaine_action_orga', items);
                      }} 
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={e.date_action_orga} placeholder="Date..." onSave={(v) => handleUpdate(etab.id, 'date_action_orga', v)} />
                  </TableCell>
                   <TableCell>
                    <EditableCell 
                      value={Array.isArray(e.prochaine_action_csm) ? e.prochaine_action_csm.map((a: any) => a.text + (a.date ? ` (${a.date})` : '')).join(', ') : ''} 
                      placeholder="Action CSM..." 
                      onSave={(v) => {
                        if (!v) { handleUpdate(etab.id, 'prochaine_action_csm', null); return; }
                        const items = v.split(',').map((s: string) => s.trim()).filter(Boolean).map((t: string) => ({ text: t, date: null }));
                        handleUpdate(etab.id, 'prochaine_action_csm', items);
                      }} 
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={e.date_action_csm} placeholder="Date..." onSave={(v) => handleUpdate(etab.id, 'date_action_csm', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={e.point_hebdo} placeholder="Point hebdo..." onSave={(v) => handleUpdate(etab.id, 'point_hebdo', v)} />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={(e.modules_actifs || []).join(', ')}
                      placeholder="Modules..."
                      onSave={(v) => handleUpdate(etab.id, 'modules_actifs', v ? v.split(',').map((s: string) => s.trim()).filter(Boolean) : null)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(etab.id, etab.nom)} aria-label="Supprimer">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
