import { useState, useEffect, useCallback } from "react";
import { debug } from "@/lib/debug";
import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClauseRichEditor } from "./LazyClauseRichEditor";
import { ClauseAIToolbar } from "./ClauseAIToolbar";
import {
  Sparkles,
  Loader2,
  Eye,
  FileEdit,
  Code,
  Save,
} from "lucide-react";
import { ContratTemplate, CONTRAT_TYPE_LABELS, ContratType } from "@/types/contrats";
import { useUpdateTemplate, useCreateTemplate } from "@/hooks/contracts/useContratTemplates";
import { callContractAiAssist } from "@/services/contrats/contractAiAssist";
import { toast } from "sonner";

interface TemplateEditorDialogProps {
  template: ContratTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateEditorDialog({ template, open, onOpenChange }: TemplateEditorDialogProps) {
  const [nom, setNom] = useState("");
  const [type, setType] = useState<string>("abonnement");
  const [description, setDescription] = useState("");
  const [contenuHtml, setContenuHtml] = useState("");
  const [showAIToolbar, setShowAIToolbar] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const { mutateAsync: updateTemplate, isPending: isUpdating } = useUpdateTemplate();
  const { mutateAsync: createTemplate, isPending: isCreating } = useCreateTemplate();

  const isNew = !template;
  const isPending = isUpdating || isCreating;

  useEffect(() => {
    if (template) {
      setNom(template.nom);
      setType(template.type);
      setDescription(template.description || "");
      setContenuHtml(template.contenu_html || "");
    } else {
      setNom("");
      setType("abonnement");
      setDescription("");
      setContenuHtml("");
    }
    setShowAIToolbar(false);
    setActiveTab("edit");
  }, [template, open]);

  // Extract variables from content
  const extractVariables = useCallback(() => {
    const text = contenuHtml.replace(/<[^>]*>/g, '');
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "").trim()))];
  }, [contenuHtml]);

  const variables = extractVariables();

  const handleSave = async () => {
    if (!nom.trim()) {
      toast.error("Le nom est requis");
      return;
    }

    try {
      if (isNew) {
        await createTemplate({
          nom,
          type: type as ContratType,
          description,
          contenu_html: contenuHtml,
          variables,
          est_actif: true,
        } as any);
      } else {
        await updateTemplate({
          id: template!.id,
          nom,
          type: type as ContratType,
          description,
          contenu_html: contenuHtml,
          variables,
        } as any);
      }
      onOpenChange(false);
    } catch (error) {
      debug.error("Erreur sauvegarde template:", error);
    }
  };

  const handleGenerateStructure = async () => {
    if (!nom.trim()) {
      toast.error("Saisissez un nom de template d'abord");
      return;
    }

    setIsGenerating(true);
    try {
      const typeLabel = CONTRAT_TYPE_LABELS[type as ContratType] || type;
      const data = await callContractAiAssist({
        action: 'generate_structure',
        content: "",
        sectionTitle: nom,
        customPrompt: `Génère une structure de base pour un contrat de type "${typeLabel}" nommé "${nom}". ${description ? `Description: ${description}` : ''}`,
      });

      if (data?.result) {
        setContenuHtml(data.result);
        toast.success("Structure générée");
      }
    } catch (err: any) {
      debug.error('AI Error:', err);
      toast.error("Erreur lors de la génération");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIApply = (newContent: string) => {
    setContenuHtml(newContent);
    setShowAIToolbar(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-[100dvw] h-[100dvh] max-w-none max-h-none overflow-hidden flex flex-col p-0 rounded-none sm:rounded-none sm:w-[100dvw] sm:h-[100dvh] sm:max-w-none sm:max-h-none">
        {/* Header sticky */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-xl">
              {template ? 'Modifier le modèle' : 'Nouveau modèle de contrat'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {template ? 'Modifiez les informations et le contenu du modèle' : 'Créez un nouveau modèle avec l\'éditeur WYSIWYG et l\'IA'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isPending || !nom.trim()}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {template ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>

        {/* Main content - 2 columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Metadata */}
          <div className="w-72 shrink-0 border-r bg-muted/30 p-6 overflow-y-auto space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nom" className="text-sm font-medium">Nom du modèle *</Label>
              <Input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Contrat de prestation SaaS"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-medium">Type de contrat</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRAT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du modèle..."
                rows={4}
                className="bg-background resize-none"
              />
            </div>

            {/* Variables détectées */}
            {variables.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Variables détectées
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((variable) => (
                    <Badge
                      key={`tpl-var-${variable}`}
                      variant="secondary"
                      className="text-xs font-mono bg-primary/10 text-primary"
                    >
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI Generate button for new templates */}
            {isNew && (
              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGenerateStructure}
                  disabled={isGenerating || !type}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Générer une structure IA
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Génère une structure de base pour ce type de contrat
                </p>
              </div>
            )}
          </div>

          {/* Right side - Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 border-b bg-background shrink-0">
                <TabsList>
                  <TabsTrigger value="edit" className="gap-2">
                    <FileEdit className="h-4 w-4" />
                    Édition
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Aperçu
                  </TabsTrigger>
                </TabsList>
                
                {activeTab === 'edit' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAIToolbar(!showAIToolbar)}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {showAIToolbar ? 'Masquer IA' : 'Assistance IA'}
                  </Button>
                )}
              </div>

              <TabsContent value="edit" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                {showAIToolbar && (
                  <div className="shrink-0 border-b">
                    <ClauseAIToolbar
                      content={contenuHtml}
                      clauseTitle={nom || 'Nouveau modèle'}
                      onApply={handleAIApply}
                      onClose={() => setShowAIToolbar(false)}
                      variant="inline"
                    />
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-6">
                  <ClauseRichEditor
                    value={contenuHtml}
                    onChange={setContenuHtml}
                    placeholder="Rédigez le contenu du modèle de contrat..."
                    className="h-full min-h-[400px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview" className="flex-1 overflow-y-auto m-0 p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-card rounded-lg border shadow-sm p-8">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      // safe: DOMPurify.sanitize applied inline before injection
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contenuHtml || '<p class="text-muted-foreground italic">Aucun contenu à prévisualiser</p>') }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}