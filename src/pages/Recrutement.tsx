import { useState, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  Plus,
  Search,
  Briefcase,
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  LayoutDashboard,
  Kanban,
  FileUser,
  RefreshCw,
} from 'lucide-react'
import { useJobOffers, useJobOffersKPIs } from '@/hooks/recrutement/useJobOffers'
import { useCandidates } from '@/hooks/recrutement/useCandidates'
import {
  CONTRACT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS,
} from '@/types/recrutement'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

// Lazy load pipeline
const CandidatePipeline = lazy(() => import('@/components/recrutement/CandidatePipeline'))
const JobOfferFormDialog = lazy(() => import('@/components/recrutement/JobOfferFormDialog'))

const RECRUTEMENT_TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'border-primary' },
  { value: 'offers', label: 'Offres', icon: Briefcase, color: 'border-blue-500' },
  { value: 'candidates', label: 'Candidats', icon: Users, color: 'border-purple-500' },
  { value: 'pipeline', label: 'Pipeline', icon: Kanban, color: 'border-amber-500' },
]

const LoadingFallback = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
)

const DataError = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
    <AlertCircle className="h-6 w-6" />
    <p>{sanitizeSupabaseError(error)}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Réessayer
      </Button>
    )}
  </div>
)

export default function Recrutement() {
  return (
    <ErrorBoundary>
      <RecrutementContent />
    </ErrorBoundary>
  )
}

function RecrutementContent() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [showOfferDialog, setShowOfferDialog] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const isMobile = useIsMobile()

  const {
    data: kpis,
    error: kpisError,
    isError: kpisIsError,
    refetch: refetchKpis,
  } = useJobOffersKPIs()
  const {
    data: offers = [],
    isLoading: offersLoading,
    error: offersError,
    isError: offersIsError,
    refetch: refetchOffers,
  } = useJobOffers({ search })
  const {
    data: candidates = [],
    isLoading: candidatesLoading,
    error: candidatesError,
    isError: candidatesIsError,
    refetch: refetchCandidates,
  } = useCandidates({ search })

  const recrutementError = offersError || candidatesError || kpisError
  const hasRecrutementError = offersIsError || candidatesIsError || kpisIsError
  const handleRetry = () => {
    refetchKpis()
    refetchOffers()
    refetchCandidates()
  }

  const kpiCards = [
    { label: 'Offres actives', value: kpis?.activeOffers || 0, icon: Briefcase, color: 'blue' },
    { label: 'Candidatures', value: kpis?.totalCandidates || 0, icon: Users, color: 'purple' },
    { label: 'Nouvelles', value: kpis?.newCandidates || 0, icon: Clock, color: 'amber' },
    { label: 'Recrutés', value: kpis?.hiredCandidates || 0, icon: UserCheck, color: 'emerald' },
    { label: 'En cours', value: kpis?.inProgress || 0, icon: TrendingUp, color: 'indigo' },
  ]

  const getColorClasses = (color: string) => ({
    border: `border-l-${color}-500`,
    icon: `text-${color}-600`,
    bg: `bg-${color}-500/10`,
    glow: `bg-${color}-500/30`,
  })

  const headerStats = [
    { label: 'offres actives', value: kpis?.activeOffers || 0, highlight: true },
    { label: 'candidats', value: kpis?.totalCandidates || 0 },
  ]

  const headerActions = (
    <Button
      onClick={() => setShowOfferDialog(true)}
      size="sm"
      className="h-9 rounded-xl bg-card text-primary hover:bg-card/90 shadow-md transition-all"
    >
      <Plus className="h-4 w-4 mr-2" />
      <span className="hidden sm:inline">Nouvelle offre</span>
      <span className="sm:hidden">Nouvelle</span>
    </Button>
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      <ImmersivePageHeader
        title="Recrutement"
        subtitle="Gérez vos offres d'emploi et candidatures"
        icon={FileUser}
        stats={headerStats}
        searchPlaceholder="Rechercher..."
        onSearchClick={() => setShowSearch(true)}
        actions={headerActions}
      >
        {/* Tabs in header - Pure HTML buttons (no Radix context needed) */}
        {!isMobile && (
          <div className="h-12 p-1 bg-card/10 backdrop-blur-sm border border-white/20 shadow-lg rounded-xl inline-flex gap-1">
            {RECRUTEMENT_TABS.map((tab) => {
              const isActive = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center gap-2 px-4 h-10 rounded-lg transition-all ${
                    isActive
                      ? 'bg-card text-primary shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-card/10'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {tab.value === 'offers' && offers.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 px-1.5 text-xs bg-card/20 text-white border-0"
                    >
                      {offers.length}
                    </Badge>
                  )}
                  {tab.value === 'candidates' && candidates.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 px-1.5 text-xs bg-card/20 text-white border-0"
                    >
                      {candidates.length}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </ImmersivePageHeader>

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-6">
        {/* KPIs - Premium Glassmorphism */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {kpiCards.map((kpi) => (
            <Card
              key={kpi.label}
              className={`bg-card/80 backdrop-blur-sm shadow-lg border-l-4 border-l-${kpi.color}-500 border-t-0 border-r-0 border-b-0 border-primary/5 hover:shadow-xl transition-all`}
            >
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="relative">
                    <div
                      className={`absolute inset-0 bg-${kpi.color}-500/30 rounded-full blur-lg opacity-50`}
                    />
                    <div
                      className={`relative h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-${kpi.color}-500/20 to-${kpi.color}-500/5 flex items-center justify-center ring-2 ring-${kpi.color}-500/20`}
                    >
                      <kpi.icon className={`h-5 w-5 md:h-6 md:w-6 text-${kpi.color}-600`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl md:text-2xl font-bold">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile: Select dropdown */}
          {isMobile && (
            <div className="flex flex-col gap-4 mb-4">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full h-12 rounded-xl bg-card/80 backdrop-blur-sm border-primary/10 shadow-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-lg">
                  {RECRUTEMENT_TABS.map((tab) => (
                    <SelectItem key={tab.value} value={tab.value} className="rounded-lg">
                      <div className="flex items-center gap-2">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search for non-pipeline tabs */}
          {activeTab !== 'pipeline' && (
            <div className="relative w-full md:w-64 mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-card/80 backdrop-blur-sm border-primary/10"
              />
            </div>
          )}

          {hasRecrutementError && (
            <Alert variant="destructive" className="mb-4 bg-card/90 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Chargement du recrutement impossible</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{sanitizeSupabaseError(recrutementError)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="w-full gap-2 sm:w-auto"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <TabsContent value="dashboard" className="space-y-4 mt-0">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-blue-500 border-primary/5 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Offres récentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {offersLoading ? (
                    <p className="text-muted-foreground">Chargement...</p>
                  ) : offersIsError ? (
                    <DataError error={offersError} onRetry={() => refetchOffers()} />
                  ) : offers.length === 0 ? (
                    <p className="text-muted-foreground">Aucune offre</p>
                  ) : (
                    offers.slice(0, 5).map((offer) => (
                      <div
                        key={offer.id}
                        className="flex items-center justify-between p-3 border border-primary/10 rounded-xl hover:bg-primary/5 transition-colors"
                      >
                        <div>
                          <p className="font-medium">{offer.titre}</p>
                          <p className="text-sm text-muted-foreground">
                            {CONTRACT_TYPE_LABELS[offer.type_contrat]} •{' '}
                            {offer.localisation || 'Non défini'}
                          </p>
                        </div>
                        <Badge
                          variant={offer.statut === 'published' ? 'default' : 'secondary'}
                          className="rounded-lg"
                        >
                          {JOB_STATUS_LABELS[offer.statut]}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-purple-500 border-primary/5 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Candidatures récentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {candidatesLoading ? (
                    <p className="text-muted-foreground">Chargement...</p>
                  ) : candidatesIsError ? (
                    <DataError error={candidatesError} onRetry={() => refetchCandidates()} />
                  ) : candidates.length === 0 ? (
                    <p className="text-muted-foreground">Aucun candidat</p>
                  ) : (
                    candidates.slice(0, 5).map((candidate) => (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between p-3 border border-primary/10 rounded-xl hover:bg-primary/5 transition-colors"
                      >
                        <div>
                          <p className="font-medium">
                            {candidate.prenom} {candidate.nom}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(candidate.date_candidature), 'dd MMM yyyy', {
                              locale: fr,
                            })}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-lg">
                          {CANDIDATE_STATUS_LABELS[candidate.statut]}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="offers" className="mt-0">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/5 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Offres d'emploi</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowOfferDialog(true)}
                  className="h-9 rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une offre
                </Button>
              </CardHeader>
              <CardContent>
                {offersLoading ? (
                  <p>Chargement des offres...</p>
                ) : offersIsError ? (
                  <DataError error={offersError} onRetry={() => refetchOffers()} />
                ) : offers.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Aucune offre d'emploi</p>
                    <p className="text-muted-foreground mb-4">
                      Créez votre première offre pour démarrer
                    </p>
                    <Button onClick={() => setShowOfferDialog(true)} className="rounded-xl">
                      <Plus className="h-4 w-4 mr-2" />
                      Créer une offre
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="flex items-center justify-between p-4 border border-primary/10 rounded-xl hover:bg-primary/5 cursor-pointer transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{offer.titre}</p>
                          <p className="text-sm text-muted-foreground">
                            {CONTRACT_TYPE_LABELS[offer.type_contrat]} •{' '}
                            {offer.departement || 'Non défini'} • {offer.localisation || 'Remote'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge
                            variant={offer.statut === 'published' ? 'default' : 'secondary'}
                            className="rounded-lg"
                          >
                            {JOB_STATUS_LABELS[offer.statut]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="candidates" className="mt-0">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/5 shadow-lg">
              <CardContent className="p-6">
                {candidatesLoading ? (
                  <p>Chargement des candidats...</p>
                ) : candidatesIsError ? (
                  <DataError error={candidatesError} onRetry={() => refetchCandidates()} />
                ) : candidates.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Aucun candidat</p>
                    <p className="text-muted-foreground">Les candidatures apparaîtront ici</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between p-4 border border-primary/10 rounded-xl hover:bg-primary/5 cursor-pointer transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {candidate.prenom} {candidate.nom}
                          </p>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {candidate.note_globale && (
                            <span className="text-sm font-medium">{candidate.note_globale}/5</span>
                          )}
                          <Badge variant="outline" className="rounded-lg">
                            {CANDIDATE_STATUS_LABELS[candidate.statut]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-0">
            <Suspense fallback={<LoadingFallback />}>
              <CandidatePipeline />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      <GlobalSearchDialog open={showSearch} setOpen={setShowSearch} hideTrigger />

      {/* Modal "Nouvelle offre" — fix audit run-full-20260618-010843 P2 */}
      {showOfferDialog && (
        <Suspense fallback={null}>
          <JobOfferFormDialog open={showOfferDialog} onOpenChange={setShowOfferDialog} />
        </Suspense>
      )}
    </div>
  )
}
