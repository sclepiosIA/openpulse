import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Calendar, X } from 'lucide-react';
import { useScheduledExports, useUpsertScheduledExport, useDeleteScheduledExport, type ScheduledExport } from '@/hooks/analytics/useScheduledExports';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { CustomDashboard } from '@/types/report';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: CustomDashboard;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function ScheduleDialog({ open, onOpenChange, dashboard }: Props) {
  const { data: schedules = [] } = useScheduledExports(dashboard.id);
  const upsert = useUpsertScheduledExport();
  const del = useDeleteScheduledExport();
  const [editing, setEditing] = useState<Partial<ScheduledExport> | null>(null);
  const [emailInput, setEmailInput] = useState('');

  const startNew = () => setEditing({
    dashboard_id: dashboard.id,
    format: 'pdf',
    frequency: 'weekly',
    hour_utc: 6,
    day_of_week: 1,
    day_of_month: 1,
    recipients: [],
    is_active: true,
  });

  const addEmail = () => {
    const v = emailInput.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
    setEditing(e => ({ ...e!, recipients: [...(e!.recipients || []), v] }));
    setEmailInput('');
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.recipients?.length) return;
    await upsert.mutateAsync(editing as any);
    setEditing(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Planifier l'envoi automatique</DialogTitle>
          <DialogDescription>
            Le rapport sera généré et envoyé par email aux destinataires selon la fréquence choisie.
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-3">
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune planification active</p>
            ) : (
              schedules.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 p-3 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {s.format.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium capitalize">{s.frequency}</span>
                      {s.next_run_at && (
                        <span className="text-[11px] text-muted-foreground">
                          → {format(new Date(s.next_run_at), 'dd MMM HH:mm', { locale: fr })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.recipients.length} destinataire{s.recipients.length > 1 ? 's' : ''}
                      {s.last_status && ` · dernier : ${s.last_status}`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(s)} aria-label="Calendrier">
                    <Calendar className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del.mutate(s.id)} aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
            <Button onClick={startNew} variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" /> Nouvelle planification
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <Select value={editing.format} onValueChange={(v) => setEditing({ ...editing, format: v as any })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="xlsx">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fréquence</Label>
                <Select value={editing.frequency || 'weekly'} onValueChange={(v) => setEditing({ ...editing, frequency: v as any })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidienne</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="monthly">Mensuelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Heure (UTC)</Label>
                <Input type="number" min={0} max={23} value={editing.hour_utc ?? 6}
                  onChange={(e) => setEditing({ ...editing, hour_utc: Number(e.target.value) })} className="h-9" />
              </div>
              {editing.frequency === 'weekly' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Jour</Label>
                  <Select value={String(editing.day_of_week ?? 1)} onValueChange={(v) => setEditing({ ...editing, day_of_week: Number(v) })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => <SelectItem key={`schedule-day-${d}`} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing.frequency === 'monthly' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Jour du mois</Label>
                  <Input type="number" min={1} max={28} value={editing.day_of_month ?? 1}
                    onChange={(e) => setEditing({ ...editing, day_of_month: Number(e.target.value) })} className="h-9" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Destinataires (emails)</Label>
              <div className="flex gap-2">
                <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="email@exemple.com"
                  className="h-9" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }} />
                <Button type="button" size="sm" onClick={addEmail}>Ajouter</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(editing.recipients || []).map((r, i) => (
                  <Badge key={`schedule-recipient-${r}-${i}`} variant="secondary" className="gap-1">
                    {r}
                    <button onClick={() => setEditing({ ...editing, recipients: editing.recipients!.filter((_, j) => j !== i) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Active</Label>
              <Switch checked={editing.is_active ?? true} onCheckedChange={(c) => setEditing({ ...editing, is_active: c })} />
            </div>
          </div>
        )}

        <DialogFooter>
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
              <Button onClick={handleSave} disabled={!editing.recipients?.length || upsert.isPending}>
                Enregistrer
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
