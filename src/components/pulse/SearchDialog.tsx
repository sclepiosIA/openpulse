import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, MessageSquare, Calendar } from 'lucide-react';
import { usePulseSearch } from '@/hooks/pulse/usePulseSearch';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  onResultClick?: (messageId: string, conversationId: string) => void;
}

export function SearchDialog({
  open,
  onOpenChange,
  conversationId,
  onResultClick,
}: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const { results, total, isSearching, hasSearched, search, clearSearch } = usePulseSearch();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query, conversationId);
      } else {
        clearSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, conversationId, search, clearSearch]);

  // Clear on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      clearSearch();
    }
  }, [open, clearSearch]);

  const handleResultClick = useCallback((result: typeof results[0]) => {
    onResultClick?.(result.id, result.conversation_id);
    onOpenChange(false);
  }, [onResultClick, onOpenChange]);

  const getInitials = (nom: string, prenom: string) => {
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Rechercher dans les messages
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <ScrollArea className="flex-1 min-h-[300px] max-h-[400px]">
          {isSearching ? (
            <div className="space-y-3 p-2">
              {[1, 2, 3].map((i) => (
                <div key={`pulse-search-skeleton-${i}`} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Aucun message trouvé</p>
              <p className="text-xs mt-1">Essayez d'autres termes de recherche</p>
            </div>
          ) : (
            <div className="space-y-1">
              {hasSearched && (
                <p className="text-xs text-muted-foreground px-2 mb-2">
                  {total} résultat{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                </p>
              )}
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={result.user?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {result.user ? getInitials(result.user.nom, result.user.prenom) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {result.user ? `${result.user.prenom} ${result.user.nom}` : 'Inconnu'}
                      </span>
                      {result.conversation && !conversationId && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {result.conversation.name}
                        </Badge>
                      )}
                    </div>
                    <p
                      className="text-sm text-muted-foreground line-clamp-2"
                      // safe: DOMPurify.sanitize applied inline with strict allow-list (mark only)
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          result.content_highlighted
                            .replace(/\*\*(.*?)\*\*/g, '<mark class="bg-primary/20 text-primary font-medium rounded px-0.5">$1</mark>'),
                          { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: ['class'] }
                        )
                      }}
                    />
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(result.created_at), 'PPp', { locale: fr })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
