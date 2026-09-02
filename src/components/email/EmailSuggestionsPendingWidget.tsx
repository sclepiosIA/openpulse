import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEmailSuggestionsPending } from "@/hooks/email/useEmailSuggestionsPending";
import { useEtablissementEmailSuggestions } from "@/hooks/crm/useEtablissementEmailSuggestions";
import { AlertCircle, Loader2, ChevronDown, PlusCircle, Link, Mail, GitBranch } from "lucide-react";
import { useState } from "react";
import { EmailSuggestionCard } from "./EmailSuggestionCard";

export function EmailSuggestionsPendingWidget() {
  const { data: suggestions, isLoading } = useEmailSuggestionsPending();
  const { acceptSuggestion, rejectSuggestion, isAccepting, isRejecting } =
    useEtablissementEmailSuggestions();
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem('ai-suggestions-widget-open');
    return stored ? stored === 'true' : false;
  });

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem('ai-suggestions-widget-open', String(open));
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  // Grouper par type de suggestion
  const createNewSuggestions = suggestions.filter(s => s.suggestion_type === 'create_new');
  const linkExistingSuggestions = suggestions.filter(s => s.suggestion_type === 'link_existing');
  const domainMatchSuggestions = suggestions.filter(s => s.suggestion_type === 'domain_match');
  const multiEntitySuggestions = suggestions.filter(s => s.suggestion_type === 'multi_entity');
  const needsReviewSuggestions = suggestions.filter(s => s.suggestion_type === 'needs_review');
  const otherSuggestions = suggestions.filter(s => 
    !['create_new', 'link_existing', 'domain_match', 'multi_entity', 'needs_review'].includes(s.suggestion_type)
  );

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <Card className="p-6 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <div className="space-y-4">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1 text-left">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-100 cursor-help">
                        Suggestions d'établissements
                      </h3>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        L'IA a détecté des établissements de santé potentiels à partir des emails
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} en attente
                </p>
              </div>
              <ChevronDown className="h-5 w-5 text-amber-600 dark:text-amber-400 transition-transform duration-200 data-[state=open]:rotate-180 flex-shrink-0" />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-4 pt-2">
              {/* Suggestions pour créer un nouvel établissement */}
              {createNewSuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Nouveaux établissements à créer ({createNewSuggestions.length})
                  </h4>
                  <div className="space-y-2">
                    {createNewSuggestions.slice(0, 3).map((suggestion) => (
                      <EmailSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={acceptSuggestion}
                        onReject={rejectSuggestion}
                        isAccepting={isAccepting}
                        isRejecting={isRejecting}
                      />
                    ))}
                    {createNewSuggestions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{createNewSuggestions.length - 3} autre{createNewSuggestions.length - 3 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Suggestions pour lier à un établissement existant */}
              {linkExistingSuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    Emails à lier ({linkExistingSuggestions.length})
                  </h4>
                  <div className="space-y-2">
                    {linkExistingSuggestions.slice(0, 3).map((suggestion) => (
                      <EmailSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={acceptSuggestion}
                        onReject={rejectSuggestion}
                        isAccepting={isAccepting}
                        isRejecting={isRejecting}
                      />
                    ))}
                    {linkExistingSuggestions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{linkExistingSuggestions.length - 3} autre{linkExistingSuggestions.length - 3 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Suggestions basées sur les domaines */}
              {domainMatchSuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Correspondances de domaine ({domainMatchSuggestions.length})
                  </h4>
                  <div className="space-y-2">
                    {domainMatchSuggestions.slice(0, 3).map((suggestion) => (
                      <EmailSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={acceptSuggestion}
                        onReject={rejectSuggestion}
                        isAccepting={isAccepting}
                        isRejecting={isRejecting}
                      />
                    ))}
                    {domainMatchSuggestions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{domainMatchSuggestions.length - 3} autre{domainMatchSuggestions.length - 3 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Suggestions multi-entités */}
              {multiEntitySuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Plusieurs entités détectées ({multiEntitySuggestions.length})
                  </h4>
                  <div className="space-y-2">
                    {multiEntitySuggestions.slice(0, 3).map((suggestion) => (
                      <EmailSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={acceptSuggestion}
                        onReject={rejectSuggestion}
                        isAccepting={isAccepting}
                        isRejecting={isRejecting}
                      />
                    ))}
                    {multiEntitySuggestions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{multiEntitySuggestions.length - 3} autre{multiEntitySuggestions.length - 3 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Suggestions nécessitant une révision */}
              {needsReviewSuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    À réviser manuellement ({needsReviewSuggestions.length})
                  </h4>
                  <div className="space-y-2">
                    {needsReviewSuggestions.slice(0, 3).map((suggestion) => (
                      <EmailSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={acceptSuggestion}
                        onReject={rejectSuggestion}
                        isAccepting={isAccepting}
                        isRejecting={isRejecting}
                      />
                    ))}
                    {needsReviewSuggestions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{needsReviewSuggestions.length - 3} autre{needsReviewSuggestions.length - 3 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Autres suggestions */}
              {otherSuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Autres suggestions ({otherSuggestions.length})
                  </h4>
                  <div className="space-y-2">
                    {otherSuggestions.slice(0, 3).map((suggestion) => (
                      <EmailSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={acceptSuggestion}
                        onReject={rejectSuggestion}
                        isAccepting={isAccepting}
                        isRejecting={isRejecting}
                      />
                    ))}
                    {otherSuggestions.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{otherSuggestions.length - 3} autre{otherSuggestions.length - 3 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Card>
    </Collapsible>
  );
}