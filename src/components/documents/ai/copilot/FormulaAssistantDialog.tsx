import { useState } from "react";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FormulaAssistantDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplyFormula?: (formula: string) => void;
  headers?: string[];
  sampleRows?: unknown[][];
  currentFormula?: string;
  documentId?: string | null;
}

type Mode = "from_nl" | "explain" | "fix";

interface Result {
  formula?: string;
  explanation?: string;
  examples?: string[];
}

export function FormulaAssistantDialog({
  open,
  onOpenChange,
  onApplyFormula,
  headers,
  sampleRows,
  currentFormula,
  documentId,
}: FormulaAssistantDialogProps) {
  const [mode, setMode] = useState<Mode>("from_nl");
  const [prompt, setPrompt] = useState("");
  const [formula, setFormula] = useState(currentFormula ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        mode,
        headers,
        sampleRows,
        documentId: documentId ?? null,
        locale: "fr",
      };
      if (mode === "from_nl") body.prompt = prompt;
      if (mode === "explain") body.formula = formula;
      if (mode === "fix") {
        body.formula = formula;
        body.prompt = prompt;
      }
      const { data, error } = await supabase.functions.invoke("spreadsheet-ai-formula", { body });
      if (error) throw error;
      const payload = data as Result & { error?: string };
      if (payload?.error) throw new Error(payload.error);
      setResult(payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur IA");
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    if (!result?.formula || !onApplyFormula) return;
    onApplyFormula(result.formula);
    toast.success("Formule insérée");
    onOpenChange(false);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copié");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistant formules IA
          </DialogTitle>
          <DialogDescription>
            Générez, expliquez ou corrigez une formule tableur en langage naturel.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setResult(null); }}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="from_nl">Générer</TabsTrigger>
            <TabsTrigger value="explain">Expliquer</TabsTrigger>
            <TabsTrigger value="fix">Corriger</TabsTrigger>
          </TabsList>

          <TabsContent value="from_nl" className="space-y-3 mt-3">
            <Label htmlFor="fnl-prompt">Décrivez ce que la formule doit faire</Label>
            <Textarea
              id="fnl-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: somme des lignes où la colonne Statut vaut 'Payé'"
              className="min-h-20"
              disabled={busy}
            />
          </TabsContent>

          <TabsContent value="explain" className="space-y-3 mt-3">
            <Label htmlFor="fex-formula">Formule à expliquer</Label>
            <Input
              id="fex-formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="=SOMME(B2:B10)"
              disabled={busy}
            />
          </TabsContent>

          <TabsContent value="fix" className="space-y-3 mt-3">
            <Label htmlFor="ffix-formula">Formule à corriger</Label>
            <Input
              id="ffix-formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="=SOMME(B2:B10"
              disabled={busy}
            />
            <Label htmlFor="ffix-prompt">Objectif attendu (optionnel)</Label>
            <Input
              id="ffix-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: elle doit renvoyer 0 si la plage est vide"
              disabled={busy}
            />
          </TabsContent>
        </Tabs>

        {result && (
          <div className="space-y-2 mt-2 rounded-md border p-3 bg-muted/30">
            {result.formula && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Formule</div>
                <div className="flex items-start gap-2">
                  <code className="flex-1 text-sm font-mono bg-background rounded px-2 py-1 border break-all">
                    {result.formula}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopy(result.formula!)}
                    aria-label="Copier"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            {result.explanation && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Explication</div>
                <p className="text-sm">{result.explanation}</p>
              </div>
            )}
            {result.examples && result.examples.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Exemples</div>
                <ul className="list-disc ml-5 text-sm space-y-0.5">
                  {result.examples.map((ex, i) => (
                    <li key={i} className="font-mono text-xs">{ex}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Fermer
          </Button>
          {result?.formula && onApplyFormula && (
            <Button onClick={handleApply}>
              <Check className="mr-2 h-4 w-4" />
              Insérer
            </Button>
          )}
          <Button
            onClick={run}
            disabled={
              busy ||
              (mode === "from_nl" && !prompt.trim()) ||
              (mode !== "from_nl" && !formula.trim())
            }
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Lancer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
