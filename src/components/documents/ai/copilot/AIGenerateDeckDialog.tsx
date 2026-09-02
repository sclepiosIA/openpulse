import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIGenerateDeckDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerated: (deck: GeneratedDeck) => void;
  documentId?: string | null;
}

export interface GeneratedDeck {
  title?: string;
  slides: { title: string; bullets: string[]; notes?: string }[];
}

export function AIGenerateDeckDialog({
  open,
  onOpenChange,
  onGenerated,
  documentId,
}: AIGenerateDeckDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [slideCount, setSlideCount] = useState(10);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Décrivez le sujet du deck");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("presentation-ai-generate", {
        body: {
          prompt: prompt.trim(),
          audience: audience.trim() || undefined,
          slideCount,
          documentId: documentId ?? null,
        },
      });
      if (error) throw error;
      const payload = data as { slides?: GeneratedDeck["slides"]; title?: string; error?: string };
      if (payload?.error) throw new Error(payload.error);
      if (!payload?.slides || payload.slides.length === 0) {
        throw new Error("Aucune slide générée");
      }
      onGenerated({ title: payload.title, slides: payload.slides });
      toast.success(`${payload.slides.length} slides générées`);
      onOpenChange(false);
      setPrompt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur IA");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Générer un deck avec l'IA
          </DialogTitle>
          <DialogDescription>
            Décrivez le sujet, l'IA structure titre + puces + notes orateur pour chaque slide.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="deck-prompt">Sujet / objectif</Label>
            <Textarea
              id="deck-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: pitch de la solution OpenPulse pour un directeur d'EHPAD"
              className="min-h-24"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="deck-audience">Public cible (optionnel)</Label>
              <Input
                id="deck-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ex: direction, financeurs…"
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deck-count">Nombre de slides</Label>
              <Input
                id="deck-count"
                type="number"
                min={3}
                max={25}
                value={slideCount}
                onChange={(e) => setSlideCount(Math.max(3, Math.min(25, Number(e.target.value) || 10)))}
                disabled={busy}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={handleGenerate} disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Générer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
