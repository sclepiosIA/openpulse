import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Handshake, LayoutDashboard } from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ApporteurDashboard } from '@/components/apporteurs/ApporteurDashboard'
import { ApporteurDetailTab } from '@/components/apporteurs/ApporteurDetailTab'
import { apporteursSeed } from '@/data/apporteursSeed'
import { useApporteursArr } from '@/components/apporteurs/useApporteursArr'

export default function ApporteursAffaires() {
  const [searchParams, setSearchParams] = useSearchParams()
  const apporteurs = useMemo(() => apporteursSeed, [])
  const validTabs = useMemo(() => ['dashboard', ...apporteurs.map((a) => a.id)], [apporteurs])
  const requested = searchParams.get('tab') ?? 'dashboard'
  const activeTab = validTabs.includes(requested) ? requested : 'dashboard'

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'dashboard') next.delete('tab')
    else next.set('tab', value)
    setSearchParams(next, { replace: true })
  }

  const { totalArr, totalClients, isReady: arrReady } = useApporteursArr(apporteurs)

  const stats = useMemo(() => {
    return [
      { label: 'Partenaires', value: apporteurs.length },
      { label: 'Clients apportés', value: arrReady ? totalClients : '…' },
      {
        label: 'ARR cumulé',
        value: arrReady ? `${Math.round(totalArr / 1000)}k€` : '…',
        highlight: true,
      },
    ]
  }, [apporteurs, totalArr, totalClients, arrReady])

  const tabs = useMemo(
    () => [
      { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ...apporteurs.map((a) => ({ value: a.id, label: a.nom, icon: Handshake })),
    ],
    [apporteurs]
  )

  return (
    <div
      className="min-h-dvh bg-gradient-page"
      data-page="apporteurs-affaires"
      data-page-ready="true"
      data-page-state="ready"
    >
      <ImmersivePageHeader
        title="Apporteurs d'Affaires"
        subtitle="Suivi des partenariats commerciaux"
        icon={Handshake}
        stats={stats}
      >
        {/* Glassmorphism Tabs in header */}
        <div className="flex gap-1 bg-card/10 backdrop-blur-sm border border-white/20 p-1 rounded-md overflow-x-auto max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-card/20 text-white shadow-none'
                    : 'text-white/70 hover:bg-card/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </ImmersivePageHeader>

      <div className="p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsContent value="dashboard" className="mt-0">
            <ApporteurDashboard apporteurs={apporteurs} />
          </TabsContent>

          {apporteurs.map((a) => (
            <TabsContent key={a.id} value={a.id} className="mt-0">
              <ApporteurDetailTab apporteur={a} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
