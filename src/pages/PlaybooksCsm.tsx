import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Play, Trash2, Pencil, Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import {
  useCsmPlaybooks,
  useCsmPlaybookSteps,
  useCsmPlaybookExecutions,
  useCsmPlaybookDashboard,
  useUpsertPlaybook,
  useDeletePlaybook,
  useUpsertPlaybookStep,
  useDeletePlaybookStep,
  useRunPlaybookEngine,
  type CsmPlaybook,
  type PlaybookStepType,
} from '@/hooks/csm/useCsmPlaybooks';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { PageDataState } from '@/components/common/PageDataState';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STEP_TYPES: { value: PlaybookStepType; label: string }[] = [
  { value: 'create_task', label: 'Créer une tâche' },
  { value: 'send_email', label: 'Envoyer un email' },
  { value: 'create_alert', label: 'Créer une alerte' },
  { value: 'wait_days', label: 'Attendre N jours' },
  { value: 'assign_csm', label: 'Assigner un CSM' },
  { value: 'update_health_note', label: 'Mettre à jour la note santé' },
];

export default function PlaybooksCsm() {
  usePageTitle('Playbooks CSM');
  const { data: dashboard } = useCsmPlaybookDashboard();
  const { data: playbooks = [], isLoading, isError, refetch } = useCsmPlaybooks();
  const { data: executions = [] } = useCsmPlaybookExecutions();
  const runEngine = useRunPlaybookEngine();
  const [selected, setSelected] = useState<CsmPlaybook | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Playbooks CSM</h1>
          <p className="text-muted-foreground text-sm">
            Scénarios automatiques déclenchés par la santé des comptes clients.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Lancer le worker des playbooks maintenant ? Cette action déclenche les exécutions en attente.')) {
                runEngine.mutate();
              }
            }}
            disabled={runEngine.isPending}
            aria-label="Lancer le worker des playbooks (avec confirmation)"
          >
            <Play className="h-4 w-4 mr-2" />
            Lancer le worker
          </Button>
          <Button onClick={() => { setSelected(null); setEditorOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau playbook
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Actifs" value={dashboard?.active_playbooks ?? 0} />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="En attente" value={dashboard?.pending_executions ?? 0} />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Terminés (30j)" value={dashboard?.completed_30d ?? 0} />
        <KpiCard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Échoués (30j)" value={dashboard?.failed_30d ?? 0} />
        <KpiCard label="Total" value={dashboard?.total_playbooks ?? 0} />
      </div>

      <Tabs defaultValue="playbooks">
        <TabsList>
          <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
          <TabsTrigger value="executions">Exécutions ({executions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks" className="space-y-3 mt-4">
          <PageDataState
            isLoading={isLoading && playbooks.length === 0}
            isError={isError}
            isEmpty={!isLoading && playbooks.length === 0}
            emptyTitle="Aucun playbook"
            emptyDescription="Créez-en un pour démarrer."
            onRetry={() => refetch()}
          >
            {playbooks.map((pb) => (
              <PlaybookRow key={pb.id} playbook={pb} onEdit={() => { setSelected(pb); setEditorOpen(true); }} />
            ))}
          </PageDataState>
        </TabsContent>

        <TabsContent value="executions" className="space-y-2 mt-4">
          {executions.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Aucune exécution.</CardContent></Card>
          )}
          {executions.map((ex) => (
            <Card key={ex.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={ex.status === 'completed' ? 'default' : ex.status === 'failed' ? 'destructive' : 'secondary'}>
                      {ex.status}
                    </Badge>
                    <span className="text-sm">Étape {ex.current_step_order}</span>
                    {ex.next_action_at && (
                      <span className="text-xs text-muted-foreground">
                        prochaine action : {format(new Date(ex.next_action_at), 'dd/MM HH:mm', { locale: fr })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Établissement : {ex.etablissement_id.slice(0, 8)}…</p>
                  {ex.last_error && <p className="text-xs text-destructive">{ex.last_error}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(ex.started_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <PlaybookEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        playbook={selected}
      />
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function PlaybookRow({ playbook, onEdit }: { playbook: CsmPlaybook; onEdit: () => void }) {
  const upsert = useUpsertPlaybook();
  const del = useDeletePlaybook();
  const { data: steps = [] } = useCsmPlaybookSteps(playbook.id);

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{playbook.name}</h3>
            <Badge variant="outline">{playbook.category ?? 'health'}</Badge>
            <Badge variant="secondary">{steps.length} étape{steps.length > 1 ? 's' : ''}</Badge>
            <Badge variant="outline">cooldown {playbook.cooldown_days}j</Badge>
          </div>
          {playbook.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{playbook.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={playbook.is_active}
              onCheckedChange={(v) => upsert.mutate({ ...playbook, is_active: v })}
            />
            <span className="text-xs">{playbook.is_active ? 'Actif' : 'Inactif'}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Éditer le playbook ${playbook.name}`}><Pencil className="h-4 w-4" /></Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Supprimer le playbook ${playbook.name}`}
            onClick={() => { if (confirm(`Supprimer définitivement le playbook "${playbook.name}" ? Cette action est irréversible.`)) del.mutate(playbook.id); }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlaybookEditorDialog({
  open,
  onOpenChange,
  playbook,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playbook: CsmPlaybook | null;
}) {
  const upsert = useUpsertPlaybook();
  const upsertStep = useUpsertPlaybookStep();
  const deleteStep = useDeletePlaybookStep();
  const { data: steps = [] } = useCsmPlaybookSteps(playbook?.id);

  const [name, setName] = useState(playbook?.name ?? '');
  const [description, setDescription] = useState(playbook?.description ?? '');
  const [threshold, setThreshold] = useState<number>(
    Number((playbook?.trigger_config as any)?.threshold ?? 60),
  );
  const [operator, setOperator] = useState<string>(String((playbook?.trigger_config as any)?.operator ?? 'lt'));
  const [cooldown, setCooldown] = useState<number>(playbook?.cooldown_days ?? 14);

  const handleSave = async () => {
    const saved = await upsert.mutateAsync({
      ...(playbook ?? {}),
      name,
      description: description || null,
      trigger_config: { field: 'health_score', operator, threshold },
      cooldown_days: cooldown,
      is_active: playbook?.is_active ?? true,
    } as any);
    if (!playbook) {
      // Crée une étape par défaut pour les nouveaux playbooks
      await upsertStep.mutateAsync({
        playbook_id: saved.id,
        step_order: 1,
        step_type: 'create_task',
        config: { titre: 'Contacter le client', priorite: 'haute' },
        delay_days: 0,
      });
    }
    onOpenChange(false);
  };

  const addStep = () => {
    if (!playbook) return;
    const nextOrder = (steps[steps.length - 1]?.step_order ?? 0) + 1;
    upsertStep.mutate({
      playbook_id: playbook.id,
      step_order: nextOrder,
      step_type: 'create_task',
      config: { titre: 'Nouvelle action' },
      delay_days: 1,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{playbook ? 'Modifier le playbook' : 'Nouveau playbook'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Alerte santé en baisse" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Opérateur</Label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lt">&lt;</SelectItem>
                  <SelectItem value="lte">≤</SelectItem>
                  <SelectItem value="gt">&gt;</SelectItem>
                  <SelectItem value="gte">≥</SelectItem>
                  <SelectItem value="eq">=</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Seuil santé</Label>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </div>
            <div>
              <Label>Cooldown (j)</Label>
              <Input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} />
            </div>
          </div>

          {playbook && (
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Étapes ({steps.length})</h4>
                <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3 w-3 mr-1" />Étape</Button>
              </div>
              {steps.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge>#{s.step_order}</Badge>
                      <Select
                        value={s.step_type}
                        onValueChange={(v) => upsertStep.mutate({ ...s, step_type: v as PlaybookStepType })}
                      >
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={s.delay_days}
                        onChange={(e) => upsertStep.mutate({ ...s, delay_days: Number(e.target.value) })}
                        className="w-20"
                        title="Délai en jours"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Supprimer cette étape"
                        onClick={() => { if (confirm('Supprimer cette étape du playbook ?')) deleteStep.mutate({ id: s.id, playbook_id: s.playbook_id }); }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <Textarea
                      value={JSON.stringify(s.config, null, 2)}
                      onChange={(e) => {
                        try {
                          const cfg = JSON.parse(e.target.value);
                          upsertStep.mutate({ ...s, config: cfg });
                        } catch { /* ignore */ }
                      }}
                      rows={3}
                      className="font-mono text-xs"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!name || upsert.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
