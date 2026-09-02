import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useDeleteRDProjet, useRDEpics, useRDUserStories, useRDSprints } from '@/hooks/rd/useRD';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { RDProjet } from '@/types/rd';

interface DeleteProjetDialogProps {
  projet: RDProjet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteProjetDialog({ projet, open, onOpenChange, onDeleted }: DeleteProjetDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const deleteProjet = useDeleteRDProjet();
  
  const { data: epics } = useRDEpics(projet.id);
  const { data: stories } = useRDUserStories(projet.id);
  const { data: sprints } = useRDSprints(projet.id);

  const epicCount = epics?.length || 0;
  const storyCount = stories?.length || 0;
  const sprintCount = sprints?.length || 0;

  const canDelete = confirmText.toLowerCase() === projet.nom.toLowerCase();

  const handleDelete = async () => {
    await deleteProjet.mutateAsync(projet.id);
    setConfirmText('');
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Supprimer le projet
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Vous êtes sur le point de supprimer définitivement le projet{' '}
                <strong>"{projet.nom}"</strong>.
              </p>
              
              {(epicCount > 0 || storyCount > 0 || sprintCount > 0) && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-destructive">
                    Cette action supprimera également :
                  </p>
                  <ul className="text-sm space-y-1 text-foreground">
                    {epicCount > 0 && <li>• {epicCount} epic{epicCount > 1 ? 's' : ''}</li>}
                    {storyCount > 0 && <li>• {storyCount} user stor{storyCount > 1 ? 'ies' : 'y'}</li>}
                    {sprintCount > 0 && <li>• {sprintCount} sprint{sprintCount > 1 ? 's' : ''}</li>}
                  </ul>
                </div>
              )}
              
              <div className="space-y-2">
                <p className="text-sm">
                  Pour confirmer, tapez le nom du projet :{' '}
                  <strong className="text-foreground">{projet.nom}</strong>
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Tapez le nom du projet"
                  className="font-mono"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText('')}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!canDelete || deleteProjet.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleteProjet.isPending ? 'Suppression...' : 'Supprimer définitivement'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
