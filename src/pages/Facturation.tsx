import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FacturationDashboard } from '@/components/facturation/FacturationDashboard'
import { DevisList } from '@/components/facturation/DevisList'
import { FacturesList } from '@/components/facturation/FacturesList'
import { CatalogueProduits } from '@/components/facturation/CatalogueProduits'
import { FacturationEcheances } from '@/components/facturation/FacturationEcheances'
import { FacturationQontoReconciliation } from '@/components/facturation/FacturationQontoReconciliation'
import { DevisFormDialog } from '@/components/facturation/DevisFormDialog'
import { FactureFormDialog } from '@/components/facturation/FactureFormDialog'
import { useDevis } from '@/hooks/contracts/useDevis'
import { useFactures } from '@/hooks/billing/useFactures'
import {
  useEcheancesFacturation,
  EcheanceFacturation,
} from '@/hooks/billing/useFacturationEtablissement'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Package,
  Plus,
  FileCheck,
  CalendarClock,
  Landmark,
} from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { FacturationMobileHeader } from '@/components/facturation/FacturationMobileHeader'
import { FacturationTabsCompact } from '@/components/facturation/FacturationTabsCompact'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { toast } from 'sonner'

const FACTURATION_TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'border-primary' },
  { value: 'echeances', label: 'Échéances', icon: CalendarClock, color: 'border-amber-500' },
  { value: 'devis', label: 'Devis', icon: FileText, color: 'border-blue-500' },
  { value: 'factures', label: 'Factures', icon: Receipt, color: 'border-emerald-500' },
  { value: 'banque', label: 'Banque', icon: Landmark, color: 'border-violet-500' },
  { value: 'catalogue', label: 'Catalogue', icon: Package, color: 'border-slate-500' },
]

export default function Facturation() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showDevisDialog, setShowDevisDialog] = useState(false)
  const [showFactureDialog, setShowFactureDialog] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [prefilledFacture, setPrefilledFacture] = useState<{
    etablissementId: string
    montant: number
    libelle: string
  } | null>(null)

  const { devis } = useDevis()
  const { factures, kpis } = useFactures()
  const { echeances } = useEcheancesFacturation(3)
  const isMobile = useIsMobile()
  const showGlobalNav = !location.pathname.startsWith('/m/')

  // Compteurs pour badges
  const devisEnAttente = devis.filter((d) =>
    ['brouillon', 'envoye', 'en_negociation'].includes(d.statut)
  ).length

  const facturesEnRetard = kpis.nbFacturesEnRetard

  // Échéances du mois courant
  const echeancesMoisCourant = echeances.filter((e) => {
    const now = new Date()
    return e.mois.getMonth() === now.getMonth() && e.mois.getFullYear() === now.getFullYear()
  }).length

  // Stats for header
  const totalEncaisse = kpis.totalPaye
  const totalAEncaisser = kpis.totalEnAttente

  // Handler pour générer une facture depuis une échéance
  const handleGenerateFromEcheance = (echeance: EcheanceFacturation) => {
    setPrefilledFacture({
      etablissementId: echeance.etablissement.etablissement_id,
      montant: echeance.montant,
      libelle: echeance.libelle,
    })
    setShowFactureDialog(true)
    toast.info(`Création facture pour ${echeance.etablissement.nom}`, {
      description: `${echeance.libelle} - ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(echeance.montant)}`,
    })
  }

  const headerStats = [
    { label: 'CA encaissé', value: `${Math.round(totalEncaisse / 1000)}k€`, highlight: true },
    { label: 'à encaisser', value: `${Math.round(totalAEncaisser / 1000)}k€` },
  ]

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDevisDialog(true)}
        className="h-9 px-3 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20 text-white hover:bg-card/20 transition-all"
      >
        <Plus className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Devis</span>
      </Button>
      <Button
        size="sm"
        onClick={() => {
          setPrefilledFacture(null)
          setShowFactureDialog(true)
        }}
        className="h-9 rounded-xl bg-card text-primary hover:bg-card/90 shadow-md transition-all"
      >
        <Plus className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Facture</span>
      </Button>
    </div>
  )

  // Mobile toolbar with compact tabs
  const mobileToolbar = (
    <FacturationTabsCompact
      activeTab={activeTab}
      onTabChange={setActiveTab}
      badges={{
        devisEnAttente,
        facturesEnRetard,
      }}
    />
  )

  return (
    <div className="min-h-dvh bg-gradient-page">
      {isMobile ? (
        <FacturationMobileHeader
          stats={{
            caEncaisse: `${Math.round(totalEncaisse / 1000)}k€`,
            aEncaisser: `${Math.round(totalAEncaisser / 1000)}k€`,
            facturesEnRetard,
          }}
          onSearchClick={() => setShowSearch(true)}
          onNewDevis={() => setShowDevisDialog(true)}
          onNewFacture={() => {
            setPrefilledFacture(null)
            setShowFactureDialog(true)
          }}
          toolbar={mobileToolbar}
          showGlobalNav={showGlobalNav}
        />
      ) : (
        <ImmersivePageHeader
          title="Facturation & Devis"
          subtitle="Gérez vos devis, factures et catalogue de produits"
          icon={FileCheck}
          stats={headerStats}
          searchPlaceholder="Rechercher..."
          onSearchClick={() => setShowSearch(true)}
          actions={headerActions}
        >
          {/* Custom tab buttons - not using TabsList to avoid context error */}
          <div className="h-12 p-1 bg-card/10 backdrop-blur-sm border border-white/20 shadow-lg rounded-xl inline-flex gap-1">
            {FACTURATION_TABS.map((tab) => {
              const isActive = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex items-center gap-2 px-3 lg:px-4 h-10 rounded-lg transition-all ${
                    isActive
                      ? 'bg-card text-primary shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-card/10'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                  {tab.value === 'devis' && devisEnAttente > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 px-1.5 text-xs bg-blue-100 text-blue-700 shadow-sm"
                    >
                      {devisEnAttente}
                    </Badge>
                  )}
                  {tab.value === 'factures' && facturesEnRetard > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs shadow-sm">
                      {facturesEnRetard}
                    </Badge>
                  )}
                  {tab.value === 'echeances' && echeancesMoisCourant > 0 && (
                    <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs shadow-sm">
                      {echeancesMoisCourant}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </ImmersivePageHeader>
      )}

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsContent value="dashboard" className="mt-0">
            <FacturationDashboard />
          </TabsContent>

          <TabsContent value="echeances" className="mt-0">
            <FacturationEcheances onGenerateFacture={handleGenerateFromEcheance} />
          </TabsContent>

          <TabsContent value="devis" className="mt-0">
            <DevisList onCreateNew={() => setShowDevisDialog(true)} />
          </TabsContent>

          <TabsContent value="factures" className="mt-0">
            <FacturesList onCreateNew={() => setShowFactureDialog(true)} />
          </TabsContent>

          <TabsContent value="banque" className="mt-0">
            <FacturationQontoReconciliation />
          </TabsContent>

          <TabsContent value="catalogue" className="mt-0">
            <CatalogueProduits />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <DevisFormDialog open={showDevisDialog} onOpenChange={setShowDevisDialog} />
      <FactureFormDialog
        open={showFactureDialog}
        onOpenChange={(open) => {
          setShowFactureDialog(open)
          if (!open) setPrefilledFacture(null)
        }}
        prefilledData={prefilledFacture}
      />

      <GlobalSearchDialog open={showSearch} setOpen={setShowSearch} hideTrigger />
    </div>
  )
}
