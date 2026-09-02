import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { useCreateEmailTemplate } from "@/hooks/email/useEmailTemplates";

const CATEGORIES = [
  "Commercial",
  "Support",
  "Technique",
  "Administratif",
  "RH",
  "Autre",
] as const;

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSubject?: string;
  initialContent?: string;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  initialSubject = "",
  initialContent = "",
}: CreateTemplateDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState(initialSubject);
  const [content, setContent] = useState(initialContent);

  const createTemplate = useCreateEmailTemplate();

  // Reset form when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setName("");
      setCategory("");
      setSubject(initialSubject);
      setContent(initialContent);
    }
  }, [open, initialSubject, initialContent]);

  const detectedVariables = extractVariables(content + " " + subject);

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createTemplate.mutateAsync({
      name: name.trim(),
      subject: subject.trim(),
      content: content.trim(),
      category: category || null,
      variables: detectedVariables,
      is_active: true,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un template d'email</DialogTitle>
          <DialogDescription>
            Sauvegardez ce contenu comme modèle réutilisable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Nom du template <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Relance commerciale, Bienvenue client..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="template-category">
                <SelectValue placeholder="Sélectionner une catégorie..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-subject">Sujet</Label>
            <Input
              id="template-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet de l'email..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-content">Contenu</Label>
            <Textarea
              id="template-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Corps du template... Utilisez {{variable}} pour les champs dynamiques."
              rows={8}
              className="resize-none"
            />
          </div>

          {detectedVariables.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Variables détectées
              </Label>
              <div className="flex flex-wrap gap-1">
                {detectedVariables.map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createTemplate.isPending}
            type="button"
          >
            {createTemplate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Créer le template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
