import { useState, useCallback, useEffect, useRef } from 'react';
import { invokeEdge } from "@/services/edgeFunctions";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Sparkles,
  Building2,
  Mail,
  CheckSquare,
  Users,
  Calendar,
  ExternalLink,
  Search,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface AISearchSource {
  index: number;
  type: string;
  id: string;
  title: string;
  href: string;
  etablissement?: string;
}

interface AISearchResult {
  overview: string;
  sources: AISearchSource[];
  query: string;
}

interface AISearchOverviewProps {
  query: string;
  onClose: () => void;
}

const sourceTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  email: { icon: Mail, label: 'Email', color: 'text-sky-600 bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300' },
  etablissement: { icon: Building2, label: 'Établissement', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300' },
  tache: { icon: CheckSquare, label: 'Tâche', color: 'text-amber-600 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300' },
  contact: { icon: Users, label: 'Contact', color: 'text-pink-600 bg-pink-100 dark:bg-pink-950/40 dark:text-pink-300' },
  event: { icon: Calendar, label: 'Événement', color: 'text-violet-600 bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300' },
};

export function AISearchOverview({ query, onClose }: AISearchOverviewProps) {
  const [result, setResult] = useState<AISearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await invokeEdge<any>('ai-search-overview', { query: searchQuery.trim() });
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la recherche IA');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasTriggered = useRef(false);
  
  useEffect(() => {
    if (query.trim().length >= 3 && !hasTriggered.current) {
      hasTriggered.current = true;
      doSearch(query);
    }
  }, [query, doSearch]);

  const handleSourceClick = (source: AISearchSource) => {
    onClose();
    navigate(source.href);
  };

  // Render overview with clickable citation references [N]
  const renderOverview = (text: string, sources: AISearchSource[]) => {
    // Replace [N] with clickable badges
    const parts = text.split(/(\[\d+\])/g);
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {parts.map((part, i) => {
          const citationMatch = part.match(/^\[(\d+)\]$/);
          if (citationMatch) {
            const idx = parseInt(citationMatch[1]);
            const source = sources.find(s => s.index === idx);
            if (source) {
              const config = sourceTypeConfig[source.type];
              return (
                <button
                  key={`ai-search-citation-${idx}-${i}`}
                  onClick={() => handleSourceClick(source)}
                  className={cn(
                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-md mx-0.5 cursor-pointer transition-all hover:scale-105 hover:shadow-sm align-baseline",
                    config?.color || 'text-muted-foreground bg-muted'
                  )}
                  title={`${source.title} — Cliquer pour ouvrir`}
                >
                  {idx}
                </button>
              );
            }
          }
          // Render markdown for non-citation parts
          return (
            <ReactMarkdown
              key={`ai-search-markdown-${i}`}
              components={{
                p: ({ children }) => <span>{children}</span>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              }}
            >
              {part}
            </ReactMarkdown>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[60vh] max-h-[600px] w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Overview</h3>
            <p className="text-xs text-muted-foreground">
              Synthèse IA pour « {query} »
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <Loader2 className="h-14 w-14 absolute -top-1 -left-1 animate-spin text-primary/30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Analyse en cours…</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recherche dans les emails, établissements, tâches et contacts
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Erreur</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => doSearch(query)}
                >
                  Réessayer
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isLoading && (
            <>
              {/* Overview card */}
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Synthèse IA
                  </span>
                </div>
                <div className="text-sm leading-relaxed text-foreground">
                  {renderOverview(result.overview, result.sources)}
                </div>
              </div>

              {/* Sources */}
              {result.sources.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    Sources ({result.sources.length})
                  </h4>
                  <div className="grid gap-1.5">
                    {result.sources.map((source) => {
                      const config = sourceTypeConfig[source.type] || { icon: Search, label: source.type, color: 'text-muted-foreground bg-muted' };
                      const Icon = config.icon;

                      return (
                        <button
                          key={`${source.type}-${source.id}`}
                          onClick={() => handleSourceClick(source)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/60 hover:bg-accent hover:border-primary/20 transition-all text-left group w-full"
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px] font-bold px-1.5 py-0 h-5 rounded-md border-0",
                              config.color
                            )}
                          >
                            {source.index}
                          </Badge>
                          <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", config.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{source.title}</p>
                            {source.etablissement && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Building2 className="h-3 w-3" />
                                {source.etablissement}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty state - no query */}
          {!hasSearched && !isLoading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Tapez votre recherche</p>
              <p className="text-xs text-muted-foreground mt-1">
                L'IA analysera vos emails, établissements, tâches et contacts
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
