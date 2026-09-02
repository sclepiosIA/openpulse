import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Mail, Building2, Calendar, User, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { EmailSuggestion } from "@/hooks/crm/useEtablissementEmailSuggestions";
import { sanitizeEmailSubject } from "@/lib/emailUtils";

interface EmailToEtablissementSuggestionCardProps {
  suggestion: EmailSuggestion;
  onAccept: (args: { suggestionId: string; createNew?: boolean }) => void;
  onReject: (suggestionId: string) => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
}

export function EmailToEtablissementSuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: EmailToEtablissementSuggestionCardProps) {
  const isCreateNew = suggestion.suggestion_type === 'create_new';
  const confidence = suggestion.match_confidence ? Math.round(suggestion.match_confidence * 100) : null;
  
  // Détecter domaines génériques suspects
  const extractedDomain = suggestion.extracted_data?.domain?.toLowerCase() || '';
  const genericDomains = ['gmail.com', 'outlook.com', 'yahoo.fr', 'hotmail.com', 
                          'free.fr', 'orange.fr', 'wanadoo.fr', 'laposte.net'];
  const isGenericDomain = genericDomains.some(d => extractedDomain.includes(d));
  
  // Détecter domaines santé
  const healthKeywords = ['chu-', 'ch-', 'ght-', 'clinique', 'hopital', 'hospital', 
                          'ehpad', 'espic', 'polyclinique', 'sante', 'medical'];
  const isHealthDomain = healthKeywords.some(kw => extractedDomain.includes(kw));

  return (
    <Card className="border-l-4" style={{ borderLeftColor: isCreateNew ? 'hsl(var(--primary))' : 'hsl(var(--accent))' }}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                {sanitizeEmailSubject(suggestion.email_thread?.subject)}
              </CardTitle>
              <Badge variant={isCreateNew ? "default" : "secondary"}>
                {isCreateNew ? 'Nouveau prospect' : 'Lier à établissement'}
              </Badge>
              {confidence && (
                <Badge 
                  variant={confidence >= 80 ? "default" : confidence >= 60 ? "outline" : "destructive"}
                  className="gap-1"
                >
                  <TrendingUp className="h-3 w-3" />
                  Confiance: {confidence}%
                </Badge>
              )}
              {isHealthDomain && (
                <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                  <Building2 className="h-3 w-3" />
                  Domaine santé
                </Badge>
              )}
              {isGenericDomain && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Domaine générique (suspect)
                </Badge>
              )}
            </div>
            <CardDescription className="text-sm">
              {sanitizeEmailSubject(suggestion.email_thread?.ai_summary) || 'Aucun résumé disponible'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Données extraites */}
        {suggestion.extracted_data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
            {/* Afficher nom_hint seulement si différent de ville_hint */}
            {(suggestion.extracted_data.nom || suggestion.extracted_data.nom_hint) && 
             suggestion.extracted_data.nom_hint !== suggestion.extracted_data.ville_hint && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Établissement</p>
                  <p className="text-sm font-medium">
                    {suggestion.extracted_data.nom || suggestion.extracted_data.nom_hint}
                  </p>
                </div>
              </div>
            )}
            {(suggestion.extracted_data.ville || suggestion.extracted_data.ville_hint) && (
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Ville</p>
                  <p className="text-sm font-medium">
                    {suggestion.extracted_data.ville || suggestion.extracted_data.ville_hint}
                  </p>
                </div>
              </div>
            )}
            {(suggestion.extracted_data.type || suggestion.extracted_data.type_hint) && (
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm font-medium">
                    {suggestion.extracted_data.type || suggestion.extracted_data.type_hint}
                  </p>
                </div>
              </div>
            )}
            {suggestion.extracted_data.contact_hint?.name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="text-sm font-medium">{suggestion.extracted_data.contact_hint.name}</p>
                </div>
              </div>
            )}
            {suggestion.extracted_data.contact_hint?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{suggestion.extracted_data.contact_hint.email}</p>
                </div>
              </div>
            )}
            {suggestion.extracted_data.domain && (
              <div className="flex items-center gap-2 col-span-full">
                <div>
                  <p className="text-xs text-muted-foreground">Domaine</p>
                  <p className="text-sm font-medium font-mono">{suggestion.extracted_data.domain}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Raison du match */}
        {suggestion.match_reason && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Raison :</span> {suggestion.match_reason}
          </div>
        )}

        {/* Date */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
            Reçu le {format(new Date(suggestion.email_thread?.last_message_date || suggestion.created_at), 'PPP', { locale: fr })}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onAccept({ suggestionId: suggestion.id, createNew: isCreateNew })}
            disabled={isAccepting || isRejecting}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            {isCreateNew ? 'Créer établissement' : 'Lier à établissement'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(suggestion.id)}
            disabled={isAccepting || isRejecting}
          >
            <X className="h-4 w-4 mr-2" />
            Refuser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
