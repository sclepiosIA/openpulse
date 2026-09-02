import { useState } from 'react'
import { Share2, Settings, RefreshCw, Loader2, Inbox, Calendar, PenSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageDataState } from '@/components/shared/PageDataState'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { useRolePermissions } from '@/hooks/auth/useRolePermissions'
import { useSocialBrands } from '@/hooks/social/useSocialBrands'
import { useSocialConnections } from '@/hooks/social/useSocialConnections'
import { useSocialKpis } from '@/hooks/social/useSocialKpis'
import { BrandCard } from '@/components/social/BrandCard'
import { SocialKpiGrid } from '@/components/social/SocialKpiGrid'
import { SocialFeedTimeline } from '@/components/social/SocialFeedTimeline'
import { syncSocialBrand } from '@/services/social/socialEdge'
import { toast } from 'sonner'

export default function SocialDashboard() {
  usePageTitle('Social Dashboard')
  const perms = useRolePermissions()

  const allowed = ['admin', 'direction', 'copil', 'commercial', 'marketing'].includes(
    perms.role ?? ''
  )

  const brandsQ = useSocialBrands()
  const connsQ = useSocialConnections()
  const [activeBrand, setActiveBrand] = useState<string | undefined>(undefined)
  const { kpis, isLoading: kpisLoading, refetch: refetchKpis } = useSocialKpis(activeBrand)
  const [syncing, setSyncing] = useState(false)

  const isLoading = perms.isLoading || brandsQ.isLoading || connsQ.isLoading
  const isError = brandsQ.isError || connsQ.isError
  const isEmpty = !isLoading && !isError && (brandsQ.data?.length ?? 0) === 0

  const handleSync = async () => {
    setSyncing(true)
    try {
      const r = await syncSocialBrand(activeBrand || undefined)
      toast.success(`Synchronisation terminée — ${r?.connections ?? 0} connexion(s)`)
      refetchKpis()
      connsQ.refetch()
    } catch (e: any) {
      toast.error(e?.message || 'Synchronisation impossible')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Social Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Pilotage des réseaux sociaux pour les équipes commerciale et marketing.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Synchroniser
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/social/composer">
              <PenSquare className="h-4 w-4 mr-2" />
              Composer
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/social/calendrier">
              <Calendar className="h-4 w-4 mr-2" />
              Calendrier
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/social/inbox">
              <Inbox className="h-4 w-4 mr-2" />
              Inbox
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/parametres/social">
              <Settings className="h-4 w-4 mr-2" />
              Connexions
            </Link>
          </Button>
        </div>
      </header>

      <PageDataState
        isLoading={isLoading}
        isError={!allowed || isError}
        error={
          !allowed
            ? new Error('Accès réservé aux équipes commerciale, marketing et direction.')
            : brandsQ.error || connsQ.error
        }
        isEmpty={isEmpty}
        emptyTitle="Aucune marque configurée"
        emptyDescription="Contactez la direction pour ajouter une marque sociale."
        loadingLabel="Chargement des marques…"
        onRetry={() => {
          brandsQ.refetch()
          connsQ.refetch()
        }}
      >
        <div className="space-y-6">
          <Tabs
            value={activeBrand ?? 'all'}
            onValueChange={(v) => setActiveBrand(v === 'all' ? undefined : v)}
          >
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">Toutes les marques</TabsTrigger>
              {(brandsQ.data ?? []).map((b) => (
                <TabsTrigger key={b.id} value={b.id} className="gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: b.color_hex || '#6366f1' }}
                  />
                  {b.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <SocialKpiGrid kpis={kpis} />

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2 space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Posts récents</h2>
              {kpisLoading ? (
                <div className="text-sm text-muted-foreground">Chargement…</div>
              ) : (
                <SocialFeedTimeline posts={kpis.recent} />
              )}
            </section>

            <aside className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Marques & connexions</h2>
              <div className="grid gap-3">
                {(brandsQ.data ?? []).map((brand) => (
                  <BrandCard
                    key={brand.id}
                    brand={brand}
                    connections={(connsQ.data ?? []).filter((c) => c.brand_id === brand.id)}
                  />
                ))}
              </div>
            </aside>
          </div>
        </div>
      </PageDataState>
    </div>
  )
}
