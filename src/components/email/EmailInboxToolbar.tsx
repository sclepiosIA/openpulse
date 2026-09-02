import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Mail, Paperclip, Archive, ListFilter } from "lucide-react";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";

interface EmailInboxToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: 'desc' | 'asc';
  onSortChange: (order: 'desc' | 'asc') => void;
  showUnreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  showWithAttachmentsOnly: boolean;
  onWithAttachmentsChange: (value: boolean) => void;
  showArchivedOnly: boolean;
  onArchivedOnlyChange: (value: boolean) => void;
  unreadCount: number;
  attachmentCount: number;
  archivedCount: number;
  onCompose: () => void;
}

export function EmailInboxToolbar({
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  showUnreadOnly,
  onUnreadOnlyChange,
  showWithAttachmentsOnly,
  onWithAttachmentsChange,
  showArchivedOnly,
  onArchivedOnlyChange,
  unreadCount,
  attachmentCount,
  archivedCount,
  onCompose,
}: EmailInboxToolbarProps) {
  const [searchInput, setSearchInput] = useState(searchQuery);
  const debouncedSearch = useDebouncedValue(searchInput, 500);

  useEffect(() => {
    onSearchChange(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);

  return (
    <div className="space-y-4 pb-4 border-b">
      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les emails..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Rechercher dans les emails"
          />
        </div>
        <Button 
          onClick={onCompose} 
          className="shrink-0"
          aria-label="Composer un nouvel email"
          aria-keyshortcuts="c"
        >
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Nouveau message
        </Button>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListFilter className="h-4 w-4" />
          <span>Filtres:</span>
        </div>
        
        <Badge
          variant={showUnreadOnly ? "default" : "outline"}
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => onUnreadOnlyChange(!showUnreadOnly)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onUnreadOnlyChange(!showUnreadOnly);
            }
          }}
          aria-label={`Filtrer les emails non lus${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          aria-pressed={showUnreadOnly}
        >
          Non lus
          {unreadCount > 0 && <span className="ml-1 font-semibold">({unreadCount})</span>}
        </Badge>

        <Badge
          variant={showWithAttachmentsOnly ? "default" : "outline"}
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => onWithAttachmentsChange(!showWithAttachmentsOnly)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onWithAttachmentsChange(!showWithAttachmentsOnly);
            }
          }}
          aria-label={`Filtrer les emails avec pièces jointes${attachmentCount > 0 ? ` (${attachmentCount})` : ''}`}
          aria-pressed={showWithAttachmentsOnly}
        >
          <Paperclip className="mr-1 h-3 w-3" aria-hidden="true" />
          Avec PJ
          {attachmentCount > 0 && <span className="ml-1 font-semibold">({attachmentCount})</span>}
        </Badge>

        <Badge
          variant={showArchivedOnly ? "default" : "outline"}
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => onArchivedOnlyChange(!showArchivedOnly)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onArchivedOnlyChange(!showArchivedOnly);
            }
          }}
          aria-label={`Filtrer les emails archivés${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
          aria-pressed={showArchivedOnly}
        >
          <Archive className="mr-1 h-3 w-3" aria-hidden="true" />
          Archivés
          {archivedCount > 0 && <span className="ml-1 font-semibold">({archivedCount})</span>}
        </Badge>

        <div className="ml-auto">
          <Select value={sortOrder} onValueChange={(v) => onSortChange(v as 'desc' | 'asc')}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Trier par..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Plus récent d'abord</SelectItem>
              <SelectItem value="asc">Plus ancien d'abord</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
