import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenameDocument } from "@/hooks/documents/useDocuments";
import type { DocumentWithRelations } from "@/types/documents";

interface RenameDocumentDialogProps {
  document: DocumentWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameDocumentDialog({ document, open, onOpenChange }: RenameDocumentDialogProps) {
  const [name, setName] = useState("");
  const { mutate: renameDocument, isPending } = useRenameDocument();

  useEffect(() => {
    if (document) {
      setName(document.name);
    }
  }, [document]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!document || !name.trim()) return;

    renameDocument({
      id: document.id,
      newName: name.trim()
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Renommer le document</DialogTitle>
            <DialogDescription>
              Entrez un nouveau nom pour ce document.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rename-document">Nouveau nom</Label>
              <Input
                id="rename-document"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du document"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? "Renommage..." : "Renommer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
