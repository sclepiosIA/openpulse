import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkflowTriggerType } from '@/types/workflow';

// Variables type-par-type — guides l'utilisateur sans avoir à deviner
const TRIGGER_VARS: Partial<Record<WorkflowTriggerType, string[]>> = {
  'etablissement.statut_changed': ['etablissement_id', 'nom', 'statut_old', 'statut_new'],
  'email.received': ['email_id', 'sender_email', 'sender_name', 'subject', 'body', 'thread_id', 'etablissement_id'],
  'facture.overdue': ['facture_id', 'numero', 'montant', 'date_emission', 'date_echeance', 'etablissement_id'],
  'task.completed': ['task_id', 'titre', 'completed_by', 'etablissement_id'],
  'call.completed': ['call_id', 'duration_sec', 'etablissement_id', 'commercial_id'],
  'manual': ['triggered_by'],
  'contact.created': ['contact_id', 'nom', 'email', 'etablissement_id'],
  'prospect.statut_changed': ['prospect_id', 'statut_old', 'statut_new', 'etablissement_id'],
  'devis.signed': ['devis_id', 'numero', 'montant', 'etablissement_id'],
  'contrat.signed': ['contrat_id', 'numero', 'date_debut', 'etablissement_id'],
  'ticket.created': ['ticket_id', 'sujet', 'priorite', 'etablissement_id'],
  'ticket.status_changed': ['ticket_id', 'statut_old', 'statut_new', 'etablissement_id'],
  'webhook': ['payload (objet libre)'],
  'schedule': ['scheduled_at'],
  'schedule_cron': ['scheduled_at', 'cron'],
  'prospect.score_above': ['prospect_id', 'score', 'threshold', 'etablissement_id'],
  'email.no_reply_after_days': ['email_id', 'thread_id', 'days_silent', 'sender_email', 'etablissement_id'],
  'calendar.event_starts_in': ['event_id', 'title', 'start_time', 'minutes_until', 'etablissement_id'],
  'churn.risk_detected': ['etablissement_id', 'churn_score', 'reasons'],
};

interface Props {
  triggerType?: WorkflowTriggerType;
  onInsert?: (token: string) => void;
}

export function VariablesHelper({ triggerType, onInsert }: Props) {
  const vars = (triggerType && TRIGGER_VARS[triggerType]) || ['etablissement_id'];

  const insert = (path: string) => {
    const token = `{{trigger.${path.split(' ')[0]}}}`;
    if (onInsert) {
      onInsert(token);
    } else {
      navigator.clipboard.writeText(token);
      toast.success(`Copié : ${token}`);
    }
  };

  return (
    <div className="rounded-md border bg-muted/40 p-2 space-y-1.5">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        Variables disponibles {triggerType ? `(${triggerType})` : ''}
      </div>
      <div className="flex flex-wrap gap-1">
        {vars.map((v) => (
          <Button
            key={v}
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] font-mono"
            onClick={() => insert(v)}
          >
            <Copy className="h-2.5 w-2.5 mr-1" />
            {v}
          </Button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Cliquez pour copier. Format : <code className="text-[10px]">{'{{trigger.champ}}'}</code> ·
        Sorties IA : <code className="text-[10px]">{'{{ai.cle}}'}</code> ·
        Variables : <code className="text-[10px]">{'{{vars.nom}}'}</code>
      </p>
    </div>
  );
}
