import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  RefreshCw,
  ArrowUpDown,
  X,
  Mail,
  MailOpen,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LastSyncIndicator } from "./LastSyncIndicator";

interface EmailInboxToolbarConsolidatedProps {
  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  
  // Filters
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  category: string | null;
  onCategoryChange: (value: string | null) => void;
  
  // Sort
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  
  // Stats
  totalCount: number;
  unreadCount: number;
  
  // Actions
  onSync?: () => void;
  onCompose?: () => void;
  onResetFilters?: () => void;
  
  // States
  isSyncing?: boolean;
  hasActiveFilters?: boolean;
  lastSyncAt?: string | null;
  
  // Slot
  prefixSlot?: React.ReactNode;
}

const CATEGORIES = [
  { value: "Commercial", label: "Commercial" },
  { value: "Support", label: "Support" },
  { value: "Technique", label: "Technique" },
  { value: "Administratif", label: "Administratif" },
  { value: "Contractuel", label: "Contractuel" },
  { value: "Formation", label: "Formation" },
];

export function EmailInboxToolbarConsolidated({
  searchValue,
  onSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
  category,
  onCategoryChange,
  sortOrder,
  onSortOrderChange,
  totalCount,
  unreadCount,
  onSync,
  onCompose,
  onResetFilters,
  isSyncing = false,
  hasActiveFilters = false,
  lastSyncAt,
  prefixSlot,
}: EmailInboxToolbarConsolidatedProps) {
  return (
    <div className="space-y-3 p-4 border-b bg-background/50">
      {/* Main toolbar row - 3 zones */}
      <div className="flex items-center gap-4">
        {/* Optional prefix slot (e.g. view toggle) */}
        {prefixSlot}
        {/* Zone gauche: Stats */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <span className="text-sm font-medium">
            {totalCount} conversation{totalCount !== 1 ? 's' : ''}
          </span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} non lu{unreadCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Zone centre: Recherche */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les emails..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10 h-10"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => onSearchChange("")} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Zone droite: Actions principales */}
        <div className="flex items-center gap-2 shrink-0">
          {onSync && (
            <div className="flex items-center gap-2">
              <LastSyncIndicator lastSyncAt={lastSyncAt ?? null} />
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={onSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                <span className="hidden sm:inline">Synchroniser</span>
              </Button>
            </div>
          )}

          {onCompose && (
            <Button size="sm" className="h-9" onClick={onCompose}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          )}
        </div>
      </div>

      {/* Secondary row: Filters + Sort */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Unread filter */}
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onUnreadOnlyChange(!unreadOnly)}
          >
            {unreadOnly ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            Non lus
            {unreadCount > 0 && (
              <Badge 
                variant={unreadOnly ? "secondary" : "outline"} 
                className="h-5 px-1.5 text-xs ml-1"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>

          {/* Category filter */}
          <Select value={category || "all"} onValueChange={(v) => onCategoryChange(v === "all" ? null : v)}>
            <SelectTrigger className="h-8 w-auto min-w-[130px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset filters */}
          {hasActiveFilters && onResetFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground" 
              onClick={onResetFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Réinitialiser
            </Button>
          )}
        </div>

        {/* Sort + Mobile stats */}
        <div className="flex items-center gap-3">
          {/* Mobile stats */}
          <span className="lg:hidden text-xs text-muted-foreground">
            {totalCount} email{totalCount !== 1 ? 's' : ''}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortOrder === 'desc' ? 'Plus récent' : 'Plus ancien'}
          </Button>
        </div>
      </div>
    </div>
  );
}
