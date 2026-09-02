import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { useLocation } from 'react-router-dom'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { TresorerieDashboard } from '@/components/tresorerie/TresorerieDashboard'
import { TresorerieRevenus } from '@/components/tresorerie/TresorerieRevenus'
import { TresorerieDepenses } from '@/components/tresorerie/TresorerieDepenses'
import { TresorerieBanque } from '@/components/tresorerie/TresorerieBanque'
import { TresorerieCategories } from '@/components/tresorerie/TresorerieCategories'
import { TresoreriePrevisionnelTab } from '@/components/tresorerie/TresoreriePrevisionnelTab'

import { TresorerieBudgets } from '@/components/tresorerie/TresorerieBudgets'
import { TresorerieExportButtons } from '@/components/tresorerie/TresorerieExportButtons'
import { TresorerieMobileHeader } from '@/components/tresorerie/TresorerieMobileHeader'
import { TresorerieTabsCompact } from '@/components/tresorerie/TresorerieTabsCompact'
import { useTresorerieDepenses } from '@/hooks/tresorerie/useTresorerieDepenses'
import { useTresorerieRevenus } from '@/hooks/tresorerie/useTresorerieRevenus'
import { useTresorerieBudgets } from '@/hooks/tresorerie/useTresorerieBudgets'
import { useQontoTransactions } from '@/hooks/tresorerie/useQontoTransactions'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import {
  LayoutDashboard,
  Landmark,
  Tags,
  Target,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  LineChart,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { differenceInDays, parseISO, format } from 'date-fns'

const TRESORERIE_TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    value: 'revenus',
    label: 'Revenus',
    icon: ArrowUpRight,
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-600',
  },
  {
    value: 'depenses',
    label: 'Dépenses',
    icon: ArrowDownRight,
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-600',
  },
  {
    value: 'budgets',
    label: 'Budgets',
    icon: Target,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
  },
  { value: 'banque', label: 'Qonto', icon: Landmark },
  { value: 'categories', label: 'Catégories', icon: Tags },
  { value: 'previsionnel', label: 'Prévisionnel', icon: LineChart },
]

export default function Tresorerie() {
  usePageTitle('Trésorerie')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const { depenses, isError: depensesError, refetch: refetchDepenses } = useTresorerieDepenses()
  const { revenus, isError: revenusError, refetch: refetchRevenus } = useTresorerieRevenus()
  const {
    totaux: budgetTotaux,
    isError: budgetsError,
    refetch: refetchBudgets,
  } = useTresorerieBudgets()
  const {
    transactions,
    connection,
    isError: qontoError,
    refetch: refetchQonto,
  } = useQontoTransactions({})
  const isMobile = useIsMobile()
  const location = useLocation()
  const showGlobalNav = !location.pathname.startsWith('/m/')

  const hasError = depensesError || revenusError || budgetsError || qontoError
  const refetchAll = () => {
    refetchDepenses()
    refetchRevenus()
    refetchBudgets()
    refetchQonto()
  }

  // Toast (une seule fois par cycle d'erreur) pour éviter l'écran « Chargement... » silencieux
  const errorNotifiedRef = useRef(false)
  useEffect(() => {
    if (hasError && !errorNotifiedRef.current) {
      errorNotifiedRef.current = true
      toast.error('Trésorerie : impossible de charger certaines données', {
        description: 'Vérifiez vos permissions ou votre connexion, puis réessayez.',
      })
    } else if (!hasError) {
      errorNotifiedRef.current = false
    }
  }, [hasError])

  const qontoBalance = connection?.bank_accounts?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0
  const moisCourant = format(new Date(), 'yyyy-MM')
  const budgetAlerts = budgetTotaux.nbDepasse + budgetTotaux.nbAlerte

  // Compteurs pour badges
  const depensesEnRetard = depenses.filter((d) => {
    if (d.statut === 'paye' || d.statut === 'payee') return false
    const datePrevue = parseISO(d.date_prevue)
    return differenceInDays(new Date(), datePrevue) > 0
  }).length

  const transactionsNonRapprochees = transactions.filter(
    (t) => t.type_operation === 'credit' && !t.reconcilie
  ).length

  // Calcul des revenus du mois
  const revenusMois = revenus
    .filter((r) => r.mois?.startsWith(moisCourant))
    .reduce((sum, r) => sum + (r.montant_prevu || 0), 0)

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Mobile toolbar
  const mobileToolbar = (
    <TresorerieTabsCompact
      activeTab={activeTab}
      onTabChange={setActiveTab}
      badges={{
        depensesRetard: depensesEnRetard,
        budgetsAlerte: budgetAlerts,
        qontoNonRapproches: transactionsNonRapprochees,
      }}
    />
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {/* Header conditionnel mobile/desktop */}
      {isMobile ? (
        <TresorerieMobileHeader
          stats={{
            soldeQonto: formatCurrency(qontoBalance),
            revenusMois: formatCurrency(revenusMois),
            depensesEnRetard: depensesEnRetard,
          }}
          onSearchClick={() => setShowGlobalSearch(true)}
          toolbar={mobileToolbar}
          headerActions={
            <TresorerieExportButtons
              revenus={revenus}
              depenses={depenses}
              qontoBalance={qontoBalance}
              moisCourant={moisCourant}
              compact
            />
          }
          showGlobalNav={showGlobalNav}
        />
      ) : (
        <ImmersivePageHeader
          title="Trésorerie"
          subtitle="Gérez vos revenus, dépenses et rapprochements bancaires"
          icon={Wallet}
          stats={[
            { label: 'solde Qonto', value: formatCurrency(qontoBalance), highlight: true },
            { label: 'revenus', value: formatCurrency(revenusMois) },
          ]}
          searchPlaceholder="Rechercher transactions..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={
            <TresorerieExportButtons
              revenus={revenus}
              depenses={depenses}
              qontoBalance={qontoBalance}
              moisCourant={moisCourant}
            />
          }
        >
          {/* Glassmorphism Tabs in header - using buttons since this is outside Tabs context */}
          <div className="flex gap-1 bg-card/10 backdrop-blur-sm border border-white/20 p-1 rounded-md">
            {TRESORERIE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
                  activeTab === tab.value
                    ? 'bg-card/20 text-white shadow-none'
                    : 'text-white/70 hover:bg-card/10 hover:text-white'
                }`}
              >
                {tab.iconBg ? (
                  <div className={`p-1 rounded ${tab.iconBg}`}>
                    <tab.icon className={`h-3 w-3 ${tab.iconColor}`} />
                  </div>
                ) : (
                  <tab.icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.value === 'depenses' && depensesEnRetard > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {depensesEnRetard}
                  </Badge>
                )}
                {tab.value === 'banque' && transactionsNonRapprochees > 0 && (
                  <Badge className="h-5 min-w-5 p-0 flex items-center justify-center text-xs bg-amber-500">
                    {transactionsNonRapprochees > 99 ? '99+' : transactionsNonRapprochees}
                  </Badge>
                )}
                {tab.value === 'budgets' && budgetAlerts > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {budgetAlerts}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ImmersivePageHeader>
      )}

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      {hasError && (
        <div className="mx-3 sm:mx-4 lg:mx-6 mt-4 flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">Certaines données n'ont pas pu être chargées.</p>
          <Button variant="outline" size="sm" onClick={refetchAll} className="ml-auto">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Réessayer
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsContent value="dashboard" className="mt-0">
          <TresorerieDashboard onNavigateToTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="revenus" className="mt-0">
          <TresorerieRevenus />
        </TabsContent>

        <TabsContent value="depenses" className="mt-0">
          <TresorerieDepenses />
        </TabsContent>

        <TabsContent value="budgets" className="mt-0">
          <TresorerieBudgets />
        </TabsContent>

        <TabsContent value="banque" className="mt-0">
          <TresorerieBanque />
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <TresorerieCategories />
        </TabsContent>

        <TabsContent value="previsionnel" className="mt-0">
          <TresoreriePrevisionnelTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
