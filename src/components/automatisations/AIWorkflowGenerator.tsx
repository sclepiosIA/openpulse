import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/shared/use-toast';
import { generateWorkflowFromPrompt } from '@/services/automatisations/generateWorkflow';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

interface AIWorkflowGeneratorProps {
  onGenerated: (nodes: Node[], edges: Edge[]) => void;
  hasExistingNodes: boolean;
}

const EXAMPLES = [
  "Quand un email contient le mot \"résiliation\", crée un ticket support urgent et envoie un email empathique au client",
  "Quand le statut d'un établissement passe à Production, crée une tâche d'onboarding et notifie le CSM",
  "Tous les jours à 9h, lance une relance pour les prospects chauds inactifs depuis 7 jours, avec un email rédigé par IA",
  "Quand une facture est en retard, envoie un email de relance professionnel généré par IA et crée une tâche de suivi",
];

export function AIWorkflowGenerator({ onGenerated, hasExistingNodes }: AIWorkflowGeneratorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (prompt.trim().length < 10) {
      toast({ title: 'Description trop courte', description: 'Décris ton automation en au moins 10 caractères.', variant: 'destructive' });
      return;
    }
    if (hasExistingNodes && !confirm('Le graphe actuel sera remplacé. Continuer ?')) return;

    setLoading(true);
    try {
      const { nodes, edges } = await generateWorkflowFromPrompt(prompt.trim());
      onGenerated(nodes, edges);
      toast({ title: '✨ Workflow généré', description: `${nodes.length} bloc(s) créé(s) — pense à enregistrer.` });
      setOpen(false);
      setPrompt('');
    } catch (err) {
      toast({
        title: 'Échec de la génération',
        description: sanitizeSupabaseError(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
          <Sparkles className="h-4 w-4 mr-2" /> Générer avec IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Générer un workflow par IA
          </DialogTitle>
          <DialogDescription>
            Décris en langage naturel l'automation que tu veux. L'IA (GPT-5) générera les blocs et leurs connexions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="ai-prompt" className="text-sm">Description du workflow</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="ex: Quand une facture est en retard de 30 jours, envoie un email de relance écrit par IA et crée une tâche pour le CSM"
              rows={5}
              className="mt-1"
              disabled={loading}
              maxLength={4000}
            />
            <p className="text-xs text-muted-foreground mt-1">{prompt.length} / 4000 caractères</p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">💡 Exemples (clique pour utiliser)</Label>
            <div className="mt-2 space-y-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  disabled={loading}
                  className="w-full text-left text-xs p-2 rounded-md border bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {hasExistingNodes && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              ⚠️ Le graphe actuel sera remplacé par celui généré.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Annuler</Button>
          <Button onClick={handleGenerate} disabled={loading || prompt.trim().length < 10}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération…</> : <><Sparkles className="h-4 w-4 mr-2" /> Générer</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
