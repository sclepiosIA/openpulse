import {
  fetchEmailAccountsForProfile,
  fetchEmailThreadFlags,
} from '@/services/email/emailAccountsClient'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { debug } from '@/lib/debug'
import { useSearchParams } from 'react-router-dom'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { motion } from 'framer-motion'
import { EmailProvider } from '@/contexts/EmailContext'
import { EmailFiltersProvider } from '@/contexts/EmailFiltersContext'
import { useEmailNavigation } from '@/hooks/email/useEmailNavigation'
import { useEmailThreadActions } from '@/hooks/email/useEmailThreadActions'
import { EmailInbox } from '@/components/email/EmailInbox'
import { EmailThread } from '@/components/email/EmailThread'
const EmailComposer = lazy(() =>
  import('@/components/email/EmailComposer').then((m) => ({ default: m.EmailComposer }))
)
import { EmailDrafts } from '@/components/email/EmailDrafts'
import { EmailsByEtablissementView } from '@/components/email/EmailsByEtablissementView'
import { EmailClassificationDashboard } from '@/components/email/EmailClassificationDashboard'
import { EmailSettingsSections } from '@/components/email/EmailSettingsSections'
// Lot 1 Azure Smart Inbox : panneau rendu uniquement si VITE_EMAIL_BACKEND=azure|hybrid.
import { EmailAzureSupervisionPanel } from '@/components/email/EmailAzureSupervisionPanel'
import { CalendarInvitationSuggestions } from '@/components/email/CalendarInvitationSuggestions'
import { EmailSequenceBuilder } from '@/components/email/EmailSequenceBuilder'
import { MobileEmailNavigation } from '@/components/email/MobileEmailNavigation'
import { MobileEmailHeader } from '@/components/email/MobileEmailHeader'
import { EmailMasterDetail } from '@/components/email/EmailMasterDetail'
import { EmailFoldersView } from '@/components/email/folders/EmailFoldersView'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, ArrowLeft, Mail, Check, RefreshCw, ChevronDown } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { usePendingContactsCount } from '@/hooks/crm/usePendingContactsCount'
import { useEmailSignature } from '@/hooks/email/useEmailSignature'
import { toast } from 'sonner'
import { useErrorHandler } from '@/hooks/shared/useErrorHandler'
import { useEmailSync } from '@/hooks/email/useEmailSync'
import { useEmailAutoSync } from '@/hooks/email/useEmailAutoSync'
import type { EmailDraft, EmailAccountSafe, EmailThread as EmailThreadType } from '@/types/email'
import { useTabBreadcrumb } from '@/hooks/ui/useTabBreadcrumb'
import { TAB_LABELS } from '@/config/tabLabels'
import { useRealtimeEmailCompat } from '@/contexts/RealtimeEmailContext'

function EmailsContent() {
  usePageTitle('Messagerie')
  const [searchParams, setSearchParams] = useSearchParams()
  const [accountId, setAccountId] = useState<string>('')
  const accountInitializedRef = useRef(false)
  const { signature: emailSignature } = useEmailSignature()
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountSafe[]>([])
  const [accountsPopoverOpen, setAccountsPopoverOpen] = useState(false)
  const [currentTab, setCurrentTab] = useState(() => {
    return sessionStorage.getItem('email-current-tab') || 'inbox'
  })
  const [threadData, setThreadData] = useState<EmailThreadType | null>(null)
  const [prefilledRecipient, setPrefilledRecipient] = useState<{
    email: string
    name?: string
  } | null>(null)
  const { user } = useAuth()
  const { data: profile } = useCurrentProfile()
  const { data: pendingCount = 0 } = usePendingContactsCount()
  const { handleError } = useErrorHandler()
  const {
    syncNow,
    fullSync,
    isSyncing: isSyncingHook,
    getLastSyncDate,
  } = useEmailSync(accountId, emailAccounts)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  // Use centralized realtime context (no duplicate channels)
  const { unreadByAccount } = useRealtimeEmailCompat()

  // Auto-sync quasi temps réel : focus fenêtre + polling 45s en foreground
  useEmailAutoSync(accountId)

  // Load last sync date
  useEffect(() => {
    const loadLastSync = async () => {
      if (!accountId) return
      const date = await getLastSyncDate()
      setLastSyncAt(date ?? null)
    }
    loadLastSync()
  }, [accountId, getLastSyncDate, isSyncingHook])
  const { archiveThread, isArchiving } = useEmailThreadActions()

  // Use EmailContext for navigation state
  const {
    selectedThread,
    composing,
    draftToEdit,
    selectThread,
    closeThread,
    startComposing,
    editDraft,
    goBack,
  } = useEmailNavigation()

  // Signature is now loaded via useEmailSignature() hook above

  // Load thread data for action buttons
  useEffect(() => {
    const loadThreadData = async () => {
      if (!selectedThread) {
        setThreadData(null)
        return
      }

      try {
        const flags = await fetchEmailThreadFlags(selectedThread)
        if (flags) {
          setThreadData((prev) => (prev ? { ...prev, ...flags } : null))
        }
      } catch (error) {
        debug.error('Error loading thread data:', error)
      }
    }

    loadThreadData()
  }, [selectedThread])

  // Load email accounts and auto-load first active account
  // Filter by current user's profile_id to ensure each user only sees their own accounts
  // Stabilize: only re-run when profile.id changes, not on every profile refetch
  const profileId = profile?.id
  useEffect(() => {
    const loadAccounts = async () => {
      if (!user || !profileId) return

      const data = (await fetchEmailAccountsForProfile(profileId)) as unknown as
        | EmailAccountSafe[]
        | null

      if (data) {
        setEmailAccounts(data)

        // Only auto-select on first load, not on profile refetch
        if (!accountInitializedRef.current) {
          accountInitializedRef.current = true
          const savedAccountId = sessionStorage.getItem('selected_email_account')
          if (
            savedAccountId === 'all' ||
            (savedAccountId && data.some((acc) => acc.id === savedAccountId))
          ) {
            setAccountId(savedAccountId)
          } else if (data.length > 1) {
            // Default to first personal account instead of 'all' to avoid confusion
            const personalAccount = data.find((acc) => !acc.is_shared) || data[0]
            setAccountId(personalAccount.id)
            sessionStorage.setItem('selected_email_account', personalAccount.id)
          } else if (data.length > 0) {
            setAccountId(data[0].id)
            sessionStorage.setItem('selected_email_account', data[0].id)
          }
        }
      }
    }

    loadAccounts()
  }, [user, profileId])

  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId)
    sessionStorage.setItem('selected_email_account', newAccountId)
    // Reset view when changing account
    closeThread()
  }

  const handleDraftSelect = (draft: EmailDraft) => {
    editDraft(draft)
  }

  const handleSyncNow = async () => {
    debug.log('🔄 handleSyncNow called')
    if (!emailAccounts || emailAccounts.length === 0) {
      toast.error('Aucun compte email configuré')
      return
    }

    // Sync without changing the selected account — syncNow handles all accounts internally
    try {
      await syncNow()
    } catch (error) {
      handleError(error, 'Emails.handleSyncNow')
    }
  }

  const handleFullSync = async () => {
    if (!accountId) {
      toast.error('Aucun compte email sélectionné')
      return
    }

    const confirmed = window.confirm(
      '⚠️ SYNCHRONISATION COMPLÈTE\n\n' +
        'Cette opération va récupérer TOUS vos emails historiques.\n' +
        "Cela peut prendre plusieurs minutes selon le nombre d'emails.\n\n" +
        'Voulez-vous continuer ?'
    )

    if (!confirmed) return

    try {
      await fullSync()
    } catch (error) {
      handleError(error, 'Emails.handleFullSync')
    }
  }

  // State for search (shared with mobile header)
  const [mobileSearch, setMobileSearch] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  // Load unread count for header (use realtime data for consistency)
  const totalUnreadCount = useMemo(() => {
    if (accountId === 'all') {
      return Object.values(unreadByAccount).reduce((sum, acc) => sum + (acc.count || 0), 0)
    }
    return unreadByAccount[accountId]?.count || 0
  }, [accountId, unreadByAccount])

  // Keep unreadCount in sync with computed value
  useEffect(() => {
    setUnreadCount(totalUnreadCount)
  }, [totalUnreadCount])

  // Persist current tab to sessionStorage for recovery after remount
  useEffect(() => {
    sessionStorage.setItem('email-current-tab', currentTab)
  }, [currentTab])

  // Intégration fil d'Ariane - l'EmailContext gère déjà les entrées virtuelles pour les threads
  useTabBreadcrumb(
    {
      pageLabel: TAB_LABELS.emails.pageLabel,
      parentPath: '/emails',
      tabLabels: TAB_LABELS.emails.tabs,
      onTabChange: setCurrentTab,
    },
    currentTab
  )

  // Handle URL parameters for deep linking (thread selection, compose with recipient)
  useEffect(() => {
    const threadId = searchParams.get('thread')
    const compose = searchParams.get('compose')
    const toEmail = searchParams.get('to')
    const toName = searchParams.get('toName')

    // Handle thread selection from URL
    if (threadId && !selectedThread) {
      selectThread(threadId, 'Conversation')
      // Clean URL after navigation
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('thread')
      setSearchParams(newParams, { replace: true })
    }

    // Handle compose with pre-filled recipient from URL
    if (compose === 'true' && !composing) {
      if (toEmail) {
        setPrefilledRecipient({
          email: decodeURIComponent(toEmail),
          name: toName ? decodeURIComponent(toName) : undefined,
        })
      }
      startComposing()
      // Clean URL after navigation
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('compose')
      newParams.delete('to')
      newParams.delete('toName')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams, selectedThread, composing, selectThread, startComposing, setSearchParams])

  // Get current account email for header
  // State for global search
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)

  // Get current account email for header
  const currentAccount =
    accountId === 'all' ? null : emailAccounts.find((acc) => acc.id === accountId)

  return (
    <Tabs
      value={currentTab}
      onValueChange={setCurrentTab}
      className="w-full max-w-full min-w-0 overflow-hidden"
    >
      {/* Background gradient pour toute la page */}
      <div className="fixed inset-0 bg-gradient-page -z-10 pointer-events-none" />

      {/* Immersive Page Header - Desktop */}
      <div className="hidden lg:block">
        <ImmersivePageHeader
          title="Messagerie"
          subtitle="Gérez vos emails et communications"
          icon={Mail}
          stats={[
            { label: 'non lus', value: unreadCount, highlight: unreadCount > 0 },
            { label: 'comptes', value: emailAccounts.length },
          ]}
          searchPlaceholder="Rechercher emails..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={
            <div className="flex items-center gap-2">
              {/* Account Selector - Compact & Harmonized */}
              <Popover open={accountsPopoverOpen} onOpenChange={setAccountsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    // Le libellé visible est masqué sous `lg` et peut être vide
                    // quand `currentAccount` n'est pas encore résolu : le bouton
                    // se retrouve alors sans nom accessible (axe `button-name`).
                    aria-label="Choisir le compte email"
                    className="h-9 gap-2 px-3 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg transition-all"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="hidden lg:inline max-w-[100px] truncate text-sm">
                      {accountId === 'all' ? 'Tous' : currentAccount?.email_address?.split('@')[0]}
                    </span>
                    {emailAccounts.length > 1 && (
                      <Badge className="h-5 px-1.5 text-[10px] bg-card/20 text-white border-0">
                        {emailAccounts.length}
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 shadow-xl border-primary/10" align="end">
                  <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
                    <h3 className="font-semibold text-sm">Comptes synchronisés</h3>
                    <p className="text-xs text-muted-foreground">
                      {emailAccounts.length} compte{emailAccounts.length > 1 ? 's' : ''} actif
                      {emailAccounts.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {/* All accounts option */}
                    {emailAccounts.length > 1 && (
                      <button
                        onClick={() => {
                          handleAccountChange('all')
                          setAccountsPopoverOpen(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left border-b"
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Tous les comptes</p>
                          <p className="text-xs text-muted-foreground">Vue unifiée</p>
                        </div>
                        {totalUnreadCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-5 px-1.5 flex items-center justify-center text-xs"
                          >
                            {totalUnreadCount}
                          </Badge>
                        )}
                        {accountId === 'all' && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    )}
                    {emailAccounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => {
                          handleAccountChange(account.id)
                          setAccountsPopoverOpen(false)
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left border-b last:border-b-0"
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{account.email_address}</p>
                        </div>
                        {unreadByAccount[account.id]?.count > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-5 px-1.5 flex items-center justify-center text-xs"
                          >
                            {unreadByAccount[account.id].count}
                          </Badge>
                        )}
                        {accountId === account.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {currentTab === 'inbox' && !composing && !selectedThread && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSyncNow}
                    disabled={isSyncingHook}
                    className="h-9 w-9 bg-card/10 backdrop-blur-sm border border-white/20 hover:bg-card/20 text-white rounded-lg"
                    title="Synchroniser"
                    aria-label="Actualiser"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncingHook ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    onClick={startComposing}
                    className="h-9 gap-2 bg-card text-primary hover:bg-card/90 shadow-lg font-medium rounded-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nouveau</span>
                  </Button>
                </>
              )}
            </div>
          }
        >
          {/* Tabs style underline - plus élégant */}
          <div className="border-b border-white/20">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              {[
                { value: 'inbox', label: 'Boîte de réception' },
                { value: 'folders', label: 'Dossiers' },
                { value: 'classification', label: 'Classification' },
                { value: 'etablissements', label: 'Par établissement' },
                { value: 'sequences', label: 'Séquences' },
                { value: 'drafts', label: 'Brouillons' },
                {
                  value: 'settings',
                  label: 'Paramètres',
                  badge: pendingCount > 0 ? pendingCount : undefined,
                },
              ].map((tab, index) => (
                <motion.div
                  key={tab.value}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <TabsTrigger
                    value={tab.value}
                    className="relative px-4 py-2.5 text-white/70 bg-transparent border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none hover:text-white/90 transition-all"
                  >
                    {tab.label}
                    {tab.badge && tab.badge > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {tab.badge}
                      </Badge>
                    )}
                  </TabsTrigger>
                </motion.div>
              ))}
            </TabsList>
          </div>
        </ImmersivePageHeader>

        {/* Global Search Dialog */}
        <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />
      </div>

      {/* Mobile Header */}
      {currentTab === 'inbox' && !composing && !selectedThread && (
        <div className="lg:hidden">
          <MobileEmailHeader
            accountEmail={currentAccount?.email_address}
            unreadCount={unreadCount}
            totalCount={0}
            searchValue={mobileSearch}
            onSearchChange={setMobileSearch}
            emailAccounts={emailAccounts}
            currentAccountId={accountId}
            onAccountChange={handleAccountChange}
          />
        </div>
      )}

      {/* Mobile Back Header for Thread/Compose */}
      {(composing || selectedThread) && (
        <div className="lg:hidden flex items-center gap-2 px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="flex-shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium truncate flex-1">
            {composing ? 'Nouveau message' : 'Conversation'}
          </span>
        </div>
      )}

      {/* Mobile Tab Navigation - for non-inbox tabs */}
      {currentTab !== 'inbox' && !composing && !selectedThread && (
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b">
          {/* <h2> et non <h1> : le titre principal de la page est rendu par
              ImmersivePageHeader. Deux <h1> dans un même document cassent la
              hiérarchie des titres pour les lecteurs d'écran. */}
          <h2 className="text-lg font-semibold">
            {currentTab === 'classification' && 'Classification'}
            {currentTab === 'folders' && 'Dossiers'}
            {currentTab === 'etablissements' && 'Par établissement'}
            {currentTab === 'sequences' && 'Séquences'}
            {currentTab === 'drafts' && 'Brouillons'}
            {currentTab === 'settings' && 'Paramètres'}
          </h2>
          <MobileEmailNavigation
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            pendingCount={pendingCount}
            emailAccounts={emailAccounts}
            currentAccountId={accountId}
            onAccountChange={handleAccountChange}
          />
        </div>
      )}

      <TabsContent
        value="inbox"
        className="lg:mt-0 overflow-hidden w-full max-w-full min-w-0 lg:px-0 lg:h-[calc(100vh-140px)] lg:flex lg:flex-col"
      >
        {/* Desktop: Master-Detail Layout */}
        <motion.div
          className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <EmailMasterDetail
            accountId={accountId}
            onSyncNow={handleSyncNow}
            onFullSync={handleFullSync}
            isSyncing={isSyncingHook}
            lastSyncAt={lastSyncAt}
          />
        </motion.div>

        {/* Mobile: Sequential Navigation (existing behavior) */}
        <div className="lg:hidden">
          {composing ? (
            <Suspense
              fallback={<div className="p-4 text-sm text-muted-foreground">Chargement…</div>}
            >
              <EmailComposer
                accountId={accountId}
                onCancel={() => {
                  setPrefilledRecipient(null)
                  goBack()
                }}
                onSent={() => {
                  setPrefilledRecipient(null)
                  goBack()
                  toast.success('Email envoyé avec succès')
                }}
                initialDraft={draftToEdit || undefined}
                initialRecipient={prefilledRecipient}
              />
            </Suspense>
          ) : selectedThread ? (
            <EmailThread threadId={selectedThread} onBack={goBack} />
          ) : (
            <EmailInbox
              onThreadSelect={(threadId, subject) => selectThread(threadId, subject)}
              onSyncNow={!composing && !selectedThread ? handleSyncNow : undefined}
              onFullSync={!composing && !selectedThread ? handleFullSync : undefined}
              isSyncing={isSyncingHook}
              onComposeNew={!composing && !selectedThread ? startComposing : undefined}
              accountId={accountId}
              lastSyncAt={lastSyncAt}
            />
          )}
        </div>
      </TabsContent>

      <TabsContent value="folders" className="mt-6 px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <EmailFoldersView
            onOpenThread={(threadId) => {
              selectThread(threadId, 'Conversation')
              setCurrentTab('inbox')
            }}
          />
        </motion.div>
      </TabsContent>

      <TabsContent value="classification" className="mt-6 space-y-6 px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <CalendarInvitationSuggestions />
          <EmailClassificationDashboard />
        </motion.div>
      </TabsContent>

      <TabsContent value="etablissements" className="mt-6 px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <EmailsByEtablissementView />
        </motion.div>
      </TabsContent>

      <TabsContent value="sequences" className="mt-6 px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <EmailSequenceBuilder />
        </motion.div>
      </TabsContent>

      <TabsContent value="drafts" className="mt-6 px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <EmailDrafts onDraftSelect={handleDraftSelect} />
        </motion.div>
      </TabsContent>

      <TabsContent value="settings" className="mt-6 px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Supervision Azure (lot 1) — null si VITE_EMAIL_BACKEND=supabase */}
          <EmailAzureSupervisionPanel />
          <EmailSettingsSections profileId={profile?.id} initialSignature={emailSignature} />
        </motion.div>
      </TabsContent>
    </Tabs>
  )
}

export default function Emails() {
  return (
    <EmailProvider>
      <EmailFiltersProvider>
        <EmailsContent />
      </EmailFiltersProvider>
    </EmailProvider>
  )
}
