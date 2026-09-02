import { useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  Sparkles,
  FileText,
  ClipboardList,
  BarChart3,
  FileCheck,
  StickyNote,
  Mail,
  Building2,
  CheckSquare,
  Users,
  Calendar,
  Loader2,
  Download,
  Eye,
  ChevronRight,
  X,
  ArrowLeft,
  Settings2,
  Receipt,
  FileSpreadsheet,
  RotateCcw,
  MessageSquare,
  Microscope,
  GraduationCap,
  UserPlus,
  Headphones,
  Wallet,
  FileSignature,
  FolderOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/shared/use-toast';
import { exportToPdf } from '@/lib/documentExport';
import { processIcsUids } from '@/lib/icsLinkPostProcessor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

type DocType = 'compte_rendu' | 'plan_action' | 'rapport' | 'synthese' | 'note_interne';
type SourceType = 'emails' | 'etablissements' | 'taches' | 'contacts' | 'calendar' | 'factures' | 'devis' | 'contrats' | 'avoirs' | 'forum' | 'rd' | 'formations' | 'recrutement' | 'support' | 'tresorerie' | 'documents';
type Tone = 'formal' | 'concise' | 'detailed';

interface HelpMeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentCreated?: (html: string, title: string) => void;
  defaultEtablissementId?: string;
}

const DOC_TYPES: { type: DocType; icon: typeof FileText; label: string; desc: string }[] = [
  { type: 'compte_rendu', icon: FileCheck, label: 'Compte-rendu', desc: 'Synthèse de réunion ou d\'activité' },
  { type: 'plan_action', icon: ClipboardList, label: "Plan d'action", desc: 'Objectifs, actions et échéances' },
  { type: 'rapport', icon: BarChart3, label: 'Rapport', desc: 'Analyse détaillée avec recommandations' },
  { type: 'synthese', icon: FileText, label: 'Synthèse', desc: 'Note concise avec points clés' },
  { type: 'note_interne', icon: StickyNote, label: 'Note interne', desc: 'Communication interne' },
];

const SOURCES: { type: SourceType; icon: typeof Mail; label: string; desc: string }[] = [
  { type: 'emails', icon: Mail, label: 'Emails', desc: 'Conversations récentes' },
  { type: 'etablissements', icon: Building2, label: 'Établissements', desc: 'Fiches CRM' },
  { type: 'taches', icon: CheckSquare, label: 'Tâches', desc: 'Tâches et projets' },
  { type: 'contacts', icon: Users, label: 'Contacts', desc: 'Annuaire' },
  { type: 'calendar', icon: Calendar, label: 'Calendrier', desc: 'Événements récents' },
  { type: 'factures', icon: Receipt, label: 'Factures', desc: 'Factures émises' },
  { type: 'devis', icon: FileSpreadsheet, label: 'Devis', desc: 'Devis et propositions' },
  { type: 'contrats', icon: FileSignature, label: 'Contrats', desc: 'Contrats clients' },
  { type: 'avoirs', icon: RotateCcw, label: 'Avoirs', desc: 'Avoirs émis' },
  { type: 'forum', icon: MessageSquare, label: 'Forum', desc: 'Discussions internes' },
  { type: 'rd', icon: Microscope, label: 'R&D', desc: 'Epics, stories, sprints' },
  { type: 'formations', icon: GraduationCap, label: 'Formations', desc: 'Sessions de formation' },
  { type: 'recrutement', icon: UserPlus, label: 'Recrutement', desc: 'Candidatures en cours' },
  { type: 'support', icon: Headphones, label: 'Support', desc: 'Tickets support' },
  { type: 'tresorerie', icon: Wallet, label: 'Trésorerie', desc: 'Revenus et dépenses' },
  { type: 'documents', icon: FolderOpen, label: 'Documents GED', desc: 'Fichiers et dossiers' },
];

export function HelpMeCreateDialog({
  open, onOpenChange, onDocumentCreated, defaultEtablissementId,
}: HelpMeCreateDialogProps) {
  const { toast } = useToast();

  // Step management
  const [step, setStep] = useState<'config' | 'preview'>('config');

  // Config state
  const [docType, setDocType] = useState<DocType>('compte_rendu');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(['emails', 'taches']);
  const [tone, setTone] = useState<Tone>('formal');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Result state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const toggleSource = (source: SourceType) => {
    setSelectedSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  const handleGenerate = useCallback(async () => {
    if (!title.trim()) {
      toast({ title: 'Titre requis', description: 'Veuillez donner un titre au document.', variant: 'destructive' });
      return;
    }
    if (selectedSources.length === 0) {
      toast({ title: 'Sources requises', description: 'Sélectionnez au moins une source de données.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non connecté');

      const { data, error } = await supabase.functions.invoke('help-me-create-document', {
        body: {
          document_type: docType,
          title: title.trim(),
          instructions: instructions.trim() || undefined,
          sources: selectedSources,
          source_filters: {
            etablissement_id: defaultEtablissementId || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            search_query: searchQuery.trim() || undefined,
          },
          tone,
        },
      });

      if (error) throw error;
      if (!data?.html) throw new Error('Aucun contenu généré');

      setGeneratedHtml(processIcsUids(data.html));
      setStep('preview');

      toast({
        title: 'Document généré ✨',
        description: `Sources utilisées : ${(data.sources_used || []).join(', ')}`,
      });
    } catch (err: any) {
      console.error('Help me create error:', err);
      toast({
        title: 'Erreur de génération',
        description: err.message || 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [docType, title, instructions, selectedSources, tone, searchQuery, dateFrom, dateTo, defaultEtablissementId, toast]);

  const handleExportPdf = useCallback(async () => {
    if (!generatedHtml) return;
    setIsExporting(true);
    try {
      await exportToPdf(generatedHtml, title || 'document-ia');
      toast({ title: 'PDF exporté ✓' });
    } catch (err: any) {
      toast({ title: 'Erreur export PDF', description: err.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  }, [generatedHtml, title, toast]);

  const handleInsertInEditor = useCallback(() => {
    if (generatedHtml && onDocumentCreated) {
      onDocumentCreated(processIcsUids(generatedHtml), title);
      onOpenChange(false);
      resetState();
    }
  }, [generatedHtml, title, onDocumentCreated, onOpenChange]);

  const resetState = () => {
    setStep('config');
    setDocType('compte_rendu');
    setTitle('');
    setInstructions('');
    setSelectedSources(['emails', 'taches']);
    setTone('formal');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setGeneratedHtml('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setStep('config')} aria-label="Retour">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Help me create</DialogTitle>
                <DialogDescription className="text-xs">
                  {step === 'config' ? 'Générez un document structuré à partir de vos données' : 'Aperçu du document généré'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {step === 'config' ? (
          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-4 space-y-5">
              {/* Document type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type de document</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DOC_TYPES.map(({ type, icon: Icon, label, desc }) => (
                    <button
                      key={type}
                      onClick={() => setDocType(type)}
                      className={cn(
                        "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all text-sm",
                        docType === type
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", docType === type ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-medium text-xs">{label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="hmc-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Titre du document *
                </Label>
                <Input
                  id="hmc-title"
                  placeholder="Ex: Compte-rendu réunion Q1 2026"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Sources */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sources de données
                </Label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map(({ type, icon: Icon, label }) => {
                    const selected = selectedSources.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleSource(type)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                        {selected && <X className="h-3 w-3 ml-0.5 opacity-60" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <Label htmlFor="hmc-instructions" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Instructions spécifiques (optionnel)
                </Label>
                <Textarea
                  id="hmc-instructions"
                  placeholder="Ex: Focalise-toi sur les établissements en phase de déploiement, mets en avant les risques identifiés..."
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Advanced filters (collapsible) */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Filtres avancés</span>
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Ton</Label>
                    <Select value={tone} onValueChange={(v: Tone) => setTone(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formel</SelectItem>
                        <SelectItem value="concise">Concis</SelectItem>
                        <SelectItem value="detailed">Détaillé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Recherche dans les sources</Label>
                    <Input
                      placeholder="Filtrer par mot-clé..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Depuis</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Jusqu'à</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </details>
            </div>
          </ScrollArea>
        ) : (
          /* Preview step */
          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    <Eye className="h-3 w-3 mr-1" />
                    Aperçu
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{title}</span>
                </div>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none border border-border/40 rounded-lg p-6 bg-background shadow-sm min-h-[300px] [&_.ics-link]:text-blue-600 [&_.ics-link]:bg-blue-50 [&_.ics-link]:px-1.5 [&_.ics-link]:py-0.5 [&_.ics-link]:rounded [&_.ics-link]:text-xs [&_.ics-link]:font-medium [&_.ics-link]:no-underline [&_.ics-uid]:text-muted-foreground [&_.ics-uid]:bg-gray-100 [&_.ics-uid]:px-1 [&_.ics-uid]:py-0.5 [&_.ics-uid]:rounded [&_.ics-uid]:text-xs [&_.ics-uid]:font-mono"
                // safe: DOMPurify.sanitize applied inline before injection
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatedHtml) }}
              />
            </div>
          </ScrollArea>
        )}

        {/* Footer actions */}
        <Separator />
        <div className="p-3 flex items-center justify-between shrink-0">
          {step === 'config' ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>{selectedSources.length} source{selectedSources.length > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating || !title.trim() || selectedSources.length === 0}
                  className="gap-1.5"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Générer
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('config')}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="h-3 w-3" />
                Modifier
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isExporting}
                  className="gap-1.5 text-xs"
                >
                  {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  Export PDF
                </Button>
                {onDocumentCreated && (
                  <Button
                    size="sm"
                    onClick={handleInsertInEditor}
                    className="gap-1.5 text-xs"
                  >
                    <FileText className="h-3 w-3" />
                    Ouvrir dans l'éditeur
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="gap-1.5 text-xs"
                >
                  {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Régénérer
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
