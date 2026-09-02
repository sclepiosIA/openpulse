import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/email/LazyRichTextEditor";
import { useUpdateForumPost } from "@/hooks/forum/useForumPosts";
import { toast } from "sonner";

interface ForumPost {
  id: string;
  titre: string;
  contenu: string;
  theme: string;
  visibilite: 'etablissement' | 'global';
  etablissement_id?: string;
}

interface EditPostDialogProps {
  post: ForumPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPostDialog({ post, open, onOpenChange }: EditPostDialogProps) {
  const [titre, setTitre] = useState(post.titre);
  const [contenu, setContenu] = useState(post.contenu);
  const [theme, setTheme] = useState(post.theme);
  
  const updatePost = useUpdateForumPost();

  useEffect(() => {
    if (open) {
      setTitre(post.titre);
      setContenu(post.contenu);
      setTheme(post.theme);
    }
  }, [open, post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titre.trim() || !contenu.trim() || !theme) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      await updatePost.mutateAsync({
        postId: post.id,
        updates: { titre, contenu, theme: theme as any }
      });
      onOpenChange(false);
    } catch (error: unknown) {
      debug.error('Error updating post:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Modifier le post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre du post"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Thème *</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un thème" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pmsi">PMSI</SelectItem>
                <SelectItem value="smr">SMR</SelectItem>
                <SelectItem value="urgences">Urgences</SelectItem>
                <SelectItem value="completion_dossier">Complétion dossier</SelectItem>
                <SelectItem value="dictee_vocale">Dictée vocale</SelectItem>
                <SelectItem value="astuces">Astuces</SelectItem>
                <SelectItem value="bugs">Bugs</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contenu *</Label>
            <RichTextEditor
              content={contenu}
              onChange={setContenu}
              placeholder="Décrivez votre question ou votre problème..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updatePost.isPending}>
              {updatePost.isPending ? "Modification..." : "Modifier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
