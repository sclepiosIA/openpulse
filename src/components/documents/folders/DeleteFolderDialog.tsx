import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFolders } from "@/hooks/documents/useFolders";
import type { DocumentFolder } from "@/types/folders";

interface DeleteFolderDialogProps {
  folder: DocumentFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteFolderDialog({ 
  folder, 
  open, 
  onOpenChange,
  onDeleted 
}: DeleteFolderDialogProps) {
  const { deleteFolder, isDeleting } = useFolders();

  const handleDelete = () => {
    if (!folder) return;

    deleteFolder(folder.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le dossier ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Le dossier "{folder?.name}" et tout son contenu 
            (sous-dossiers et documents) seront définitivement supprimés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
