/**
 * Panneau Assistant IA de l'éditeur de documents.
 *
 * Quatre actions : résumé, reformulation, classification DPO/RSSI et
 * extraction d'actions. Le panneau est purement additif (aside repliable) et
 * dégrade proprement en état « non configuré » si l'edge function
 * `document-ai-assist` est absente ou si Azure OpenAI n'est pas configuré
 * côté serveur. Aucun secret n'est manipulé côté client.
 */
import { useCallback, useState } from 'react';
import {
  Sparkles,
  FileText,
  PenLine,
  ShieldCheck,
  ListChecks,
  Loader2,
  X,
  AlertTriangle,
  Copy,
  ArrowDownToLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  callDocumentAiAssist,
  type DocumentAiAction,
  type DocumentAiActionItem,
  type DocumentAiClassification,
  type DocumentAiResponse,
  type DocumentAiTone,
} from '@/services/documents/documentAiAssist';

export interface DocumentAiPanelProps {
  /** Retourne le contenu courant du document (HTML). */
  getDocumentContent: () => string;
  documentName?: string;
  /** Insère du texte dans l'éditeur (résumé / reformulation). */
  onInsertContent?: (html: string) => void;
  onClose?: () => void;
  className?: string;
}

const ACTIONS: Array<{
  action: DocumentAiAction;
  icon: typeof FileText;
  label: string;
  desc: string;
}> = [
  { action: 'summarize', icon: FileText, label: 'Résumer', desc: 'Synthèse concise du document' },
  { action: 'rewrite', icon: PenLine, label: 'Reformuler', desc: 'Réécriture selon le ton choisi' },
  { action: 'classify', icon: ShieldCheck, label: 'Classifier DPO/RSSI', desc: 'Sensibilité RGPD et criticité sécurité' },
  { action: 'extract_actions', icon: ListChecks, label: 'Extraire les actions', desc: 'Actions, responsables, échéances' },
];

const TONES: Array<{ value: DocumentAiTone; label: string }> = [
  { value: 'formal', label: 'Formel' },
  { value: 'concise', label: 'Concis' },
  { value: 'simplified', label: 'Simplifié' },
];

const DPO_BADGE_CLASSES: Record<DocumentAiClassification['dpo_level'], string> = {
  public: 'bg-green-100 text-green-800',
  interne: 'bg-blue-100 text-blue-800',
  confidentiel: 'bg-orange-100 text-orange-800',
  donnees_sante: 'bg-red-100 text-red-800',
};

const RSSI_BADGE_CLASSES: Record<DocumentAiClassification['rssi_level'], string> = {
  faible: 'bg-green-100 text-green-800',
  modere: 'bg-yellow-100 text-yellow-800',
  eleve: 'bg-orange-100 text-orange-800',
  critique: 'bg-red-100 text-red-800',
};

const DPO_LABELS: Record<DocumentAiClassification['dpo_level'], string> = {
  public: 'Public',
  interne: 'Interne',
  confidentiel: 'Confidentiel',
  donnees_sante: 'Données de santé',
};

const RSSI_LABELS: Record<DocumentAiClassification['rssi_level'], string> = {
  faible: 'Faible',
  modere: 'Modéré',
  eleve: 'Élevé',
  critique: 'Critique',
};

function actionsToHtml(items: DocumentAiActionItem[]): string {
  const rows = items
    .map(
      (item) =>
        `<li>${item.action}${item.owner ? ` — <strong>${item.owner}</strong>` : ''}${
          item.due_date ? ` (échéance : ${item.due_date})` : ''
        }</li>`,
    )
    .join('');
  return `<h3>Actions extraites</h3><ul>${rows}</ul>`;
}

export function DocumentAiPanel({
  getDocumentContent,
  documentName,
  onInsertContent,
  onClose,
  className,
}: DocumentAiPanelProps) {
  const [pendingAction, setPendingAction] = useState<DocumentAiAction | null>(null);
  const [tone, setTone] = useState<DocumentAiTone>('formal');
  const [response, setResponse] = useState<DocumentAiResponse | null>(null);
  const [lastAction, setLastAction] = useState<DocumentAiAction | null>(null);

  const isUnconfigured = response?.status === 'unconfigured';

  const runAction = useCallback(
    async (action: DocumentAiAction) => {
      const content = getDocumentContent();
      if (!content || !content.replace(/<[^>]*>/g, '').trim()) {
        toast.error('Le document est vide : rien à analyser.');
        return;
      }

      setPendingAction(action);
      setLastAction(action);
      try {
        const result = await callDocumentAiAssist({
          action,
          content,
          documentName,
          tone: action === 'rewrite' ? tone : undefined,
        });
        setResponse(result);
        if (result.status === 'error') {
          toast.error(result.message);
        }
      } finally {
        setPendingAction(null);
      }
    },
    [getDocumentContent, documentName, tone],
  );

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copié dans le presse-papiers');
    } catch {
      toast.error('Impossible de copier');
    }
  }, []);

  const insertable =
    response?.status === 'ok'
      ? response.result ?? (response.actions ? actionsToHtml(response.actions) : undefined)
      : undefined;

  return (
    <aside
      aria-label="Assistant IA du document"
      className={cn(
        'flex flex-col w-80 shrink-0 border-l bg-background h-full',
        className,
      )}
      data-testid="document-ai-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold truncate">Assistant IA</span>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Fermer le panneau IA"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* État non configuré (mode dégradé) */}
          {isUnconfigured && (
            <div
              role="status"
              data-testid="ai-unconfigured"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Assistant IA non configuré
              </div>
              <p>{response.status === 'unconfigured' ? response.message : null}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {ACTIONS.map(({ action, icon: Icon, label, desc }) => (
              <div key={action} className="space-y-1.5">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-auto py-2"
                  disabled={pendingAction !== null || isUnconfigured}
                  onClick={() => runAction(action)}
                  data-testid={`ai-action-${action}`}
                >
                  {pendingAction === action ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground font-normal">{desc}</span>
                  </span>
                </Button>
                {action === 'rewrite' && (
                  <Select value={tone} onValueChange={(v) => setTone(v as DocumentAiTone)}>
                    <SelectTrigger
                      className="h-8 text-xs"
                      aria-label="Ton de reformulation"
                      data-testid="ai-tone-select"
                    >
                      <SelectValue placeholder="Ton" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>

          {/* Résultat */}
          {response?.status === 'ok' && (
            <div className="space-y-2" data-testid="ai-result">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Résultat
              </div>

              {/* Texte (résumé / reformulation) */}
              {response.result && (lastAction === 'summarize' || lastAction === 'rewrite') && (
                <div className="rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words">
                  {response.result}
                </div>
              )}

              {/* Classification DPO / RSSI */}
              {response.classification && (
                <div className="rounded-md border p-3 space-y-2" data-testid="ai-classification">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={cn('text-xs', DPO_BADGE_CLASSES[response.classification.dpo_level])}
                    >
                      DPO : {DPO_LABELS[response.classification.dpo_level]}
                    </Badge>
                    <Badge
                      className={cn('text-xs', RSSI_BADGE_CLASSES[response.classification.rssi_level])}
                    >
                      RSSI : {RSSI_LABELS[response.classification.rssi_level]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{response.classification.rationale}</p>
                  {response.classification.recommendations.length > 0 && (
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {response.classification.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Actions extraites */}
              {response.actions && (
                <ul className="rounded-md border p-3 space-y-2 text-sm" data-testid="ai-actions-list">
                  {response.actions.length === 0 && (
                    <li className="text-xs text-muted-foreground list-none">
                      Aucune action détectée dans ce document.
                    </li>
                  )}
                  {response.actions.map((item, i) => (
                    <li key={i} className="flex flex-col gap-0.5 list-none">
                      <span>{item.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {[item.owner, item.due_date && `échéance : ${item.due_date}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions sur le résultat */}
              <div className="flex gap-2">
                {response.result && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleCopy(response.result!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </Button>
                )}
                {insertable && onInsertContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => onInsertContent(insertable)}
                    data-testid="ai-insert-result"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Insérer dans le document
                  </Button>
                )}
              </div>

              {response.model && (
                <p className="text-[10px] text-muted-foreground">Modèle : {response.model}</p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
