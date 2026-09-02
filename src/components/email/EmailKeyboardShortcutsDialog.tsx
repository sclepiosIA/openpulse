import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface EmailKeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  {
    category: "Actions",
    items: [
      { keys: ["R"], description: "Répondre au message" },
      { keys: ["Shift", "R"], description: "Répondre à tous" },
      { keys: ["F"], description: "Transférer le message" },
      { keys: ["A"], description: "Archiver la conversation" },
    ],
  },
  {
    category: "Navigation",
    items: [
      { keys: ["J"], description: "Message suivant" },
      { keys: ["K"], description: "Message précédent" },
      { keys: ["E"], description: "Tout déplier" },
      { keys: ["C"], description: "Tout replier" },
    ],
  },
  {
    category: "Affichage",
    items: [
      { keys: ["X"], description: "Basculer sélection" },
      { keys: ["?"], description: "Afficher les raccourcis" },
    ],
  },
];

export function EmailKeyboardShortcutsDialog({
  open,
  onOpenChange,
}: EmailKeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <DialogTitle>Raccourcis clavier</DialogTitle>
          </div>
          <DialogDescription>
            Utilisez ces raccourcis pour naviguer plus rapidement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="font-semibold text-sm text-foreground mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, idx) => (
                        <span key={idx}>
                          <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded shadow-sm">
                            {key}
                          </kbd>
                          {idx < item.keys.length - 1 && (
                            <span className="mx-1 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Les raccourcis sont désactivés lorsque vous saisissez du texte
        </div>
      </DialogContent>
    </Dialog>
  );
}
