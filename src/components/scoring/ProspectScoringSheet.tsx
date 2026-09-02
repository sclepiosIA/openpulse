import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { BehavioralEventsTimeline } from './BehavioralEventsTimeline';
import { AttributionFunnel } from './AttributionFunnel';
import { ProspectSparkline } from './ProspectSparkline';
import { useBehavioralScore } from '@/hooks/crm/useBehavioralScore';
import { getScoreTier } from '@/types/scoring';
import { ExternalLink, ListPlus, BellOff, Activity } from 'lucide-react';
import { useState } from 'react';
import { useAcknowledgeProspect } from '@/hooks/crm/useBehavioralScore';
import { useToast } from '@/hooks/shared/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Props {
  etablissementId: string | null;
  etablissementNom?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProspectScoringSheet({ etablissementId, etablissementNom, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const ack = useAcknowledgeProspect();
  const { data: behav, isLoading } = useBehavioralScore(etablissementId ?? undefined);

  const [showSnooze, setShowSnooze] = useState(false);
  const [until, setUntil] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const score = behav?.behavioral_score ?? 0;
  const tier = getScoreTier(score * 2); // approximation tier d'après comportemental

  const snooze = async () => {
    if (!etablissementId) return;
    try {
      await ack.mutateAsync({ id: etablissementId, until, note });
      toast({ title: 'Prospect mis en pause', description: `Jusqu'au ${until}` });
      setShowSnooze(false);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? String(e), variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="p-6 space-y-4">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {etablissementNom ?? 'Détail scoring'}
            </SheetTitle>
            <SheetDescription>Scoring comportemental, attribution et historique.</SheetDescription>
          </SheetHeader>

          {etablissementId && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    Score comportemental
                    <Badge variant="outline" className="font-mono">{isLoading ? '…' : `${score}/50`}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">Vélocité (7j) : <span className="font-mono">{behav?.engagement_velocity ?? 0}</span></div>
                  <div className="text-xs text-muted-foreground">Tier : <Badge variant="outline" className="text-xs">{tier.label}</Badge></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution du score (30j)</CardTitle></CardHeader>
                <CardContent>
                  <ProspectSparkline etablissementId={etablissementId} days={30} height={100} />
                </CardContent>
              </Card>

              <BehavioralEventsTimeline etablissementId={etablissementId} limit={15} />
              <AttributionFunnel etablissementId={etablissementId} />

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => navigate(`/etablissements/${etablissementId}`)}>
                  <ExternalLink className="h-4 w-4 mr-1.5" /> Fiche complète
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/taches/new?etablissement_id=${etablissementId}`)}>
                  <ListPlus className="h-4 w-4 mr-1.5" /> Créer une tâche
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowSnooze(s => !s)}>
                  <BellOff className="h-4 w-4 mr-1.5" /> Snooze
                </Button>
              </div>

              {showSnooze && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <Label htmlFor="until-sheet">Jusqu'au</Label>
                      <Input id="until-sheet" type="date" value={until} onChange={e => setUntil(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="note-sheet">Note</Label>
                      <Textarea id="note-sheet" value={note} onChange={e => setNote(e.target.value)} rows={2} />
                    </div>
                    <Button onClick={snooze} disabled={ack.isPending} size="sm" className="w-full">
                      Confirmer le snooze
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
