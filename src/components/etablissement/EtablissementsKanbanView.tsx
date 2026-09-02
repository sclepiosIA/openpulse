import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Building2, MapPin, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { useUpdateEtablissement } from '@/hooks/crm/useEtablissements'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface EtablissementsKanbanViewProps {
  etablissements: Etablissement[]
}

import { FALLBACK_KANBAN_STATUTS } from "@/config/referenceDataDefaults"
import { useStatutsEtablissement } from "@/hooks/system/useReferenceData"

export function EtablissementsKanbanView({ etablissements }: EtablissementsKanbanViewProps) {
  const { data: statutsRef } = useStatutsEtablissement()
  const STATUTS = statutsRef.length > 0
    ? statutsRef.map(s => ({
        key: s.code || s.label,
        label: s.label,
        color: s.color ? `bg-${s.color}` : 'bg-slate-500',
      }))
    : [...FALLBACK_KANBAN_STATUTS]
  const navigate = useNavigate()
  const updateEtab = useUpdateEtablissement()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const etablissementsByStatut = useMemo(() => {
    const grouped: Record<string, Etablissement[]> = {}
    STATUTS.forEach(statut => {
      grouped[statut.key] = etablissements.filter(e => e.statut === statut.key)
    })
    return grouped
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etablissements, statutsRef])

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== columnKey) setDragOverColumn(columnKey)
  }

  const handleDrop = async (e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggedId
    setDragOverColumn(null)
    setDraggedId(null)
    if (!id) return
    const current = etablissements.find(x => x.id === id)
    if (!current || current.statut === columnKey) return
    setSavingId(id)
    try {
      await updateEtab.mutateAsync({ id, data: { statut: columnKey as Etablissement['statut'] } })
      toast.success(`Statut mis à jour : ${columnKey}`)
    } catch {
      toast.error('Échec de la mise à jour du statut')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 px-2 sm:px-0">
        {STATUTS.map(statut => {
          const isOver = dragOverColumn === statut.key
          return (
            <Card
              key={statut.key}
              className={cn(
                'flex-shrink-0 w-80 sm:w-72 md:w-80 lg:w-96 transition-colors',
                isOver && 'ring-2 ring-primary bg-primary/5',
              )}
              onDragOver={(e) => handleDragOver(e, statut.key)}
              onDragLeave={() => setDragOverColumn(prev => (prev === statut.key ? null : prev))}
              onDrop={(e) => handleDrop(e, statut.key)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statut.color}`} />
                    <span className="truncate">{statut.label}</span>
                  </CardTitle>
                  <Badge variant="secondary">
                    {etablissementsByStatut[statut.key]?.length || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-280px)]">
                  {etablissementsByStatut[statut.key]?.length === 0 ? (
                    <div className={cn(
                      'text-center text-sm text-muted-foreground py-8 border-2 border-dashed rounded-md',
                      isOver ? 'border-primary text-primary' : 'border-transparent',
                    )}>
                      {isOver ? 'Déposer ici' : 'Aucun établissement'}
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {etablissementsByStatut[statut.key]?.map((etab) => {
                        const isDragging = draggedId === etab.id
                        const isSaving = savingId === etab.id
                        return (
                          <Card
                            key={etab.id}
                            draggable={!isSaving}
                            onDragStart={(e) => handleDragStart(e, etab.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              'cursor-pointer hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isDragging && 'opacity-40 rotate-1',
                              isSaving && 'opacity-60 pointer-events-none',
                            )}
                            onClick={() => navigate(`/etablissements/${etab.id}`)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Ouvrir la fiche établissement ${etab.nom}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                navigate(`/etablissements/${etab.id}`)
                              }
                            }}
                          >
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-sm line-clamp-2 break-words overflow-hidden">{etab.nom}</h4>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 min-w-0">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate block">{etab.ville}</span>
                                  </div>
                                </div>
                                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                              </div>

                              {etab.progression !== null && etab.progression !== undefined && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Progression</span>
                                    <span className="font-medium">{etab.progression}%</span>
                                  </div>
                                  <Progress value={etab.progression} className="h-1.5" />
                                </div>
                              )}

                              {etab.dpi && (
                                <Badge variant="outline" className="text-xs max-w-full truncate block">
                                  {etab.dpi}
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
