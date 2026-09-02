import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Trophy, FlaskConical, Loader2 } from 'lucide-react';
import {
  useSequenceVariants,
  useUpsertVariant,
  useDeleteVariant,
  useDesignateWinners,
  type VariantWithStats,
} from '@/hooks/email/useSequenceVariants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  sequenceId: string;
  /** Nombre d'étapes de la séquence (longueur de email_sequences.etapes). */
  stepsCount: number;
}

/** Gestionnaire complet d'A/B testing pour une séquence email : N variantes par étape, split pondéré, désignation auto. */
export function SequenceABTestingPanel({ sequenceId, stepsCount }: Props) {
  const { data: variants = [], isLoading } = useSequenceVariants(sequenceId);
  const designate = useDesignateWinners();

  const variantsByStep = new Map<number, VariantWithStats[]>();
  for (const v of variants) {
    const arr = variantsByStep.get(v.step_index) ?? [];
    arr.push(v);
    variantsByStep.set(v.step_index, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            A/B testing
          </h3>
          <p className="text-xs text-muted-foreground">
            N variantes par étape — split pondéré — désignation auto du gagnant.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => designate.mutate({ sequence_id: sequenceId })}
          disabled={designate.isPending}
          className="gap-2"
        >
          {designate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
          Désigner les gagnants
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : (
        Array.from({ length: stepsCount }).map((_, stepIdx) => (
          <StepVariantsCard
            key={stepIdx}
            sequenceId={sequenceId}
            stepIndex={stepIdx}
            variants={variantsByStep.get(stepIdx) ?? []}
          />
        ))
      )}
    </div>
  );
}

function StepVariantsCard({
  sequenceId, stepIndex, variants,
}: { sequenceId: string; stepIndex: number; variants: VariantWithStats[] }) {
  const totalWeight = variants.reduce((sum, v) => (v.is_active ? sum + v.weight : sum), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Étape {stepIndex + 1}</CardTitle>
          <VariantDialog
            sequenceId={sequenceId}
            stepIndex={stepIndex}
            existingLabels={variants.map((v) => v.variant_label)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {variants.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune variante — ajoutez-en au moins 2 pour démarrer un A/B test.</p>
        ) : (
          variants.map((v) => (
            <VariantRow key={v.id} variant={v} totalWeight={totalWeight} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function VariantRow({ variant: v, totalWeight }: { variant: VariantWithStats; totalWeight: number }) {
  const del = useDeleteVariant();
  const sharePct = totalWeight > 0 ? Math.round((v.weight / totalWeight) * 100) : 0;
  const stats = v.stats;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={v.is_winner ? 'default' : 'outline'}>
            {v.is_winner && <Trophy className="h-3 w-3 mr-1" />}
            Variante {v.variant_label}
          </Badge>
          {!v.is_active && <Badge variant="secondary" className="text-xs">Désactivée</Badge>}
          <span className="text-xs text-muted-foreground">{sharePct}% du trafic</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => del.mutate({ id: v.id, sequence_id: v.sequence_id })}
          disabled={del.isPending} aria-label="Supprimer">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {v.subject && <div className="text-xs"><span className="text-muted-foreground">Sujet : </span>{v.subject}</div>}

      <div className="grid grid-cols-4 gap-2 text-xs pt-2 border-t">
        <Stat label="Envois" value={stats?.sends_count ?? 0} />
        <Stat label="Ouvert." value={`${Math.round((stats?.open_rate ?? 0) * 100)}%`} />
        <Stat label="Clics" value={`${Math.round((stats?.click_rate ?? 0) * 100)}%`} />
        <Stat label="Réponses" value={`${Math.round((stats?.reply_rate ?? 0) * 100)}%`} />
      </div>
      <Progress value={sharePct} className="h-1" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function VariantDialog({
  sequenceId, stepIndex, existingLabels,
}: { sequenceId: string; stepIndex: number; existingLabels: string[] }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(() => nextLabel(existingLabels));
  const [weight, setWeight] = useState(50);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const upsert = useUpsertVariant();

  const handleSave = async () => {
    await upsert.mutateAsync({
      sequence_id: sequenceId,
      step_index: stepIndex,
      variant_label: label,
      weight,
      subject: subject || null,
      body_text: body || null,
      is_active: true,
    });
    setOpen(false);
    setSubject('');
    setBody('');
    setLabel(nextLabel([...existingLabels, label]));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Variante
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle variante — Étape {stepIndex + 1}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value.toUpperCase())} maxLength={3} />
            </div>
            <div>
              <Label className="text-xs">Poids (0-100)</Label>
              <Input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Sujet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet de l'email" />
          </div>
          <div>
            <Label className="text-xs">Corps (texte)</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={upsert.isPending || !label}>
            {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function nextLabel(existing: string[]): string {
  const used = new Set(existing.map((s) => s.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!used.has(c)) return c;
  }
  return 'X';
}
