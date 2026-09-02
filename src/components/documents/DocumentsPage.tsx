import { useSearchParams } from 'react-router-dom'
import { FolderOpen, Clock, Share2, Trash2, Building2, Sparkles, FileText } from 'lucide-react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentBrowser } from '@/components/documents/DocumentBrowser'
import { MyDocumentsBrowser } from '@/components/documents/MyDocumentsBrowser'
import { DocumentFolderBrowser } from '@/components/documents/DocumentFolderBrowser'
import { DocumentQuotaIndicator } from '@/components/documents/DocumentQuotaIndicator'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { DocumentsMobileHeader } from '@/components/documents/DocumentsMobileHeader'
import { useDocuments } from '@/hooks/documents/useDocuments'
import { useEtablissementsWithDocuments } from '@/hooks/documents/useEtablissementsWithDocuments'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/hooks/profile/useUserPreferences'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { useAuth } from '@/components/AuthProvider'
import type { LucideIcon } from 'lucide-react'
import { CreateFolderDialog } from '@/components/documents/folders/CreateFolderDialog'
import { useDocumentUpload } from '@/hooks/documents/useDocumentUpload'
import { DriveAzurePanel } from '@/components/documents/DriveAzurePanel'
import {
  isAzureDriveEnabled,
  isLegacyDocumentsEnabled,
  resolveDocumentsBackend,
} from '@/lib/drive/driveClient'

interface DocumentsPageProps {
  isPWAMode?: boolean
}

type TabDef = {
  key: string
  label: string
  short: string
  icon: LucideIcon
  /** Tailwind pastel accent (bg, text, ring) */
  accent: { bg: string; ring: string; icon: string; badge: string }
}

export default function DocumentsPage({ isPWAMode = false }: DocumentsPageProps) {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { getPreference, updatePreference } = useUserPreferences()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [azureUploadRequestKey, setAzureUploadRequestKey] = useState(0)
  const { uploadFiles } = useDocumentUpload()
  const documentsBackend = resolveDocumentsBackend(searchParams)
  const showAzureDrive = isAzureDriveEnabled(documentsBackend)
  const showLegacyDocuments = isLegacyDocumentsEnabled(documentsBackend)

  const urlTab = searchParams.get('tab')
  const savedTab = getPreference('documents_tab', 'etablissements') as string
  const activeTab = urlTab || savedTab || 'etablissements'

  const { data: userId } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => user?.id || null,
  })

  const setActiveTab = (tab: string) => {
    const backend = searchParams.get('backend')
    setSearchParams(backend ? { tab, backend } : { tab })
    updatePreference('documents_tab', tab)
  }

  const { data: myDocs = [] } = useDocuments({ createdBy: userId || undefined })
  const { data: recentDocs = [] } = useDocuments(
    undefined,
    { field: 'created_at', order: 'desc' },
    10
  )
  const { data: deletedDocs = [] } = useDocuments({ showDeleted: true })
  const { data: etablissements = [] } = useEtablissementsWithDocuments()

  const deletedCount = deletedDocs.filter((d) => d.deleted_at).length

  const etablissementsDocsCount = useMemo(
    () => etablissements.reduce((sum, e) => sum + e.document_count, 0),
    [etablissements]
  )

  const totalDocs = etablissementsDocsCount + myDocs.length

  const handleSearch = () => {
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    document.dispatchEvent(event)
  }

  const handleLegacyFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) await uploadFiles(files.slice(0, 10))
    event.target.value = ''
  }

  const handleMobileUpload = () => {
    if (showAzureDrive) setAzureUploadRequestKey((key) => key + 1)
    else fileInputRef.current?.click()
  }

  const headerActions = <DocumentQuotaIndicator className="hidden md:block w-48" />

  const tabCounts: {
    etablissements: number
    'mes-documents': number
    recents: number
    partages: number
    corbeille: number
  } & Record<string, number> = {
    etablissements: etablissementsDocsCount,
    'mes-documents': myDocs.length,
    recents: recentDocs.length,
    partages: 0,
    corbeille: deletedCount,
  }

  const TABS: TabDef[] = [
    {
      key: 'etablissements',
      label: 'Établissements',
      short: 'Étab.',
      icon: Building2,
      accent: {
        bg: 'from-marque-grille/10 to-marque-pastel-cyan/30',
        ring: 'ring-marque-grille/20',
        icon: 'from-marque-grille to-marque-grille',
        badge: 'bg-marque-pastel-cyan text-marque-grille',
      },
    },
    {
      key: 'mes-documents',
      label: 'Mes documents',
      short: 'Mes docs',
      icon: FolderOpen,
      accent: {
        bg: 'from-blue-300/15 to-blue-200/25',
        ring: 'ring-blue-300/25',
        icon: 'from-blue-500 to-blue-400',
        badge: 'bg-blue-100 text-blue-700',
      },
    },
    {
      key: 'recents',
      label: 'Documents récents',
      short: 'Récents',
      icon: Clock,
      accent: {
        bg: 'from-orange-300/15 to-orange-500/10',
        ring: 'ring-orange-500/25',
        icon: 'from-orange-500 to-orange-400',
        badge: 'bg-orange-100 text-orange-700',
      },
    },
    {
      key: 'partages',
      label: 'Partagés avec moi',
      short: 'Partagés',
      icon: Share2,
      accent: {
        bg: 'from-blue-200/20 to-blue-100/40',
        ring: 'ring-blue-200/30',
        icon: 'from-blue-400 to-blue-400',
        badge: 'bg-blue-100 text-blue-700',
      },
    },
    {
      key: 'corbeille',
      label: 'Corbeille',
      short: 'Corbeille',
      icon: Trash2,
      accent: {
        bg: 'from-red-50 to-red-100/50',
        ring: 'ring-red-200/50',
        icon: 'from-red-500 to-red-600',
        badge: 'bg-red-100 text-red-700',
      },
    },
  ]

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0]

  return (
    <div className="min-h-dvh bg-gradient-page">
      {/* Header: Mobile vs Desktop */}
      {isMobile ? (
        <DocumentsMobileHeader
          totalDocs={totalDocs}
          showGlobalNav={!isPWAMode}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabCounts={tabCounts}
          onSearch={handleSearch}
          onUpload={handleMobileUpload}
          onCreateFolder={() => setCreateFolderOpen(true)}
        />
      ) : (
        <ImmersivePageHeader
          title="Documents"
          subtitle="Gérez tous vos documents — propulsé par OpenPulse"
          icon={FolderOpen}
          stats={[
            { label: 'total', value: totalDocs, highlight: true },
            { label: 'récents', value: recentDocs.length },
          ]}
          searchPlaceholder="Rechercher un document..."
          onSearchClick={handleSearch}
          actions={headerActions}
          variant="compact"
        >
          {/* Segmented tab navigation - glassmorphism */}
          <div
            role="tablist"
            aria-label="Sections des documents"
            className="flex items-center gap-1.5 flex-wrap p-1 rounded-xl bg-card/5 backdrop-blur-sm border border-white/10 w-fit"
          >
            {TABS.map((t) => {
              const active = activeTab === t.key
              const Icon = t.icon
              const isTrash = t.key === 'corbeille'
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  // Pas d'`aria-controls` ici : les panneaux sont des
                  // `TabsContent` Radix, qui ne monte que l'onglet actif et
                  // gère lui-même l'id du panneau. L'attribut pointait donc
                  // vers un élément absent du DOM — règle axe
                  // `aria-valid-attr-value` (critical).
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium',
                    'transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                    active
                      ? isTrash
                        ? 'bg-red-500 text-white shadow-md shadow-red-900/20'
                        : 'bg-card text-primary shadow-md shadow-black/10'
                      : 'text-white/75 hover:bg-card/10 hover:text-white'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{t.short}</span>
                  <span
                    className={cn(
                      'ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold tabular-nums',
                      active
                        ? isTrash
                          ? 'bg-card/25 text-white'
                          : 'bg-primary/10 text-primary'
                        : 'bg-card/15 text-white/80'
                    )}
                  >
                    {tabCounts[t.key] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </ImmersivePageHeader>
      )}

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-[1600px] mx-auto w-full">
        {showLegacyDocuments && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleLegacyFileSelect}
            aria-label="Importer des documents"
          />
        )}
        {showLegacyDocuments && (
          <CreateFolderDialog
            open={createFolderOpen}
            onOpenChange={setCreateFolderOpen}
            trigger={<span className="hidden" aria-hidden="true" />}
          />
        )}
        {/* Quota mobile */}
        <div className="md:hidden mb-4">
          <DocumentQuotaIndicator />
        </div>

        {showAzureDrive && (
          <DriveAzurePanel
            backend={documentsBackend}
            className="mb-4"
            uploadRequestKey={azureUploadRequestKey}
          />
        )}

        {/* Section title strip - desktop only */}
        {!isMobile && (
          <div
            className={cn(
              'mb-4 flex items-center justify-between gap-3 rounded-2xl border bg-gradient-to-r p-3 sm:p-4 ring-1',
              currentTab.accent.bg,
              currentTab.accent.ring,
              'border-white/60'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={cn(
                  'shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br text-white shadow-sm',
                  currentTab.accent.icon
                )}
              >
                <currentTab.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-slate-800 truncate">
                  {currentTab.label}
                </h2>
                <p className="text-xs text-slate-600/80 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-accent" aria-hidden />
                  <span className="truncate">
                    {activeTab === 'etablissements' &&
                      `${etablissements.length} établissement${etablissements.length > 1 ? 's' : ''} · ${etablissementsDocsCount} document${etablissementsDocsCount > 1 ? 's' : ''}`}
                    {activeTab === 'mes-documents' &&
                      `${myDocs.length} document${myDocs.length > 1 ? 's' : ''} personnel${myDocs.length > 1 ? 's' : ''}`}
                    {activeTab === 'recents' &&
                      `${recentDocs.length} document${recentDocs.length > 1 ? 's' : ''} ajouté${recentDocs.length > 1 ? 's' : ''} récemment`}
                    {activeTab === 'partages' && "Documents partagés avec vous par l'équipe"}
                    {activeTab === 'corbeille' &&
                      `${deletedCount} document${deletedCount > 1 ? 's' : ''} · suppression définitive après 30 jours`}
                  </span>
                </p>
              </div>
            </div>
            <Badge
              className={cn(
                'hidden sm:inline-flex h-6 px-2.5 rounded-md text-xs font-semibold border-0',
                currentTab.accent.badge
              )}
            >
              {tabCounts[activeTab] ?? 0}
            </Badge>
          </div>
        )}

        {/* Tabs Content */}
        {showLegacyDocuments && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="etablissements" id="docs-panel-etablissements">
              <SectionCard isMobile={isMobile}>
                <DocumentFolderBrowser />
              </SectionCard>
            </TabsContent>

            <TabsContent value="mes-documents" id="docs-panel-mes-documents">
              <SectionCard isMobile={isMobile}>
                <MyDocumentsBrowser />
              </SectionCard>
            </TabsContent>

            <TabsContent value="recents" id="docs-panel-recents">
              <SectionCard isMobile={isMobile}>
                <DocumentBrowser showUpload={false} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="partages" id="docs-panel-partages">
              <SectionCard isMobile={isMobile}>
                <BrandedEmptyState
                  icon={Share2}
                  title="Aucun document partagé"
                  description="Les documents partagés avec vous par vos collègues apparaîtront ici."
                  gradient="from-blue-500 to-blue-400"
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="corbeille" id="docs-panel-corbeille">
              <SectionCard isMobile={isMobile}>
                {deletedCount === 0 ? (
                  <BrandedEmptyState
                    icon={Trash2}
                    title="Corbeille vide"
                    description="Les documents supprimés seront définitivement effacés après 30 jours."
                    gradient="from-red-500 to-red-600"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground p-4">
                    Les documents seront définitivement supprimés après 30 jours.
                  </p>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>
        )}

        {/* Brand footer */}
        {!isMobile && (
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70">
            <FileText className="h-3 w-3" aria-hidden />
            <span>Espace documentaire sécurisé — </span>
            <span className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              OpenPulse
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionCard({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) {
  return (
    <Card
      className={cn(
        'rounded-2xl overflow-hidden border-slate-200/60 shadow-sm bg-card/80 backdrop-blur-sm',
        isMobile && 'border-0 shadow-none bg-transparent rounded-none'
      )}
    >
      <CardContent className={cn('p-0', !isMobile && 'sm:p-2')}>{children}</CardContent>
    </Card>
  )
}

function BrandedEmptyState({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: LucideIcon
  title: string
  description: string
  gradient: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="relative mb-5">
        <div
          className={cn(
            'absolute inset-0 rounded-full blur-2xl opacity-40 bg-gradient-to-br',
            gradient
          )}
        />
        <div
          className={cn(
            'relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
            gradient
          )}
        >
          <Icon className="h-8 w-8" />
        </div>
      </div>
      <p className="text-base font-semibold text-slate-800">{title}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        <Sparkles className="h-3 w-3 text-accent" aria-hidden />
        <span>Powered by </span>
        <span className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          OpenPulse
        </span>
      </div>
    </div>
  )
}
