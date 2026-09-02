import { Repeat } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteSingle: () => void;
  onDeleteAll: () => void;
}

export function EventDeleteRecurringDialog({ open, onOpenChange, onDeleteSingle, onDeleteAll }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Supprimer un événement récurrent
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cet événement fait partie d'une série récurrente. Que souhaitez-vous supprimer ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDeleteSingle}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Cette occurrence uniquement
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onDeleteAll}
            className="bg-destructive hover:bg-destructive/90"
          >
            Toute la série
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
