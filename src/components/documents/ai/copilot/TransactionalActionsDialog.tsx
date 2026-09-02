/**
 * Dialog transactionnel : sélectionne les éléments extraits par l'IA
 * (tâches / événements / contacts) et les crée directement dans les
 * tables du CRM/agenda.
 *
 * - Tâches → `personal_todos` (scope utilisateur)
 * - Événements → `calendar_events` (agenda par défaut de l'utilisateur)
 * - Contacts → `contacts` (établissement sélectionné)
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CalendarPlus, ListChecks, UserPlus } from 'lucide-react';

type TaskItem = { title: string; due?: string | null; assignee?: string | null; priority?: string | null };
type EventItem = {
  title: string;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  description?: string | null;
};
type ContactItem = {
  name?: string;
  nom?: string;
  prenom?: string;
  email?: string;
  phone?: string;
  telephone?: string;
  role?: string;
  fonction?: string;
};

interface Props {
  action: string;
  parsed: Record<string, unknown>;
  onClose: () => void;
}

export function TransactionalActionsDialog({ action, parsed, onClose }: Props) {
  const { user } = useAuth();
  const tasks = Array.isArray(parsed.tasks) ? (parsed.tasks as TaskItem[]) : null;
  const events = Array.isArray(parsed.events) ? (parsed.events as EventItem[]) : null;
  const contacts = Array.isArray(parsed.contacts) ? (parsed.contacts as ContactItem[]) : null;

  const items = tasks ?? events ?? contacts ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set(items.map((_, i) => i)));
  const [creating, setCreating] = useState(false);
  const [etablissementId, setEtablissementId] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set(items.map((_, i) => i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const toggle = (i: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  };

  // Établissements pour associer les contacts
  const { data: etablissements } = useQuery({
    queryKey: ['copilot-etablissements-min'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom')
        .order('nom')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!contacts,
  });

  const title = useMemo(() => {
    if (tasks) return 'Créer des tâches';
    if (events) return 'Créer des événements';
    if (contacts) return 'Créer des contacts';
    return 'Résultat IA';
  }, [tasks, events, contacts]);

  const parseDate = (s: string | null | undefined): string | null => {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  const parseIso = (s: string | null | undefined, fallbackHoursOffset = 0): string | null => {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    if (fallbackHoursOffset) d.setHours(d.getHours() + fallbackHoursOffset);
    return d.toISOString();
  };

  const handleCreate = async () => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }
    if (selected.size === 0) {
      toast.error('Aucun élément sélectionné');
      return;
    }
    setCreating(true);
    try {
      const picked = Array.from(selected).sort((a, b) => a - b);

      if (tasks) {
        const rows = picked.map((i) => {
          const t = tasks[i];
          return {
            user_id: user.id,
            title: String(t.title ?? 'Tâche').slice(0, 500),
            due_date: parseDate(t.due),
            priority: (t.priority === 'high' || t.priority === 'low' || t.priority === 'medium'
              ? t.priority
              : 'medium') as 'high' | 'low' | 'medium',
            visibility: 'personal' as const,
          };
        });
        const { error } = await supabase.from('personal_todos').insert(rows);
        if (error) throw error;
        toast.success(`${rows.length} tâche(s) créée(s) dans Mon Todo`);
      } else if (events) {
        // Trouver le calendrier par défaut de l'utilisateur
        const { data: cal, error: calErr } = await supabase
          .from('calendars')
          .select('id')
          .eq('owner_id', user.id)
          .eq('is_default', true)
          .maybeSingle();
        if (calErr) throw calErr;
        let calendarId = cal?.id as string | undefined;
        if (!calendarId) {
          const { data: anyCal } = await supabase
            .from('calendars')
            .select('id')
            .eq('owner_id', user.id)
            .limit(1)
            .maybeSingle();
          calendarId = anyCal?.id;
        }
        if (!calendarId) {
          const { data: created, error: createErr } = await supabase
            .from('calendars')
            .insert({ owner_id: user.id, name: 'Mon agenda', is_default: true, type: 'personal' })
            .select('id')
            .single();
          if (createErr) throw createErr;
          calendarId = created.id;
        }

        const rows = picked.map((i) => {
          const e = events[i];
          const start = parseIso(e.start) ?? new Date().toISOString();
          const end = parseIso(e.end) ?? parseIso(e.start, 1) ?? new Date(Date.now() + 3600000).toISOString();
          return {
            calendar_id: calendarId!,
            title: String(e.title ?? 'Événement').slice(0, 500),
            description: e.description ?? null,
            location: e.location ?? null,
            start_time: start,
            end_time: end,
            created_by: user.id,
          };
        });
        const { error } = await supabase.from('calendar_events').insert(rows);
        if (error) throw error;
        toast.success(`${rows.length} événement(s) créé(s) dans l'agenda`);
      } else if (contacts) {
        if (!etablissementId) {
          toast.error('Sélectionnez un établissement');
          setCreating(false);
          return;
        }
        const rows = picked.map((i) => {
          const c = contacts[i];
          const fullName = c.name ?? [c.prenom, c.nom].filter(Boolean).join(' ');
          const parts = fullName.trim().split(/\s+/);
          const prenom = c.prenom ?? (parts.length > 1 ? parts[0] : null);
          const nom = c.nom ?? (parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || 'Contact');
          return {
            etablissement_id: etablissementId,
            nom: String(nom).slice(0, 200),
            prenom: prenom ? String(prenom).slice(0, 200) : null,
            fonction: String(c.fonction ?? c.role ?? 'Contact').slice(0, 200),
            email: c.email ?? null,
            telephone: c.telephone ?? c.phone ?? null,
          };
        });
        const { error } = await supabase.from('contacts').insert(rows);
        if (error) throw error;
        toast.success(`${rows.length} contact(s) créé(s)`);
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Création impossible';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const Icon = tasks ? ListChecks : events ? CalendarPlus : UserPlus;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Cochez les éléments à créer directement dans votre espace.
          </DialogDescription>
        </DialogHeader>

        {contacts && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Établissement de rattachement</label>
            <Select value={etablissementId ?? ''} onValueChange={setEtablissementId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un établissement" />
              </SelectTrigger>
              <SelectContent>
                {(etablissements ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <ScrollArea className="max-h-96">
          <ul className="space-y-2">
            {items.map((it, i) => {
              const item = it as Record<string, unknown>;
              const isSelected = selected.has(i);
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 p-2 rounded-md border hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggle(i)}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(i)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    {tasks && (
                      <>
                        <div className="font-medium text-sm truncate">
                          {String(item.title ?? 'Tâche')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.due ? `Échéance : ${String(item.due)}` : 'Sans échéance'}
                          {item.priority ? ` · Priorité : ${String(item.priority)}` : ''}
                          {item.assignee ? ` · ${String(item.assignee)}` : ''}
                        </div>
                      </>
                    )}
                    {events && (
                      <>
                        <div className="font-medium text-sm truncate">
                          {String(item.title ?? 'Événement')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {String(item.start ?? '?')}
                          {item.end ? ` → ${String(item.end)}` : ''}
                          {item.location ? ` · ${String(item.location)}` : ''}
                        </div>
                      </>
                    )}
                    {contacts && (
                      <>
                        <div className="font-medium text-sm truncate">
                          {String(
                            item.name ??
                              [item.prenom, item.nom].filter(Boolean).join(' ') ??
                              'Contact',
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[item.fonction ?? item.role, item.email, item.telephone ?? item.phone]
                            .filter(Boolean)
                            .map(String)
                            .join(' · ')}
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="text-sm text-muted-foreground p-4 text-center">
                Aucun élément détecté.
              </li>
            )}
          </ul>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={creating || selected.size === 0}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer {selected.size} élément{selected.size > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
