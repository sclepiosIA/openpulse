import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePartenaireAISuggestions } from "@/hooks/crm/usePartenaireAISuggestions";
import {
  CheckCircle,
  XCircle,
  Sparkles,
  FileText,
  TrendingUp,
  ChevronDown,
  Mail,
  Clock,
  BarChart,
  Users,
  DollarSign,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

interface PartenaireAISuggestionsPanelProps {
  partenaireId: string;
}

export function PartenaireAISuggestionsPanel({ partenaireId }: PartenaireAISuggestionsPanelProps) {
  const { suggestions, isLoading, approveSuggestion, rejectSuggestion, isApproving, isRejecting } = 
    usePartenaireAISuggestions(partenaireId);
  
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem('partenaire-ai-suggestions-panel-open');
    return stored ? stored === 'true' : false;
  });

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem('partenaire-ai-suggestions-panel-open', String(open));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Suggestions IA CRM
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
      case 'send_email_response':
        return <Mail className="h-4 w-4" />;
      case 'schedule_follow_up':
        return <Clock className="h-4 w-4" />;
      case 'update_engagement_score':
        return <BarChart className="h-4 w-4" />;
      case 'create_activity_note':
        return <FileText className="h-4 w-4" />;
      case 'change_relation_status':
        return <TrendingUp className="h-4 w-4" />;
      case 'suggest_meeting':
        return <Users className="h-4 w-4" />;
      case 'update_partnership_value':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'send_email_response':
        return "Réponse email suggérée";
      case 'schedule_follow_up':
        return "Planifier un suivi";
      case 'update_engagement_score':
        return "Mise à jour score engagement";
      case 'create_activity_note':
        return "Créer une note d'activité";
      case 'change_relation_status':
        return "Changer statut relation";
      case 'suggest_meeting':
        return "Suggérer une réunion";
      case 'update_partnership_value':
        return "Mettre à jour valeur partenariat";
      default:
        return "Action IA";
    }
  };

  const getActionDescription = (suggestion: any) => {
    switch (suggestion.action_type) {
      case 'send_email_response':
        return `Envoyer : "${suggestion.action_data.subject?.substring(0, 60)}..."`;
      case 'schedule_follow_up':
        return `Suivi le ${suggestion.action_data.follow_up_date} : ${suggestion.action_data.follow_up_reason}`;
      case 'update_engagement_score':
        return `Score : ${suggestion.action_data.new_score}/100`;
      case 'create_activity_note':
        return `Note : ${suggestion.action_data.note_content?.substring(0, 80)}...`;
      case 'change_relation_status':
        return `Nouveau statut : ${suggestion.action_data.new_relation_status}`;
      case 'suggest_meeting':
        return `Réunion : ${suggestion.action_data.meeting_objective}`;
      case 'update_partnership_value':
        return `Valeur : ${suggestion.action_data.new_value}€`;
      default:
        return "Action suggérée";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <Card className="border-purple-500 bg-purple-50/50 dark:bg-purple-950/20">
        <CardHeader>
          <CollapsibleTrigger className="w-full">
            <CardTitle className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <span className="flex-1 text-left">{suggestions.length} Suggestion{suggestions.length > 1 ? 's' : ''} IA CRM en attente</span>
              <ChevronDown className="h-5 w-5 text-purple-600 transition-transform duration-200 data-[state=open]:rotate-180 flex-shrink-0" />
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {suggestions.map((suggestion) => (
              <Card key={suggestion.id} className="border-purple-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {getActionIcon(suggestion.action_type)}
                      <div>
                        <h4 className="font-semibold text-sm">{getActionLabel(suggestion.action_type)}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getActionDescription(suggestion)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {Math.round(suggestion.confidence_score * 100)}% confiance
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="bg-muted/50 p-3 rounded-md mb-3">
                    <p className="text-sm">
                      <strong>Raison:</strong> {suggestion.reason}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Suggéré {formatDistanceToNow(new Date(suggestion.created_at), { 
                        addSuffix: true, 
                        locale: fr 
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveSuggestion(suggestion.id)}
                      disabled={isApproving || isRejecting}
                      size="sm"
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Appliquer
                    </Button>
                    <Button
                      onClick={() => rejectSuggestion(suggestion.id)}
                      disabled={isApproving || isRejecting}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Ignorer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
