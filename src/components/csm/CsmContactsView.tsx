import { useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { EditableCell } from '@/components/csm/EditableCell'
import { EditableSelectCell } from '@/components/csm/EditableSelectCell'
import { EditableCheckboxCell } from '@/components/csm/EditableCheckboxCell'
import { useProduction } from '@/hooks/production/useProduction'
import { supabase } from '@/lib/supabaseBrowser'
import { useQuery } from '@tanstack/react-query'
import { useCsmContactsMutations } from '@/hooks/csm/useCsmContactsMutations'

const INFLUENCE_OPTIONS = [
  { value: '', label: '-' },
  { value: 'Fort', label: 'Fort' },
  { value: 'Moyen', label: 'Moyen' },
  { value: 'Faible', label: 'Faible' },
]

export function CsmContactsView() {
  const { data: etablissements } = useProduction()
  const { handleUpdate, handleAdd, handleDelete } = useCsmContactsMutations()

  const etabIds = useMemo(() => (etablissements || []).map(e => e.id), [etablissements])
  const etabMap = useMemo(() => {
    const m = new Map<string, string>()
    ;(etablissements || []).forEach(e => m.set(e.id, e.nom))
    return m
  }, [etablissements])

  const { data: contacts } = useQuery({
    queryKey: ['csm-contacts-all', etabIds],
    queryFn: async () => {
      if (!etabIds.length) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id, etablissement_id, nom, prenom, email, telephone, fonction, influence, engagement, est_contact_principal, interlocuteur_csm, niveau_contact, type_contact')
        .in('etablissement_id', etabIds)
        .order('nom')
        .limit(500)
      if (error) throw error
      return data || []
    },
    enabled: etabIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  // Group by etablissement
  const grouped = useMemo(() => {
    const map = new Map<string, typeof contacts>()
    ;(contacts || []).forEach(c => {
      const key = c.etablissement_id || 'sans-compte'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    })
    // Add empty groups for etablissements with no contacts
    etabIds.forEach(id => {
      if (!map.has(id)) map.set(id, [])
    })
    return map
  }, [contacts, etabIds])

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([etabId, groupContacts]) => (
        <div key={etabId} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{etabMap.get(etabId) || 'Sans compte'}</h3>
              <span className="text-xs text-muted-foreground">({groupContacts!.length})</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => handleAdd(etabId)}
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Prénom</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="w-[60px]">CSM?</TableHead>
                  <TableHead>Influence</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupContacts!.map(contact => (
                  <TableRow key={contact.id} className="hover:bg-muted/30">
                    <TableCell>
                      <EditableCell value={contact.prenom} placeholder="Prénom" onSave={(v) => handleUpdate(contact.id, 'prenom', v)} />
                    </TableCell>
                    <TableCell>
                      <EditableCell value={contact.nom} placeholder="Nom" onSave={(v) => handleUpdate(contact.id, 'nom', v)} />
                    </TableCell>
                    <TableCell>
                      <EditableCell value={contact.fonction} placeholder="Fonction" onSave={(v) => handleUpdate(contact.id, 'fonction', v)} />
                    </TableCell>
                    <TableCell>
                      <EditableCheckboxCell
                        value={(contact as any).interlocuteur_csm || false}
                        onSave={(v) => handleUpdate(contact.id, 'interlocuteur_csm', v)}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableSelectCell
                        value={(contact as any).influence}
                        options={INFLUENCE_OPTIONS}
                        onSave={(v) => handleUpdate(contact.id, 'influence', v)}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableSelectCell
                        value={(contact as any).engagement}
                        options={INFLUENCE_OPTIONS}
                        onSave={(v) => handleUpdate(contact.id, 'engagement', v)}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell value={contact.email} placeholder="Email" onSave={(v) => handleUpdate(contact.id, 'email', v)} />
                    </TableCell>
                    <TableCell>
                      <EditableCell value={contact.telephone} placeholder="Tél." onSave={(v) => handleUpdate(contact.id, 'telephone', v)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(contact.id)} aria-label="Supprimer">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}
