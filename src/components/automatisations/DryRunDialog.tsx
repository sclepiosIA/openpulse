import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FlaskConical, Wand2, Loader2 } from 'lucide-react';
import type { WorkflowTriggerType } from '@/types/workflow';

interface DryRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerType: WorkflowTriggerType;
  onLaunch: (payload: Record<string, unknown>) => void;
  isPending: boolean;
}

const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  'etablissement.statut_changed': {
    etablissement_id: '00000000-0000-0000-0000-000000000000',
    etablissement_nom: 'Clinique Exemple',
    statut_old: 'Prospect',
    statut_new: 'Production',
  },
  'email.received': {
    sender_email: 'contact@exemple.fr',
    subject: 'Demande de démo',
    body: 'Bonjour, nous souhaiterions une démonstration.',
  },
  'facture.overdue': {
    numero: 'FAC-2026-0042',
    montant: 1250.0,
    etablissement_id: '00000000-0000-0000-0000-000000000000',
    etablissement_nom: 'Clinique Exemple',
    days_late: 35,
  },
  'task.completed': {
    tache_id: '00000000-0000-0000-0000-000000000000',
    titre: 'Appel de suivi',
    completed_by: '00000000-0000-0000-0000-000000000000',
  },
  'ticket.created': {
    ticket_id: '00000000-0000-0000-0000-000000000000',
    sujet: 'Problème connexion',
    priorite: 'high',
  },
  'devis.signed': {
    devis_id: '00000000-0000-0000-0000-000000000000',
    montant: 3200,
    etablissement_id: '00000000-0000-0000-0000-000000000000',
  },
  'contrat.signed': {
    contrat_id: '00000000-0000-0000-0000-000000000000',
    etablissement_id: '00000000-0000-0000-0000-000000000000',
  },
  manual: { manual: true, started_at: new Date().toISOString() },
};

export function DryRunDialog({ open, onOpenChange, triggerType, onLaunch, isPending }: DryRunDialogProps) {
  const sample = SAMPLE_PAYLOADS[triggerType] ?? { example: 'value' };
  const [text, setText] = useState(JSON.stringify(sample, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(JSON.stringify(SAMPLE_PAYLOADS[triggerType] ?? { example: 'value' }, null, 2));
      setError(null);
    }
  }, [open, triggerType]);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e: any) {
      setError(`JSON invalide : ${e.message}`);
    }
  };

  const handleLaunch = () => {
    try {
      const parsed = JSON.parse(text);
      setError(null);
      onLaunch(parsed);
    } catch (e: any) {
      setError(`JSON invalide : ${e.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-500" /> Tester le workflow
          </DialogTitle>
          <DialogDescription>
            Le test exécute le workflow sans effets de bord (aucun email envoyé, aucune tâche créée). Vous pouvez modifier le payload du déclencheur ci-dessous.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Payload du déclencheur (JSON)</Label>
            <Button type="button" variant="ghost" size="sm" onClick={handleFormat} className="h-7">
              <Wand2 className="h-3 w-3 mr-1" /> Formater
            </Button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs min-h-[260px]"
            spellCheck={false}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleLaunch} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-2" />}
            Lancer le test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
