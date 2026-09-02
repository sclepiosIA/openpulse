import { useState } from 'react'
import { Mail, RefreshCw, Plus, Search, X, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useEmailFiltersContext } from '@/contexts/EmailFiltersContext'

interface PWAMailHeaderProps {
  accountId: string
  emailAccounts: Array<{ id: string; email_address: string }>
  onAccountChange: (id: string) => void
  onSync: () => void
  onCompose: () => void
  isSyncing: boolean
}

export function PWAMailHeader({
  accountId,
  emailAccounts,
  onAccountChange,
  onSync,
  onCompose,
  isSyncing,
}: PWAMailHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const { globalFilters, updateGlobalFilter } = useEmailFiltersContext()

  const currentEmail = emailAccounts.find((a) => a.id === accountId)?.email_address
  const accountLabel =
    accountId === 'all'
      ? `Tous les comptes (${emailAccounts.length})`
      : currentEmail || 'Sélectionner un compte'

  const handleSearchChange = (value: string) => {
    updateGlobalFilter('search', value)
  }

  const handleAccountSelect = (id: string) => {
    onAccountChange(id)
    setAccountsOpen(false)
  }

  return (
    <header className="sticky top-0 z-40">
      {/* Blue gradient header - Premium Immersive style */}
      <div className="relative overflow-hidden bg-marque-grille py-4 px-4">
        {/* Floating orbs */}
        <div className="absolute top-2 right-8 w-16 h-16 rounded-full bg-card/5 blur-xl" />
        <div className="absolute bottom-0 left-4 w-12 h-12 rounded-full bg-cyan-400/10 blur-lg" />

        {/* Main header row */}
        <div className="relative flex items-center gap-3">
          {/* Icon + Title + Account Selector */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-card/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold tracking-tight text-white">Mail</h1>
              <button
                onClick={() => setAccountsOpen(true)}
                className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
              >
                <span className="truncate max-w-[180px]">{accountLabel}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </div>
          </div>

          {/* Actions - glassmorphism buttons */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(!searchOpen)}
            className="shrink-0 text-white hover:bg-card/10 hover:text-white"
            aria-label="Fermer"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSync}
            disabled={isSyncing}
            className="shrink-0 text-white hover:bg-card/10 hover:text-white disabled:text-white/50"
            aria-label="Actualiser"
          >
            <RefreshCw className={cn('h-5 w-5', isSyncing && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCompose}
            className="shrink-0 text-white hover:bg-card/10 hover:text-white"
            aria-label="Ajouter"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Expandable search bar - inside blue header */}
        {searchOpen && (
          <div className="relative mt-3">
            <Input
              type="search"
              placeholder="Rechercher dans les emails..."
              value={globalFilters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 rounded-xl bg-card/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30"
              autoFocus
            />
          </div>
        )}

        {/* SVG Wave at bottom */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-3 text-background"
          viewBox="0 0 1200 20"
          preserveAspectRatio="none"
        >
          <path d="M0,20 L0,8 Q300,0 600,8 T1200,8 L1200,20 Z" fill="currentColor" />
        </svg>
      </div>

      {/* Account selector Sheet */}
      <Sheet open={accountsOpen} onOpenChange={setAccountsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Sélectionner un compte</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            {/* "All accounts" option */}
            {emailAccounts.length > 1 && (
              <button
                onClick={() => handleAccountSelect('all')}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl transition-colors',
                  accountId === 'all' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                )}
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">Tous les comptes</p>
                  <p className="text-xs text-muted-foreground">{emailAccounts.length} comptes</p>
                </div>
                {accountId === 'all' && <Check className="h-5 w-5 text-primary" />}
              </button>
            )}

            {/* Individual accounts */}
            {emailAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => handleAccountSelect(account.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl transition-colors',
                  accountId === account.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                )}
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium uppercase">
                    {account.email_address.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium truncate">{account.email_address}</p>
                </div>
                {accountId === account.id && <Check className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
