import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";
import { useRolePermissions } from "@/hooks/auth/useRolePermissions";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
  requiresPermission?: boolean;
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: 'rh' | 'equipe' | 'global';
}

export function KeyboardShortcutsHelp({ open, onOpenChange, context = 'global' }: KeyboardShortcutsHelpProps) {
  const permissions = useRolePermissions();

  const shortcuts: Record<string, Shortcut[]> = {
    navigation: [
      { keys: ['Alt', '1-6'], description: 'Naviguer vers l\'onglet N', category: 'Navigation' },
      { keys: ['Ctrl', 'Tab'], description: 'Onglet suivant', category: 'Navigation' },
      { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Onglet précédent', category: 'Navigation' },
    ],
    search: [
      { keys: ['Ctrl', 'K'], description: 'Recherche globale', category: 'Recherche' },
      { keys: ['Ctrl', 'F'], description: 'Rechercher dans la page', category: 'Recherche' },
    ],
    actions: [
      { keys: ['Ctrl', 'S'], description: 'Ajouter un salaire', category: 'Actions RH', requiresPermission: permissions.canEditSalaries },
      { keys: ['Ctrl', 'E'], description: 'Exporter les données', category: 'Actions RH', requiresPermission: permissions.canExportPayroll },
      { keys: ['Ctrl', 'N'], description: 'Nouveau membre', category: 'Actions Équipe', requiresPermission: permissions.isAdmin },
    ],
    help: [
      { keys: ['?'], description: 'Afficher cette aide', category: 'Aide' },
      { keys: ['Esc'], description: 'Fermer les dialogues', category: 'Aide' },
    ],
  };

  // Filtrer les raccourcis selon le contexte et les permissions
  const getFilteredShortcuts = () => {
    const allShortcuts = Object.values(shortcuts).flat();
    
    return allShortcuts.filter(shortcut => {
      // Filtrer selon le contexte
      if (context === 'rh' && shortcut.category.includes('Équipe')) return false;
      if (context === 'equipe' && shortcut.category.includes('RH')) return false;
      
      // Filtrer selon les permissions
      if (shortcut.requiresPermission !== undefined && !shortcut.requiresPermission) return false;
      
      return true;
    });
  };

  const groupedShortcuts = getFilteredShortcuts().reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = [];
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Raccourcis Clavier
          </DialogTitle>
          <DialogDescription>
            Utilisez ces raccourcis pour naviguer plus rapidement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={shortcut.description || `shortcut-${index}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key) => (
                        <Badge key={key} variant="outline" className="font-mono text-xs">
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Astuce : Sur Mac, utilisez Cmd au lieu de Ctrl
        </div>
      </DialogContent>
    </Dialog>
  );
}
