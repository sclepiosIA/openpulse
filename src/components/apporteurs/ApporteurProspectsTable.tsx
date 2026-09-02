import { useCallback, useState } from 'react'
import { useProspectStats } from '@/hooks/crm/useProspects'
import { useDeleteEtablissement, type Etablissement } from '@/hooks/crm/useEtablissements'
import { ProspectsTableView } from '@/components/prospects/ProspectsTableView'
import { EtablissementEditForm } from '@/components/etablissement/EtablissementEditForm'
import { CRMEmptyState } from '@/components/layout/CRMEmptyState'
import { Target } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useApporteurProspects } from './useApporteurProspects'

interface ApporteurProspectsTableProps {
  /** UUID du partenaire (apporteur) — sert à filtrer les établissements */
  partenaireId?: string
}

export function ApporteurProspectsTable({ partenaireId }: ApporteurProspectsTableProps) {
  const { prospects: filtered, isLoading } = useApporteurProspects(partenaireId)
  const { data: stats } = useProspectStats()
  const deleteEtablissement = useDeleteEtablissement()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Etablissement | null>(null)

  const getProgressInfo = useCallback(
    (prospectId: string) => {
      if (!stats) return { progress: 0, totalTasks: 0, completedTasks: 0, potentialValue: 0 }
      const s = stats.prospectsPipelineProgress.find((p) => p.id === prospectId)
      return s || { progress: 0, totalTasks: 0, completedTasks: 0, potentialValue: 0 }
    },
    [stats]
  )

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? new Set(filtered.map((p) => p.id)) : new Set())
  }

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce prospect ?')) deleteEtablissement.mutate(id)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <CRMEmptyState
        icon={Target}
        title="Aucun prospect ciblé"
        description="Cet apporteur d'affaires n'a pas encore de prospect associé."
      />
    )
  }

  return (
    <>
      <ProspectsTableView
        prospects={filtered}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        getProgressInfo={getProgressInfo}
        onEdit={(p) => setEditing(p)}
        onDelete={handleDelete}
      />
      {editing && (
        <EtablissementEditForm
          etablissement={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
        />
      )}
    </>
  )
}
