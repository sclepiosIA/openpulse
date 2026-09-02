import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useUpdateDashboard } from '@/hooks/dashboard/useCustomDashboards';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomDashboard } from '@/types/report';

function useTeamMembersList() {
  return useQuery({
    queryKey: ['profiles_for_share'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, prenom, nom, email, actif').eq('actif', true).limit(200);
      return (data || []).map((p: any) => ({ id: p.id, full_name: `${p.prenom || ''} ${p.nom || ''}`.trim(), email: p.email }));
    },
    staleTime: 5 * 60_000,
  });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: CustomDashboard;
}

export function ShareDialog({ open, onOpenChange, dashboard }: Props) {
  const [isShared, setIsShared] = useState(dashboard.is_shared);
  const [sharedWith, setSharedWith] = useState<string[]>(dashboard.shared_with || []);
  const { data: members } = useTeamMembersList();
  const update = useUpdateDashboard();

  const handleSave = async () => {
    await update.mutateAsync({ id: dashboard.id, patch: { is_shared: isShared, shared_with: sharedWith } });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Partager le rapport</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label>Activer le partage</Label>
            <Switch checked={isShared} onCheckedChange={setIsShared} />
          </div>
          {isShared && (
            <div className="space-y-2">
              <Label className="text-xs">Utilisateurs autorisés</Label>
              <div className="flex flex-wrap gap-1.5">
                {sharedWith.map(uid => {
                  const m = (members as any[])?.find((x: any) => x.id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1">
                      {m?.full_name || m?.email || uid.slice(0, 8)}
                      <button onClick={() => setSharedWith(sharedWith.filter(x => x !== uid))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                onChange={(e) => {
                  if (e.target.value && !sharedWith.includes(e.target.value)) {
                    setSharedWith([...sharedWith, e.target.value]);
                  }
                  e.target.value = '';
                }}
              >
                <option value="">Ajouter un membre…</option>
                {(members as any[])?.filter((m: any) => !sharedWith.includes(m.id)).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={update.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
