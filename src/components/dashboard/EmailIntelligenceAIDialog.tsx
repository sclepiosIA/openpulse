import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Mail, RefreshCw, Plus, ArrowRightCircle, FileText, Calendar, CheckCheck, X, Sparkles, Filter, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-orange-600 dark:text-orange-400';
};

export const getConfidenceBorderColor = (confidence: number) => {
  if (confidence >= 0.8) return 'border-green-500/30';
  if (confidence >= 0.6) return 'border-yellow-500/30';
  return 'border-orange-500/30';
};

export const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'update_task': return <RefreshCw className="h-3.5 w-3.5" />;
    case 'create_task': return <Plus className="h-3.5 w-3.5" />;
    case 'change_status': return <ArrowRightCircle className="h-3.5 w-3.5" />;
    case 'update_summary': return <FileText className="h-3.5 w-3.5" />;
    case 'send_email_response': return <Mail className="h-3.5 w-3.5" />;
    case 'schedule_follow_up': return <Calendar className="h-3.5 w-3.5" />;
    default: return <Zap className="h-3.5 w-3.5" />;
  }
};

export const getActionLabel = (actionType: string) => {
  switch (actionType) {
    case 'update_task': return 'Mise à jour de tâche';
    case 'create_task': return 'Création de tâche';
    case 'change_status': return 'Changement de statut';
    case 'update_summary': return 'Mise à jour du résumé';
    case 'send_email_response': return 'Réponse email';
    case 'schedule_follow_up': return 'Relance planifiée';
    default: return actionType;
  }
};

export const formatActionData = (actionType: string, actionData: any) => {
  if (!actionData) return null;
  try {
    switch (actionType) {
      case 'update_task':
        return (
          <div className="space-y-1">
            {actionData.task_id && <p className="text-xs"><strong>Tâche :</strong> {actionData.task_id.slice(0, 8)}...</p>}
            {actionData.updates?.status && <p className="text-xs"><strong>Nouveau statut :</strong> {actionData.updates.status}</p>}
            {actionData.updates?.completion_date && <p className="text-xs"><strong>Date d'achèvement :</strong> {new Date(actionData.updates.completion_date).toLocaleDateString('fr-FR')}</p>}
          </div>
        );
      case 'create_task':
        return (
          <div className="space-y-1">
            {actionData.title && <p className="text-xs"><strong>Titre :</strong> {actionData.title}</p>}
            {actionData.priority && <p className="text-xs"><strong>Priorité :</strong> {actionData.priority}</p>}
            {actionData.due_date && <p className="text-xs"><strong>Échéance :</strong> {new Date(actionData.due_date).toLocaleDateString('fr-FR')}</p>}
          </div>
        );
      case 'change_status':
        return (
          <div className="space-y-1">
            {actionData.new_status && <p className="text-xs"><strong>Nouveau statut :</strong> {actionData.new_status}</p>}
          </div>
        );
      case 'update_summary':
        return (
          <div className="space-y-1">
            {actionData.summary && <p className="text-xs"><strong>Résumé :</strong> {actionData.summary.slice(0, 100)}{actionData.summary.length > 100 ? '...' : ''}</p>}
          </div>
        );
      case 'send_email_response':
        return (
          <div className="space-y-1">
            {actionData.subject && <p className="text-xs"><strong>Objet :</strong> {actionData.subject}</p>}
            {actionData.draft_content && <p className="text-xs"><strong>Contenu :</strong> {actionData.draft_content.slice(0, 100)}{actionData.draft_content.length > 100 ? '...' : ''}</p>}
          </div>
        );
      case 'schedule_follow_up':
        return (
          <div className="space-y-1">
            {actionData.follow_up_date && <p className="text-xs"><strong>Date :</strong> {new Date(actionData.follow_up_date).toLocaleDateString('fr-FR')}</p>}
            {actionData.note && <p className="text-xs"><strong>Note :</strong> {actionData.note}</p>}
          </div>
        );
      default:
        return <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(actionData, null, 2)}</pre>;
    }
  } catch {
    return <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(actionData, null, 2)}</pre>;
  }
};

interface AISuggestion {
  id: string;
  action_type: string;
  action_data: any;
  reason: string;
  confidence_score: number;
  created_at: string;
  etablissement?: { nom?: string; ville?: string };
}

interface EmailIntelligenceAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiSuggestionsCount: number;
  filteredSuggestionsCount: number;
  orderedGroupedAISuggestionEntries: [string, AISuggestion[]][];
  filterActionType: string;
  setFilterActionType: (v: string) => void;
  filterConfidence: string;
  setFilterConfidence: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  avgConfidence: number;
  highConfCount: number;
  lowConfCount: number;
  isApprovingAI: boolean;
  isRejectingAI: boolean;
  processingSuggestionId: string | null;
  onRequestBulk: (kind: 'approve' | 'reject', etablissementId: string, etablissementNom: string) => void;
  onApproveOne: (suggestionId: string) => void;
  onRejectOne: (suggestionId: string) => void;
}

export function EmailIntelligenceAIDialog(props: EmailIntelligenceAIDialogProps) {
  const {
    open, onOpenChange,
    aiSuggestionsCount, filteredSuggestionsCount,
    orderedGroupedAISuggestionEntries,
    filterActionType, setFilterActionType,
    filterConfidence, setFilterConfidence,
    sortBy, setSortBy,
    avgConfidence, highConfCount, lowConfCount,
    isApprovingAI, isRejectingAI, processingSuggestionId,
    onRequestBulk, onApproveOne, onRejectOne,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Actions suggérées par l'IA ({filteredSuggestionsCount} / {aiSuggestionsCount})
          </DialogTitle>
        </DialogHeader>

        {aiSuggestionsCount === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune suggestion pour le moment</h3>
            <p className="text-sm text-muted-foreground">
              L'IA analyse vos emails en continu pour vous proposer des actions pertinentes
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtres</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full">
                <Select value={filterActionType} onValueChange={setFilterActionType}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Type d'action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="update_task">Mise à jour de tâche</SelectItem>
                    <SelectItem value="create_task">Création de tâche</SelectItem>
                    <SelectItem value="change_status">Changement de statut</SelectItem>
                    <SelectItem value="update_summary">Mise à jour résumé</SelectItem>
                    <SelectItem value="send_email_response">Réponse email</SelectItem>
                    <SelectItem value="schedule_follow_up">Relance planifiée</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterConfidence} onValueChange={setFilterConfidence}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Confiance" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les niveaux</SelectItem>
                    <SelectItem value="high">Haute (≥80%)</SelectItem>
                    <SelectItem value="medium">Moyenne (60-80%)</SelectItem>
                    <SelectItem value="low">Basse (&lt;60%)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Trier par" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date (récent)</SelectItem>
                    <SelectItem value="confidence">Confiance (haute)</SelectItem>
                  </SelectContent>
                </Select>
                {(filterActionType !== 'all' || filterConfidence !== 'all' || sortBy !== 'date') && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilterActionType('all'); setFilterConfidence('all'); setSortBy('date'); }}>
                    <X className="h-3 w-3 mr-1" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>

            {filteredSuggestionsCount === 0 ? (
              <div className="text-center py-12">
                <Filter className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun résultat</h3>
                <p className="text-sm text-muted-foreground">Aucune suggestion ne correspond à vos filtres</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Confiance moyenne</p>
                    <p className="text-2xl font-bold">{avgConfidence}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Haute priorité</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{highConfCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">À vérifier</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{lowConfCount}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {orderedGroupedAISuggestionEntries.map(([etablissementId, suggestions]) => {
                    const etablissementNom = suggestions[0]?.etablissement?.nom || 'Établissement inconnu';
                    const etablissementVille = suggestions[0]?.etablissement?.ville;
                    return (
                      <Card key={etablissementId}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {etablissementNom}
                              </CardTitle>
                              <CardDescription>
                                {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
                                {etablissementVille && ` • ${etablissementVille}`}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => onRequestBulk('approve', etablissementId, etablissementNom)} disabled={isApprovingAI || isRejectingAI}>
                                <CheckCheck className="h-3 w-3 mr-1" />
                                Tout approuver
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => onRequestBulk('reject', etablissementId, etablissementNom)} disabled={isApprovingAI || isRejectingAI}>
                                <X className="h-3 w-3 mr-1" />
                                Tout ignorer
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Accordion type="single" collapsible className="w-full">
                            {suggestions.map((suggestion, index) => (
                              <AccordionItem
                                key={suggestion.id}
                                value={`item-${index}`}
                                className={cn('border rounded-lg mb-2 last:mb-0', getConfidenceBorderColor(suggestion.confidence_score))}
                              >
                                <AccordionTrigger className="px-4 hover:no-underline">
                                  <div className="flex items-center justify-between w-full pr-4 min-w-0">
                                    <div className="flex items-center gap-3">
                                      <Badge variant="secondary" className="flex items-center gap-1">
                                        {getActionIcon(suggestion.action_type)}
                                        {getActionLabel(suggestion.action_type)}
                                      </Badge>
                                      <div className="flex items-center gap-2">
                                        <div className="w-24">
                                          <Progress value={suggestion.confidence_score * 100} className="h-1.5" />
                                        </div>
                                        <span className={cn('text-xs font-medium', getConfidenceColor(suggestion.confidence_score))}>
                                          {Math.round(suggestion.confidence_score * 100)}%
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true, locale: fr })}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-sm font-medium mb-1">Raison</p>
                                      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                                    </div>
                                    {suggestion.action_data && (
                                      <div>
                                        <p className="text-sm font-medium mb-2">Détails de l'action</p>
                                        <div className="bg-muted/50 p-3 rounded-lg">
                                          {formatActionData(suggestion.action_type, suggestion.action_data)}
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex gap-2 pt-2">
                                      <Button size="sm" onClick={() => onApproveOne(suggestion.id)} disabled={!!processingSuggestionId || isApprovingAI || isRejectingAI} className="flex-1">
                                        <CheckCheck className="h-3 w-3 mr-1" />
                                        {processingSuggestionId === suggestion.id ? 'Application...' : 'Appliquer cette action'}
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => onRejectOne(suggestion.id)} disabled={!!processingSuggestionId || isApprovingAI || isRejectingAI} className="flex-1">
                                        <X className="h-3 w-3 mr-1" />
                                        {processingSuggestionId === suggestion.id ? 'Ignoré...' : 'Ignorer'}
                                      </Button>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
