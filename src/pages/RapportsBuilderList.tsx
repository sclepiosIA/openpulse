import { useNavigate } from 'react-router-dom'
import {
  useCustomDashboards,
  useCreateDashboard,
  useDeleteDashboard,
  useDuplicateDashboard,
} from '@/hooks/dashboard/useCustomDashboards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart3, Plus, Copy, Trash2, Eye, Pencil, Sparkles, Search } from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { PageDataState } from '@/components/common/PageDataState'

export default function RapportsBuilderList() {
  usePageTitle('Rapports personnalisés')
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useCustomDashboards()
  const create = useCreateDashboard()
  const dup = useDuplicateDashboard()
  const del = useDeleteDashboard()
  const [openNew, setOpenNew] = useState(false)
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')

  const { owned, templates } = useMemo(() => {
    const list = data || []
    const q = search.trim().toLowerCase()
    const match = (d: (typeof list)[number]) =>
      !q || d.nom.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
    return {
      owned: list.filter((d) => !d.is_template && match(d)),
      templates: list.filter((d) => d.is_template && match(d)),
    }
  }, [data, search])

  const handleCreate = async () => {
    if (!nom.trim()) return
    const created = await create.mutateAsync({ nom, description })
    setOpenNew(false)
    setNom('')
    setDescription('')
    navigate(`/rapports-custom/${created.id}/edit`)
  }

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={BarChart3}
        title="Rapports personnalisés"
        subtitle="Créez vos propres tableaux de bord à partir des données OpenPulse"
        stats={
          data
            ? [
                {
                  label: 'rapports',
                  value: (data || []).filter((d) => !d.is_template).length,
                  highlight: true,
                },
                { label: 'modèles', value: (data || []).filter((d) => d.is_template).length },
              ]
            : undefined
        }
        actions={
          <Button
            onClick={() => setOpenNew(true)}
            size="sm"
            className="bg-card text-primary hover:bg-card/90"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nouveau rapport</span>
          </Button>
        }
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <PageDataState isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un rapport…"
              className="pl-9 h-9"
            />
          </div>

          {templates.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h2 className="text-lg font-semibold">Modèles pré-configurés</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <Card key={t.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        {t.nom}
                      </CardTitle>
                      {t.description && (
                        <CardDescription className="text-xs">{t.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/rapports-custom/${t.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Aperçu
                      </Button>
                      <Button size="sm" onClick={() => dup.mutate(t)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Utiliser
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold mb-3">Mes rapports ({owned.length})</h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : owned.length === 0 ? (
              <Card className="p-8 text-center">
                <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Aucun rapport pour le moment</p>
                <Button onClick={() => setOpenNew(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer mon premier rapport
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {owned.map((d) => (
                  <Card key={d.id} className="hover:shadow-md transition-shadow group">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{d.nom}</CardTitle>
                          {d.description && (
                            <CardDescription className="text-xs line-clamp-2 mt-1">
                              {d.description}
                            </CardDescription>
                          )}
                        </div>
                        {d.is_shared && (
                          <Badge variant="secondary" className="text-[10px]">
                            Partagé
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[11px] text-muted-foreground mb-3">
                        {d.widgets.length} widget{d.widgets.length > 1 ? 's' : ''} · MAJ{' '}
                        {format(new Date(d.updated_at), 'dd MMM', { locale: fr })}
                      </p>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => navigate(`/rapports-custom/${d.id}`)}
                          aria-label="Voir"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => navigate(`/rapports-custom/${d.id}/edit`)}
                          aria-label="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => dup.mutate(d)}
                          aria-label="Copier"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm(`Supprimer "${d.nom}" ?`)) del.mutate(d.id)
                          }}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </PageDataState>
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau rapport</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Pipeline mensuel direction"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={!nom.trim() || create.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ImmersivePageBackground>
  )
}
