import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreVertical,
  Trash2,
  Edit2,
  Download,
} from 'lucide-react';
import { EditProjetDialog } from './EditProjetDialog';
import { DeleteProjetDialog } from './DeleteProjetDialog';
import type { RDProjet } from '@/types/rd';

interface ProjetActionsMenuProps {
  projet: RDProjet;
  onDeleted?: () => void;
}

export function ProjetActionsMenu({ projet, onDeleted }: ProjetActionsMenuProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleExport = () => {
    const exportData = {
      ...projet,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projet-${projet.nom.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Plus d'options">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Modifier le projet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter (JSON)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer le projet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProjetDialog
        projet={projet}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <DeleteProjetDialog
        projet={projet}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDeleted={onDeleted}
      />
    </>
  );
}
