import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import { Wand2, ListPlus, BellOff, ExternalLink, Mail, Copy, Loader2 } from 'lucide-react';
import { ChurnFactorBars } from './ChurnFactorBars';
import { ChurnSparkline } from './ChurnSparkline';
import { useAcknowledgeChurn, useGenerateRetentionEmail, type ChurnPrediction } from '@/hooks/csm/useChurnPredictions';
import { toast } from 'sonner';

interface Props {
  prediction: ChurnPrediction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChurnActionPlanSheet({ prediction, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const ack = useAcknowledgeChurn();
  const genEmail = useGenerateRetentionEmail();

  const [showSnooze, setShowSnooze] = useState(false);
  const [until, setUntil] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [emailContent, setEmailContent] = useState<{ subject: string; body: string } | null>(null);

  if (!prediction) return null;

  const onSnooze = async () => {
    await ack.mutateAsync({ etabId: prediction.etablissement_id, until: new Date(until).toISOString(), note });
    setShowSnooze(false);
    onOpenChange(false);
  };

  const onGenerateEmail = async () => {
    try {
      const res = await genEmail.mutateAsync(prediction.etablissement_id);
      setEmailContent(res);
    } catch { /* toast already shown */ }
  };

  const copyEmail = () => {
    if (!emailContent) return;
    navigator.clipboard.writeText(`Objet : ${emailContent.subject}\n\n${emailContent.body}`);
    toast.success('Email copié');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="p-6 space-y-4">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" /> Plan d'action
            </SheetTitle>
            <SheetDescription>{prediction.etablissement?.nom} · Score {Number(prediction.score).toFixed(0)}/100</SheetDescription>
          </SheetHeader>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution 90 jours</CardTitle></CardHeader>
            <CardContent>
              <ChurnSparkline etablissementId={prediction.etablissement_id} days={90} height={100} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Facteurs déclencheurs</CardTitle></CardHeader>
            <CardContent>
              <ChurnFactorBars factors={prediction.factors as Record<string, number>} />
            </CardContent>
          </Card>

          {prediction.recommendations?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recommandations IA</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {prediction.recommendations.map((r, i) => (
                    <li key={`churn-recommendation-${i}-${typeof r === 'string' ? r.slice(0, 24) : ''}`} className="flex items-start justify-between gap-2 text-sm">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="text-primary mt-0.5">→</span>
                        <span>{r}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 shrink-0"
                        onClick={() => navigate(`/taches/new?etablissement_id=${prediction.etablissement_id}&titre=${encodeURIComponent(r)}`)}>
                        <ListPlus className="h-3.5 w-3.5 mr-1" /> Tâche
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> Email de rétention IA</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!emailContent ? (
                <Button onClick={onGenerateEmail} disabled={genEmail.isPending} size="sm" className="w-full">
                  {genEmail.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération…</> : 'Générer un email de rétention'}
                </Button>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Objet</Label>
                    <Input value={emailContent.subject} onChange={e => setEmailContent({ ...emailContent, subject: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Corps</Label>
                    <Textarea value={emailContent.body} onChange={e => setEmailContent({ ...emailContent, body: e.target.value })} rows={8} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={copyEmail}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copier</Button>
                    <Button size="sm" variant="outline" onClick={onGenerateEmail} disabled={genEmail.isPending}>Régénérer</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => navigate(`/etablissements/${prediction.etablissement_id}`)}>
              <ExternalLink className="h-4 w-4 mr-1.5" /> Fiche complète
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/taches/new?etablissement_id=${prediction.etablissement_id}`)}>
              <ListPlus className="h-4 w-4 mr-1.5" /> Créer une tâche
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSnooze(s => !s)}>
              <BellOff className="h-4 w-4 mr-1.5" /> Marquer traité
            </Button>
          </div>

          {showSnooze && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label htmlFor="until">Suivi jusqu'au</Label>
                  <Input id="until" type="date" value={until} onChange={e => setUntil(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="note">Note</Label>
                  <Textarea id="note" value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Action engagée, contexte…" />
                </div>
                <Button onClick={onSnooze} disabled={ack.isPending} size="sm" className="w-full">Confirmer</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
