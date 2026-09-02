import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, CheckCircle, XCircle, Building2, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailSuggestion {
  id: string;
  suggestion_type: string;
  match_confidence: number;
  suggested_etablissement_id?: string | null;
  created_at: string;
  derived_domains?: string[];
  display_etab_name?: string;
  display_etab_ville?: string;
  email_thread?: {
    subject: string;
    ai_summary?: string;
    last_message_date: string;
  };
}

interface EmailSuggestionCardProps {
  suggestion: EmailSuggestion;
  onAccept: (args: { suggestionId: string; createNew?: boolean }) => void;
  onReject: (suggestionId: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

export function EmailSuggestionCard({ 
  suggestion, 
  onAccept, 
  onReject, 
  isAccepting, 
  isRejecting 
}: EmailSuggestionCardProps) {
  const domains = suggestion.derived_domains || [];
  const etablissementName = suggestion.display_etab_name;
  const etablissementVille = suggestion.display_etab_ville;
  const aiSummary = suggestion.email_thread?.ai_summary;
  const subject = suggestion.email_thread?.subject || '(Sans objet)';
  const confidence = suggestion.match_confidence;
  
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      create_new: 'Créer nouveau',
      link_existing: 'Lier existant',
      domain_match: 'Match domaine',
      multi_entity: 'Multi-entité',
      needs_review: 'À réviser',
    };
    return labels[type] || type;
  };

  const getActionButton = () => {
    if (suggestion.suggestion_type === 'create_new') {
      return (
        <Button
          size="sm"
          onClick={() => onAccept({ suggestionId: suggestion.id, createNew: true })}
          disabled={isAccepting || isRejecting}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Créer
        </Button>
      );
    }
    
    if ((suggestion.suggestion_type === 'link_existing' || 
         suggestion.suggestion_type === 'needs_review') && 
        suggestion.suggested_etablissement_id) {
      return (
        <Button
          size="sm"
          onClick={() => onAccept({ suggestionId: suggestion.id, createNew: false })}
          disabled={isAccepting || isRejecting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Valider
        </Button>
      );
    }

    return null;
  };

  return (
    <Card className="p-4 border-l-4 border-l-amber-500">
      <div className="flex flex-col gap-3">
        {/* Badges en haut */}
        <div className="flex flex-wrap gap-2">
          {/* Badges domaines */}
          {domains.length > 0 && (
            <>
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
                <Mail className="h-3 w-3 mr-1" />
                {domains[0]}
              </Badge>
              {domains.length > 1 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">
                        +{domains.length - 1}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        {domains.slice(1).map((d: string) => (
                          <div key={d}>{d}</div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
          {domains.length === 0 && (
            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900">
              Domaine inconnu
            </Badge>
          )}
          
          {/* Badge établissement */}
          {etablissementName && (
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
              <Building2 className="h-3 w-3 mr-1" />
              <span className="font-semibold">{etablissementName}</span>
              {etablissementVille && <span className="ml-1">({etablissementVille})</span>}
            </Badge>
          )}
          
          {/* Badge type */}
          <Badge variant="secondary">
            {getTypeLabel(suggestion.suggestion_type)}
          </Badge>
          
          {/* Badge confidence */}
          {confidence && (
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950">
              {Math.round(confidence * 100)}%
            </Badge>
          )}
        </div>

        {/* Sujet avec tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm font-medium truncate cursor-help">
                {subject}
              </p>
            </TooltipTrigger>
            {aiSummary && (
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  {aiSummary.length > 180 
                    ? `${aiSummary.substring(0, 180)}...` 
                    : aiSummary}
                </p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Date */}
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(suggestion.email_thread?.last_message_date || suggestion.created_at), {
            addSuffix: true,
            locale: fr,
          })}
        </p>

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          {/* Bouton Voir */}
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Eye className="h-4 w-4 mr-1" />
                Voir
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Détails de la suggestion</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Sujet</h4>
                  <p className="text-sm">{subject}</p>
                </div>
                {aiSummary && (
                  <div>
                    <h4 className="font-semibold mb-2">Résumé de l'email</h4>
                    <p className="text-sm whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                )}
                {!aiSummary && (
                  <div>
                    <h4 className="font-semibold mb-2">Résumé de l'email</h4>
                    <p className="text-sm text-muted-foreground">Aucun résumé disponible</p>
                  </div>
                )}
                {domains.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Domaines détectés</h4>
                    <div className="flex flex-wrap gap-2">
                      {domains.map((d: string) => (
                        <Badge key={d} variant="outline">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {etablissementName && (
                  <div>
                    <h4 className="font-semibold mb-2">Établissement suggéré</h4>
                    <p className="text-sm">
                      {etablissementName}
                      {etablissementVille && ` - ${etablissementVille}`}
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Bouton d'action principal */}
          {getActionButton()}

          {/* Bouton rejeter */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(suggestion.id)}
            disabled={isAccepting || isRejecting}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Rejeter
          </Button>
        </div>
      </div>
    </Card>
  );
}
