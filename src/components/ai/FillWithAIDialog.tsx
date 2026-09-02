import { useState, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Building2,
  Users,
  ChevronRight,
  Eye,
  Save,
  RotateCcw,
} from 'lucide-react';
import { invokeEdge } from "@/services/edgeFunctions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/shared/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

type EntityType = 'etablissements' | 'contacts';

interface EnrichField {
  field: string;
  label: string;
  instruction?: string;
}

interface FillWithAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  items: Array<{ id: string; [key: string]: unknown }>;
}

const ETABLISSEMENT_FIELDS: EnrichField[] = [
  { field: 'type_etablissement_enrichi', label: 'Type précis', instruction: 'CHU, CH, clinique privée, EHPAD, HAD, SSR, psychiatrie, etc.' },
  { field: 'region', label: 'Région', instruction: 'Région administrative française basée sur la ville' },
  { field: 'notes', label: 'Note contextuelle', instruction: 'Courte note sur le positionnement de l\'établissement' },
  { field: 'category_ai', label: 'Segment client', instruction: 'Grand compte, ETI, PME, Startup basé sur la taille probable' },
];

const CONTACT_FIELDS: EnrichField[] = [
  { field: 'fonction_normalisee', label: 'Fonction normalisée', instruction: 'Normaliser le titre: DSI, DRH, Directeur Général, Médecin-Chef, etc.' },
  { field: 'seniorite', label: 'Séniorité', instruction: 'Junior, Senior, Directeur, C-Level' },
  { field: 'departement', label: 'Département', instruction: 'IT, RH, Direction, Médical, Administratif, Commercial' },
];

export function FillWithAIDialog({
  open, onOpenChange, entityType, items,
}: FillWithAIDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const availableFields = entityType === 'etablissements' ? ETABLISSEMENT_FIELDS : CONTACT_FIELDS;

  // Step: config → preview
  const [step, setStep] = useState<'config' | 'preview'>('config');
  const [selectedFields, setSelectedFields] = useState<string[]>(
    availableFields.slice(0, 2).map(f => f.field)
  );
  const [customInstructions, setCustomInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Preview state
  const [enrichedData, setEnrichedData] = useState<Array<{ id: string; [key: string]: unknown }>>([]);
  const [acceptedRows, setAcceptedRows] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const toggleField = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const selectedFieldDefs = useMemo(
    () => availableFields.filter(f => selectedFields.includes(f.field)),
    [availableFields, selectedFields]
  );

  const handleEnrich = useCallback(async () => {
    if (selectedFields.length === 0) {
      toast({ title: 'Sélectionnez au moins un champ', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const data = await invokeEdge<any>('fill-with-ai', {
          entity_type: entityType,
          items: items.map(item => {
            // Only send relevant fields to reduce payload
            const slim: Record<string, unknown> = { id: item.id };
            const keepFields = entityType === 'etablissements'
              ? ['nom', 'ville', 'region', 'statut', 'type', 'dpi', 'ca_mensuel', 'type_etablissement']
              : ['nom', 'prenom', 'fonction', 'email', 'telephone'];
            for (const k of keepFields) {
              if (item[k] !== undefined && item[k] !== null) slim[k] = item[k];
            }
            return slim;
          }),
          fields_to_enrich: selectedFieldDefs,
          custom_instructions: customInstructions.trim() || undefined,
        });
      const error = null;

      if (error) throw error;
      if (!data?.enriched_items?.length) throw new Error('Aucun résultat retourné');

      setEnrichedData(data.enriched_items);
      setAcceptedRows(new Set(data.enriched_items.map((r: any) => r.id)));
      setStep('preview');

      toast({
        title: `${data.total_processed}/${data.total_requested} éléments enrichis ✨`,
      });
    } catch (err: any) {
      console.error('Fill with AI error:', err);
      toast({ title: 'Erreur d\'enrichissement', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [entityType, items, selectedFields, selectedFieldDefs, customInstructions, toast]);

  const handleApply = useCallback(async () => {
    const rowsToApply = enrichedData.filter(r => acceptedRows.has(r.id));
    if (rowsToApply.length === 0) {
      toast({ title: 'Aucune ligne sélectionnée', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      let errorCount = 0;
      // Apply updates one by one to respect RLS
      for (const row of rowsToApply) {
        const { id, ...fields } = row;
        // Only update fields that exist in the enrichment (filter nulls)
        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value !== null && value !== undefined) {
            updateData[key] = value;
          }
        }

        if (Object.keys(updateData).length === 0) continue;

        const { error } = await supabase
          .from(entityType)
          .update(updateData as never)
          .eq('id', id);

        if (error) {
          console.error(`Update error for ${id}:`, error);
          errorCount++;
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [entityType] });
      if (entityType === 'etablissements') {
        queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      }

      toast({
        title: `${rowsToApply.length - errorCount} éléments mis à jour ✓`,
        description: errorCount > 0 ? `${errorCount} erreurs rencontrées` : undefined,
        variant: errorCount > 0 ? 'destructive' : 'default',
      });

      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast({ title: 'Erreur de sauvegarde', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [enrichedData, acceptedRows, entityType, queryClient, toast, onOpenChange]);

  const toggleRow = (id: string) => {
    setAcceptedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (acceptedRows.size === enrichedData.length) {
      setAcceptedRows(new Set());
    } else {
      setAcceptedRows(new Set(enrichedData.map(r => r.id)));
    }
  };

  const getOriginalValue = (id: string, field: string) => {
    const item = items.find(i => i.id === id);
    return item?.[field] as string | undefined;
  };

  const resetState = () => {
    setStep('config');
    setEnrichedData([]);
    setAcceptedRows(new Set());
    setCustomInstructions('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const Icon = entityType === 'etablissements' ? Building2 : Users;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setStep('config')} aria-label="Retour">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Fill with AI</DialogTitle>
              <DialogDescription className="text-xs">
                {step === 'config'
                  ? `Enrichir ${items.length} ${entityType === 'etablissements' ? 'établissement' : 'contact'}${items.length > 1 ? 's' : ''}`
                  : 'Vérifiez les enrichissements avant application'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'config' ? (
          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-4 space-y-5">
              {/* Items summary */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/40">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">
                  <strong>{items.length}</strong> {entityType === 'etablissements' ? 'établissement' : 'contact'}{items.length > 1 ? 's' : ''} sélectionné{items.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Fields to enrich */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Champs à enrichir
                </Label>
                <div className="space-y-2">
                  {availableFields.map(({ field, label, instruction }) => (
                    <label
                      key={field}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        selectedFields.includes(field)
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/50 hover:border-border hover:bg-muted/20"
                      )}
                    >
                      <Checkbox
                        checked={selectedFields.includes(field)}
                        onCheckedChange={() => toggleField(field)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{label}</span>
                        {instruction && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{instruction}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom instructions */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                  Instructions personnalisées
                </summary>
                <div className="mt-2 pl-5">
                  <Textarea
                    placeholder="Ex: Priorise les établissements publics, classe par taille décroissante..."
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
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
                  <span className="text-xs text-muted-foreground">
                    {acceptedRows.size}/{enrichedData.length} sélectionné{acceptedRows.size > 1 ? 's' : ''}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                  {acceptedRows.size === enrichedData.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Button>
              </div>

              <div className="border border-border/40 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={acceptedRows.size === enrichedData.length && enrichedData.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead className="text-xs min-w-[140px]">Nom</TableHead>
                      {selectedFieldDefs.map(f => (
                        <TableHead key={f.field} className="text-xs min-w-[120px]">{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrichedData.map(row => {
                      const original = items.find(i => i.id === row.id);
                      const name = (original?.nom as string) || (original?.prenom ? `${original.prenom} ${original.nom}` : row.id);
                      const accepted = acceptedRows.has(row.id);

                      return (
                        <TableRow
                          key={row.id}
                          className={cn(
                            "transition-colors",
                            !accepted && "opacity-50"
                          )}
                        >
                          <TableCell>
                            <Checkbox checked={accepted} onCheckedChange={() => toggleRow(row.id)} />
                          </TableCell>
                          <TableCell className="font-medium text-xs truncate max-w-[160px]">
                            {name}
                          </TableCell>
                          {selectedFieldDefs.map(f => {
                            const newVal = row[f.field];
                            const oldVal = getOriginalValue(row.id, f.field);
                            const hasChanged = Boolean(newVal && newVal !== oldVal);

                            return (
                              <TableCell key={f.field} className="text-xs">
                                {newVal ? (
                                  <div className="space-y-0.5">
                                    <span className={cn(
                                      "inline-block px-1.5 py-0.5 rounded text-[11px]",
                                      hasChanged
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground"
                                    )}>
                                      {String(newVal).substring(0, 80)}
                                    </span>
                                    {oldVal && hasChanged && (
                                      <span className="block text-[10px] text-muted-foreground line-through truncate">
                                        {String(oldVal).substring(0, 50)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50 text-[10px]">—</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {enrichedData.length < items.length && (
                <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                  <span className="text-xs text-warning">
                    {items.length - enrichedData.length} élément{items.length - enrichedData.length > 1 ? 's' : ''} n'ont pas pu être enrichi{items.length - enrichedData.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <Separator />
        <div className="p-3 flex items-center justify-between shrink-0">
          {step === 'config' ? (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedFields.length} champ{selectedFields.length > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>Annuler</Button>
                <Button
                  size="sm"
                  onClick={handleEnrich}
                  disabled={isProcessing || selectedFields.length === 0}
                  className="gap-1.5"
                >
                  {isProcessing ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Enrichir {items.length} éléments</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep('config')} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3 w-3" /> Modifier
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleEnrich}
                  disabled={isProcessing}
                  className="gap-1.5 text-xs"
                >
                  {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Relancer
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={isSaving || acceptedRows.size === 0}
                  className="gap-1.5 text-xs"
                >
                  {isSaving ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Enregistrement...</>
                  ) : (
                    <><Save className="h-3 w-3" /> Appliquer ({acceptedRows.size})</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
