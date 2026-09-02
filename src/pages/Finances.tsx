import { useState } from 'react'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { FinancesDashboard } from '@/components/finances/FinancesDashboard'
import { FinancesPnL } from '@/components/finances/FinancesPnL'
import { FinancesRevenus } from '@/components/finances/FinancesRevenus'
import { FinancesDepenses } from '@/components/finances/FinancesDepenses'
import { TresorerieBanque } from '@/components/tresorerie/TresorerieBanque'
import { useMRRData } from '@/hooks/analytics/useMRRData'
import { useQontoTransactions } from '@/hooks/tresorerie/useQontoTransactions'
import {
  Landmark,
  LayoutDashboard,
  Sigma,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react'

const FINANCES_TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'tresorerie', label: 'Trésorerie', icon: Wallet },
  { value: 'pnl', label: 'P&L', icon: Sigma },
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
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)

export default function Finances() {
  usePageTitle('Finances')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  const mrr = useMRRData()
  const { connection } = useQontoTransactions({})
  const soldeTresorerie =
    connection?.bank_accounts?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0

  return (
    <div className="min-h-dvh bg-gradient-page">
      <ImmersivePageHeader
        title="Finances"
        subtitle="Pilotage financier : indicateurs, P&L, revenus, dépenses et trésorerie"
        icon={Landmark}
        stats={[
          { label: 'solde tréso', value: formatCurrency(soldeTresorerie), highlight: true },
          { label: 'MRR', value: formatCurrency(mrr.currentMRR) },
        ]}
        searchPlaceholder="Rechercher..."
        onSearchClick={() => setShowGlobalSearch(true)}
      >
        {/* Glassmorphism Tabs in header - buttons car hors du contexte Tabs */}
        <div className="flex gap-1 bg-card/10 backdrop-blur-sm border border-white/20 p-1 rounded-md overflow-x-auto max-w-full">
          {FINANCES_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
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
            </button>
          ))}
        </div>
      </ImmersivePageHeader>

      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsContent value="dashboard" className="mt-0">
          <FinancesDashboard onNavigateTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="tresorerie" className="mt-0">
          <TresorerieBanque />
        </TabsContent>

        <TabsContent value="pnl" className="mt-0">
          <FinancesPnL />
        </TabsContent>

        <TabsContent value="revenus" className="mt-0">
          <FinancesRevenus />
        </TabsContent>

        <TabsContent value="depenses" className="mt-0">
          <FinancesDepenses />
        </TabsContent>
      </Tabs>
    </div>
  )
}
