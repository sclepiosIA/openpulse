import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useWorkflowVersions, useRestoreWorkflowVersion, type WorkflowVersion } from '@/hooks/workflows/useWorkflowVersions';

interface Props {
  workflow_id: string;
  onRestored?: () => void;
}

export function WorkflowVersionsDialog({ workflow_id, onRestored }: Props) {
  const [open, setOpen] = useState(false);
  const { data: versions, isLoading } = useWorkflowVersions(open ? workflow_id : undefined);
  const restoreMut = useRestoreWorkflowVersion();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleRestore = async (v: WorkflowVersion) => {
    await restoreMut.mutateAsync(v);
    setConfirmId(null);
    setOpen(false);
    onRestored?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" /> Versions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Historique des versions
          </DialogTitle>
          <DialogDescription>
            Chaque modification du graphe ou du déclencheur est archivée. Vous pouvez restaurer une version antérieure.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-2 px-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
          ) : !versions?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune version archivée pour le moment.
            </p>
          ) : (
            <div className="space-y-2 py-2">
              {versions.map((v) => (
                <div key={v.id} className="border rounded-lg p-3 hover:bg-muted/40 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">v{v.version_number}</Badge>
                        <span className="font-medium text-sm truncate">{v.nom}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(v.created_at), 'PPp', { locale: fr })} · {v.graph?.nodes?.length ?? 0} nœuds · {v.graph?.edges?.length ?? 0} liens
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Déclencheur : <span className="font-mono">{v.trigger_type}</span>
                      </p>
                      {v.comment && <p className="text-xs italic mt-1">{v.comment}</p>}
                    </div>
                    {confirmId === v.id ? (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Annuler</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRestore(v)} disabled={restoreMut.isPending}>
                          {restoreMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmer'}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setConfirmId(v.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
