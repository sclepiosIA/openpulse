import { useState } from "react";
import { debug } from "@/lib/debug";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Plus, MoreHorizontal, Pencil, Trash2, BookTemplate, FileText, Search, Copy, Sparkles, Save, Loader2, Code } from "lucide-react";
import { useContratTemplates, useContratClauses, useCreateClause, useUpdateClause, useDeleteClause } from "@/hooks/contracts/useContratTemplates";
import { CONTRAT_TYPE_LABELS, CLAUSE_CATEGORIES, ContratType, ContratClause, ContratTemplate } from "@/types/contrats";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ClauseRichEditor } from "./LazyClauseRichEditor";
import { ClauseAIToolbar } from "./ClauseAIToolbar";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function ContratsTemplates() {
  const [activeTab, setActiveTab] = useState("templates");
  const [search, setSearch] = useState("");
  const [showClauseForm, setShowClauseForm] = useState(false);
  const [editingClause, setEditingClause] = useState<ContratClause | null>(null);
  const [clauseToDelete, setClauseToDelete] = useState<string | null>(null);
  const [showClauseAI, setShowClauseAI] = useState(false);
  
  // Clause form state
  const [clauseForm, setClauseForm] = useState({
    title: "",
    category: "Général",
    content: "",
    is_required: false,
    order_index: 0,
  });
  
  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<ContratTemplate | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useContratTemplates();
  const { data: clauses, isLoading: clausesLoading } = useContratClauses();
  const { mutateAsync: createClause, isPending: isCreatingClause } = useCreateClause();
  const { mutateAsync: updateClause, isPending: isUpdatingClause } = useUpdateClause();
  const { mutate: deleteClause, isPending: isDeleting } = useDeleteClause();

  const filteredClauses = clauses?.filter(c =>
    c.titre.toLowerCase().includes(search.toLowerCase()) ||
    c.categorie.toLowerCase().includes(search.toLowerCase())
  );

  const openClauseForm = (clause?: ContratClause) => {
    if (clause) {
      setEditingClause(clause);
      setClauseForm({
        title: clause.titre,
        category: clause.categorie,
        content: clause.contenu_html,
        is_required: clause.est_obligatoire,
        order_index: clause.ordre,
      });
    } else {
      setEditingClause(null);
      setClauseForm({
        title: "",
        category: "Général",
        content: "",
        is_required: false,
        order_index: (clauses?.length || 0) + 1,
      });
    }
    setShowClauseAI(false);
    setShowClauseForm(true);
  };

  const closeClauseForm = () => {
    setShowClauseForm(false);
    setEditingClause(null);
  };

  const openTemplateEditor = (template?: ContratTemplate) => {
    setEditingTemplate(template || null);
    setShowTemplateEditor(true);
  };

  const handleSubmitClause = async () => {
    if (!clauseForm.title.trim() || !clauseForm.content.trim()) {
      toast.error("Le titre et le contenu sont requis");
      return;
    }

    try {
      const data = {
        titre: clauseForm.title,
        categorie: clauseForm.category,
        contenu_html: clauseForm.content,
        est_obligatoire: clauseForm.is_required,
        ordre: clauseForm.order_index,
      };

      if (editingClause) {
        await updateClause({ id: editingClause.id, ...data });
      } else {
        await createClause(data);
      }
      closeClauseForm();
    } catch (error) {
      debug.error("Erreur sauvegarde clause:", error);
    }
  };

  const handleDeleteClause = () => {
    if (clauseToDelete) {
      deleteClause(clauseToDelete);
      setClauseToDelete(null);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Contenu copié dans le presse-papiers");
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <BookTemplate className="h-4 w-4" />
            Modèles de contrats
          </TabsTrigger>
          <TabsTrigger value="clauses" className="gap-2">
            <FileText className="h-4 w-4" />
            Clauses types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Modèles de contrats</CardTitle>
                <Button size="sm" onClick={() => openTemplateEditor()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau modèle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={`tpl-skel-${i}`} className="h-20 w-full" />
                  ))}
                </div>
              ) : templates && templates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <Card 
                      key={template.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer group hover:border-primary/50"
                      onClick={() => openTemplateEditor(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium group-hover:text-primary transition-colors">{template.nom}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {template.description}
                            </p>
                            <Badge variant="outline" className="mt-2">
                              {CONTRAT_TYPE_LABELS[template.type as ContratType]}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" aria-label="Plus d'options">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openTemplateEditor(template); }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard(template.contenu_html || ""); }}>
                                <Copy className="h-4 w-4 mr-2" />
                                Dupliquer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          {template.variables.length} variables
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookTemplate className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Aucun modèle</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Créez votre premier modèle de contrat
                  </p>
                  <Button onClick={() => openTemplateEditor()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un modèle
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clauses" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <CardTitle>Clauses types</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 w-[200px]"
                    />
                  </div>
                  <Button size="sm" onClick={() => openClauseForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle clause
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {clausesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={`ctrl-skel-${i}`} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredClauses && filteredClauses.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titre</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Obligatoire</TableHead>
                        <TableHead>Ordre</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClauses.map((clause) => (
                        <HoverCard key={clause.id} openDelay={300}>
                          <HoverCardTrigger asChild>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => openClauseForm(clause)}
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium">{clause.titre}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {clause.contenu_html.replace(/<[^>]*>/g, '').slice(0, 80)}...
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{clause.categorie}</Badge>
                              </TableCell>
                              <TableCell>
                                {clause.est_obligatoire ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Oui</Badge>
                                ) : (
                                  <span className="text-muted-foreground">Non</span>
                                )}
                              </TableCell>
                              <TableCell>{clause.ordre}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" aria-label="Plus d'options">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openClauseForm(clause); }}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard(clause.contenu_html); }}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copier le contenu
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setClauseToDelete(clause.id); }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" side="right">
                            <div className="space-y-2">
                              <h4 className="font-semibold">{clause.titre}</h4>
                              <Badge variant="outline" className="text-xs">{clause.categorie}</Badge>
                              <div
                                className="text-sm text-muted-foreground prose prose-sm max-h-[150px] overflow-auto"
                                // safe: DOMPurify.sanitize applied inline before injection
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(clause.contenu_html) }}
                              />
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Aucune clause</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Les clauses types facilitent la rédaction de vos contrats
                  </p>
                  <Button onClick={() => openClauseForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une clause
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog création/édition clause - PLEIN ÉCRAN */}
      <Dialog open={showClauseForm} onOpenChange={setShowClauseForm}>
        <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-[100dvw] h-[100dvh] max-w-none max-h-none overflow-hidden flex flex-col p-0 rounded-none sm:rounded-none sm:w-[100dvw] sm:h-[100dvh] sm:max-w-none sm:max-h-none">
          {/* Header sticky */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-xl">
                {editingClause ? 'Modifier la clause' : 'Nouvelle clause'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {editingClause ? 'Modifiez le contenu et les paramètres de la clause' : 'Créez une nouvelle clause réutilisable'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClauseAI(!showClauseAI)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {showClauseAI ? 'Masquer IA' : 'Assistance IA'}
              </Button>
              <Button variant="outline" onClick={closeClauseForm}>
                Annuler
              </Button>
              <Button onClick={handleSubmitClause} disabled={isCreatingClause || isUpdatingClause}>
                {(isCreatingClause || isUpdatingClause) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                <Save className="h-4 w-4 mr-2" />
                {editingClause ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>

          {/* Main content - 2 columns */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar - Metadata */}
            <div className="w-64 shrink-0 border-r bg-muted/30 p-6 overflow-y-auto space-y-5">
              <div className="space-y-2">
                <Label htmlFor="clause-title" className="text-sm font-medium">Titre *</Label>
                <Input
                  id="clause-title"
                  value={clauseForm.title}
                  onChange={(e) => setClauseForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Clause de confidentialité"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clause-category" className="text-sm font-medium">Catégorie</Label>
                <Select 
                  value={clauseForm.category} 
                  onValueChange={(v) => setClauseForm(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger id="clause-category" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAUSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clause-order" className="text-sm font-medium">Ordre d'affichage</Label>
                <Input
                  id="clause-order"
                  type="number"
                  value={clauseForm.order_index}
                  onChange={(e) => setClauseForm(prev => ({ ...prev, order_index: parseInt(e.target.value) || 0 }))}
                  className="bg-background"
                />
              </div>

              <div className="flex items-center gap-3 py-2">
                <Switch
                  id="clause-required"
                  checked={clauseForm.is_required}
                  onCheckedChange={(checked) => setClauseForm(prev => ({ ...prev, is_required: checked }))}
                />
                <Label htmlFor="clause-required" className="text-sm cursor-pointer">
                  Clause obligatoire
                </Label>
              </div>

              {/* Variables détectées */}
              {clauseForm.content && (
                (() => {
                  const vars = clauseForm.content.match(/\{\{([^}]+)\}\}/g) || [];
                  if (vars.length === 0) return null;
                  return (
                    <div className="space-y-2 pt-4 border-t">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Variables
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {vars.map((v) => (
                          <Badge key={`tpl-var-${v}`} variant="secondary" className="text-xs font-mono bg-primary/10 text-primary">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Right side - Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {showClauseAI && (
                <div className="shrink-0 border-b">
                  <ClauseAIToolbar
                    content={clauseForm.content}
                    clauseTitle={clauseForm.title || 'Nouvelle clause'}
                    onApply={(result) => setClauseForm(prev => ({ ...prev, content: result }))}
                    onClose={() => setShowClauseAI(false)}
                    variant="inline"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-6">
                <ClauseRichEditor
                  value={clauseForm.content}
                  onChange={(val) => setClauseForm(prev => ({ ...prev, content: val }))}
                  placeholder="Rédigez le contenu de la clause..."
                  className="h-full min-h-[400px]"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Editor Dialog */}
      <TemplateEditorDialog
        template={editingTemplate}
        open={showTemplateEditor}
        onOpenChange={setShowTemplateEditor}
      />

      <ConfirmDialog
        open={!!clauseToDelete}
        onOpenChange={(open) => !open && setClauseToDelete(null)}
        title="Supprimer cette clause ?"
        description="Cette clause ne sera plus disponible pour vos nouveaux contrats."
        onConfirm={handleDeleteClause}
        loading={isDeleting}
      />
    </div>
  );
}