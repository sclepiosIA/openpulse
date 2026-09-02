import { useState } from 'react'
import { Menu, Mail, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

interface EmailAccount {
  id: string
  email_address: string
  display_name?: string | null
}

interface MobileEmailNavigationProps {
  currentTab: string
  onTabChange: (tab: string) => void
  pendingCount: number
  emailAccounts: EmailAccount[]
  currentAccountId: string
  onAccountChange: (accountId: string) => void
}

const navigationSections = [
  { value: 'inbox', label: 'Boîte de réception' },
  { value: 'folders', label: 'Dossiers' },
  { value: 'classification', label: 'Classification' },
  { value: 'etablissements', label: 'Par établissement' },
  { value: 'drafts', label: 'Brouillons' },
  { value: 'settings', label: 'Paramètres', hasBadge: true },
]

export function MobileEmailNavigation({
  currentTab,
  onTabChange,
  pendingCount,
  emailAccounts,
  currentAccountId,
  onAccountChange,
}: MobileEmailNavigationProps) {
  const [open, setOpen] = useState(false)

  const handleTabChange = (tab: string) => {
    onTabChange(tab)
    setOpen(false)
  }

  const handleAccountChange = (accountId: string) => {
    onAccountChange(accountId)
    setOpen(false)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Navigation</DrawerTitle>
          <DrawerDescription>Accédez aux différentes sections et comptes emails</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 py-2 px-4 pb-8 max-h-[70vh] overflow-y-auto">
          {/* Email Accounts Section */}
          {emailAccounts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground px-4">
                Comptes synchronisés ({emailAccounts.length})
              </h3>
              <div className="space-y-1">
                {emailAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => handleAccountChange(account.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-md transition-colors ${
                      currentAccountId === account.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{account.email_address}</p>
                      {account.display_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {account.display_name}
                        </p>
                      )}
                    </div>
                    {currentAccountId === account.id && <Check className="h-4 w-4 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Sections */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground px-4">Sections</h3>
            <div className="space-y-1">
              {navigationSections.map((section) => (
                <button
                  key={section.value}
                  onClick={() => handleTabChange(section.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-md transition-colors ${
                    currentTab === section.value
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span>{section.label}</span>
                  {section.hasBadge && pendingCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {pendingCount}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
