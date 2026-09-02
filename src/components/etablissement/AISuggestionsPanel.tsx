import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAISuggestions } from "@/hooks/ai/useAISuggestions";
import { CheckCircle, XCircle, Sparkles, Calendar, FileText, TrendingUp, ChevronDown, Mail, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

interface AISuggestionsPanelProps {
  etablissementId: string;
  filterType?: 'crm' | 'operational';
}

export function AISuggestionsPanel({ etablissementId, filterType }: AISuggestionsPanelProps) {
  const { 
    suggestions, 
    suggestionGroups, 
    isLoading, 
    approveSuggestion, 
    rejectSuggestion, 
    approveSuggestionAndRejectSimilar,
    isApproving, 
    isRejecting 
  } = useAISuggestions(etablissementId, filterType);
  
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Suggestions IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'update_task':
        return <CheckCircle className="h-4 w-4" />;
      case 'create_task':
        return <Calendar className="h-4 w-4" />;
      case 'change_status':
        return <TrendingUp className="h-4 w-4" />;
      case 'update_summary':
        return <FileText className="h-4 w-4" />;
      case 'send_email_response':
        return <Mail className="h-4 w-4" />;
      case 'schedule_follow_up':
        return <Clock className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'update_task':
        return "Mise à jour de tâche";
      case 'create_task':
        return "Création de tâche";
      case 'change_status':
        return "Changement de statut";
      case 'update_summary':
        return "Mise à jour du résumé";
      case 'send_email_response':
        return "Réponse email suggérée";
      case 'schedule_follow_up':
        return "Planifier un suivi";
      default:
        return "Action IA";
    }
  };

  const getActionDescription = (suggestion: any) => {
    switch (suggestion.action_type) {
      case 'update_task':
        return `Marquer la tâche comme "${suggestion.action_data.new_status}"`;
      case 'create_task':
        return `Créer la tâche: ${suggestion.action_data.title}`;
      case 'change_status':
        return `Changer le statut vers "${suggestion.action_data.new_status}"`;
      case 'update_summary':
        return "Mettre à jour le résumé des échanges";
      case 'send_email_response':
        return `Envoyer : "${suggestion.action_data.subject?.substring(0, 60)}..."`;
      case 'schedule_follow_up':
        return `Suivi : ${suggestion.action_data.follow_up_reason}`;
      default:
        return "Action suggérée";
    }
  };

  const panelTitle = filterType === 'crm' 
    ? `${suggestions.length} Suggestion${suggestions.length > 1 ? 's' : ''} CRM en attente`
    : filterType === 'operational'
    ? `${suggestions.length} Suggestion${suggestions.length > 1 ? 's' : ''} opérationnelle${suggestions.length > 1 ? 's' : ''} en attente`
    : `${suggestions.length} Suggestion${suggestions.length > 1 ? 's' : ''} IA en attente`;

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <Card className="border-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CollapsibleTrigger className="w-full">
            <CardTitle className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <span className="flex-1 text-left">{panelTitle}</span>
              <ChevronDown className="h-5 w-5 text-blue-600 transition-transform duration-200 data-[state=open]:rotate-180 flex-shrink-0" />
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {suggestionGroups.map((group) => {
              const hasSimilar = group.similar.length > 0;
              const isExpanded = expandedGroups.has(group.primary.id);
              
              return (
                <Card key={group.primary.id} className="border-blue-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1">
                        {getActionIcon(group.primary.action_type)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{getActionLabel(group.primary.action_type)}</h4>
                            {hasSimilar && (
                              <Badge variant="outline" className="text-xs">
                                +{group.similar.length} similaire{group.similar.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {getActionDescription(group.primary)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {Math.round(group.primary.confidence_score * 100)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="bg-muted/50 p-3 rounded-md mb-3">
                      <p className="text-sm">
                        <strong>Raison:</strong> {group.primary.reason}
                      </p>
                      {group.primary.email_thread?.subject && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate max-w-[300px]">
                            Mail : {group.primary.email_thread.subject}
                          </span>
                          {group.primary.email_thread.last_message_date && (
                            <span className="ml-2 whitespace-nowrap">
                              ({formatDistanceToNow(new Date(group.primary.email_thread.last_message_date), { 
                                addSuffix: true, 
                                locale: fr 
                              })})
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Suggéré {formatDistanceToNow(new Date(group.primary.created_at), { 
                          addSuffix: true, 
                          locale: fr 
                        })}
                      </p>
                    </div>

                    {/* Afficher les suggestions similaires si développé */}
                    {hasSimilar && isExpanded && (
                      <div className="mb-3 p-3 bg-muted/30 rounded-md border border-dashed">
                        <p className="text-xs font-medium mb-2">Suggestions similaires :</p>
                        {group.similar.map((sim) => (
                          <div key={sim.id} className="text-xs text-muted-foreground mb-1 pl-2 border-l-2">
                            • {sim.action_data?.title || getActionDescription(sim)}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveSuggestion(group.primary.id)}
                        disabled={isApproving || isRejecting}
                        size="sm"
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Appliquer
                      </Button>
                      {hasSimilar && (
                        <Button
                          onClick={() => approveSuggestionAndRejectSimilar({
                            primaryId: group.primary.id,
                            similarIds: group.similar.map(s => s.id)
                          })}
                          disabled={isApproving || isRejecting}
                          size="sm"
                          variant="default"
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Appliquer & ignorer {group.similar.length}
                        </Button>
                      )}
                      <Button
                        onClick={() => rejectSuggestion(group.primary.id)}
                        disabled={isApproving || isRejecting}
                        variant="outline"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Ignorer
                      </Button>
                      {hasSimilar && (
                        <Button
                          onClick={() => toggleGroup(group.primary.id)}
                          variant="ghost"
                          size="sm"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
