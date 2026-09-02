import { useState, useEffect, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { debug } from '@/lib/debug'
import { ArrowLeft, Mail as MailIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmailFiltersProvider } from '@/contexts/EmailFiltersContext'
import { EmailInbox } from '@/components/email/EmailInbox'
import { EmailThread } from '@/components/email/EmailThread'
const EmailComposer = lazy(() =>
  import('@/components/email/EmailComposer').then((m) => ({ default: m.EmailComposer }))
)
import { Button } from '@/components/ui/button'
import { fetchEmailAccountsForProfile } from '@/services/email/emailAccountsClient'
import { useAuth } from '@/components/AuthProvider'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useEmailSync } from '@/hooks/email/useEmailSync'
import { toast } from 'sonner'
import { EmailDraft } from '@/types/email'
import { AppInstallPrompt } from '@/components/pwa/AppInstallPrompt'
import { PWAMailHeader } from '@/components/mobile/PWAMailHeader'
import { cn } from '@/lib/utils'
import { queryViewWithFilter, type UserEmailAccountSafe } from '@/lib/supabase-helpers'

/** Type simplifié pour les comptes email dans le mobile */
interface MobileEmailAccount {
  id: string
  email_address: string
}

export default function MobileMailApp() {
  const { user } = useAuth()
  const { data: profile } = useCurrentProfile()
  const [accountId, setAccountId] = useState<string>('')
  const [emailAccounts, setEmailAccounts] = useState<MobileEmailAccount[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const { syncNow, isSyncing, getLastSyncDate } = useEmailSync(accountId, emailAccounts)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  // Local state for navigation
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [draftToEdit, setDraftToEdit] = useState<EmailDraft | null>(null)

  const selectThread = (threadId: string, subject?: string) => {
    setSelectedThread(threadId)
    setComposing(false)
    setDraftToEdit(null)
  }

  const startComposing = () => {
    setComposing(true)
    setSelectedThread(null)
    setDraftToEdit(null)
  }

  const goBack = () => {
    if (composing) {
      setComposing(false)
      setDraftToEdit(null)
    } else {
      setSelectedThread(null)
    }
  }

  // Load email accounts and auto-select "all" if multiple
  // Filter by profile_id to isolate accounts per user
  useEffect(() => {
    const loadAccounts = async () => {
      if (!user || !profile?.id) return

      const data = await fetchEmailAccountsForProfile(profile.id, { columns: 'id, email_address' })
      if (data) {
        const accounts = data as unknown as MobileEmailAccount[]
        setEmailAccounts(accounts)
        if (accounts.length > 1) {
          setAccountId('all')
        } else if (accounts.length > 0) {
          setAccountId(accounts[0].id)
        }
      }
      setAccountsLoaded(true)
    }

    loadAccounts()
  }, [user, profile?.id])

  // Load last sync date
  useEffect(() => {
    const loadLastSync = async () => {
      if (!accountId || accountId === 'all') {
        setLastSyncAt(null)
        return
      }
      const date = await getLastSyncDate()
      setLastSyncAt(date ?? null)
    }
    loadLastSync()
  }, [accountId, getLastSyncDate, isSyncing])

  const handleSyncNow = async () => {
    if (!accountId) {
      toast.error('Aucun compte email sélectionné')
      return
    }
    try {
      await syncNow()
    } catch (error) {
      debug.error('Sync error:', error)
    }
  }

  return (
    <EmailFiltersProvider>
      <div
        className={cn(
          'min-h-dvh flex flex-col bg-background',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
        )}
      >
        {/* PWA Mail Header - NO hamburger, with account selector */}
        {!selectedThread && !composing && (
          <PWAMailHeader
            accountId={accountId}
            emailAccounts={emailAccounts}
            onAccountChange={setAccountId}
            onSync={handleSyncNow}
            onCompose={startComposing}
            isSyncing={isSyncing}
          />
        )}

        {/* Back header for thread/compose views */}
        {(selectedThread || composing) && (
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="-ml-2"
              aria-label="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-medium truncate">
              {composing ? 'Nouveau message' : 'Conversation'}
            </span>
          </header>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {composing ? (
            <Suspense
              fallback={<div className="p-4 text-sm text-muted-foreground">Chargement…</div>}
            >
              <EmailComposer
                accountId={accountId}
                onCancel={goBack}
                onSent={() => {
                  goBack()
                  toast.success('Email envoyé')
                }}
                initialDraft={draftToEdit || undefined}
              />
            </Suspense>
          ) : selectedThread ? (
            <EmailThread threadId={selectedThread} onBack={goBack} />
          ) : accountsLoaded && emailAccounts.length === 0 ? (
            <div className="h-full flex items-center justify-center px-6 py-12">
              <div className="text-center space-y-4 max-w-sm">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <MailIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Aucun compte email</h2>
                <p className="text-sm text-muted-foreground">
                  Configurez un compte email pour consulter votre messagerie depuis mobile.
                </p>
                <Button asChild variant="default" size="sm">
                  <Link to="/parametres/emails">Ajouter un compte</Link>
                </Button>
              </div>
            </div>
          ) : (
            <EmailInbox
              onThreadSelect={(threadId, subject) => selectThread(threadId, subject)}
              accountId={accountId}
              lastSyncAt={lastSyncAt}
            />
          )}
        </main>
      </div>

      {/* PWA Install Prompt */}
      <AppInstallPrompt
        appName="OpenPulse Mail"
        appIcon="/icons/app-mail-192.png"
        themeColor="#3280DD"
      />
    </EmailFiltersProvider>
  )
}
