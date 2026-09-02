import { Mail, Search, X, ChevronDown, Check, Inbox, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMobileDrawer } from "@/contexts/MobileDrawerContext";

interface MobileEmailHeaderProps {
  accountEmail?: string;
  unreadCount: number;
  totalCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  emailAccounts: Array<{ id: string; email_address: string; display_name?: string | null }>;
  currentAccountId: string;
  onAccountChange: (accountId: string) => void;
  showGlobalNav?: boolean;
}

export function MobileEmailHeader({
  accountEmail,
  unreadCount,
  searchValue,
  onSearchChange,
  emailAccounts,
  currentAccountId,
  onAccountChange,
  showGlobalNav = true,
}: MobileEmailHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const { open: openMobileDrawer } = useMobileDrawer();

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
      {/* Main Header */}
      <div className="flex items-center gap-2 px-3 py-3">
        {/* Hamburger Menu Button - only if showGlobalNav */}
        {showGlobalNav && (
          <button
            onClick={openMobileDrawer}
            className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl hover:bg-accent transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Icon + Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Inbox className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight">Mail</h1>
            <button 
              onClick={() => setAccountsOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="truncate max-w-[120px]">
                {currentAccountId === 'all' ? "Tous les comptes" : (accountEmail || "Aucun compte")}
              </span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {unreadCount}
                </span>
              )}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          </div>
        </div>

        {/* Search Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchOpen(!searchOpen)}
          className={cn("h-9 w-9 rounded-xl", searchOpen && "bg-accent")} aria-label="Fermer">
          {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les emails..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10 h-10"
              autoFocus
            />
            {searchValue && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => onSearchChange("")} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Account Selector Sheet */}
      <Sheet open={accountsOpen} onOpenChange={setAccountsOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Comptes email
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {emailAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun compte configuré
              </p>
            ) : (
              <>
                {/* All accounts option */}
                {emailAccounts.length > 1 && (
                  <button
                    onClick={() => {
                      onAccountChange('all');
                      setAccountsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                      currentAccountId === 'all' 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-accent"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Tous les comptes</p>
                      <p className="text-xs text-muted-foreground">
                        {emailAccounts.length} comptes synchronisés
                      </p>
                    </div>
                    {currentAccountId === 'all' && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                )}
                {emailAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      onAccountChange(account.id);
                      setAccountsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                      currentAccountId === account.id 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-accent"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {account.email_address}
                      </p>
                      {account.display_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {account.display_name}
                        </p>
                      )}
                    </div>
                    {currentAccountId === account.id && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
