import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { useRHSalaires, groupSalairesByMonth } from "@/hooks/hr/useRHSalaires";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { useSecurityLog } from "@/hooks/auth/useSecurityLog";
import type { SalaireEditValues } from "@/types/ui-states";
import type { Tables } from "@/integrations/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { invokeEdge } from "@/services/edgeFunctions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Check, X, Plus, ChevronDown, MoreVertical, Upload } from "lucide-react";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { TableSkeleton } from "@/components/shared/LoadingStates";
import { AddSalaireDialog } from "./AddSalaireDialog";
import { BulkUploadBulletinsDialog } from "./BulkUploadBulletinsDialog";
import { RHQuickActions } from "./RHQuickActions";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function RHSalairesTable() {
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);
  const [editingSalaireId, setEditingSalaireId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<SalaireEditValues>({ salaire_brut: 0, primes: 0, heures_supplementaires: 0 });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalysisProgress, setReanalysisProgress] = useState({ current: 0, total: 0 });
  const [shouldCancelReanalysis, setShouldCancelReanalysis] = useState(false);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { logAction } = useSecurityLog();

  const { salaires, isLoading, updateSalaire, deleteSalaire } = useRHSalaires(selectedMonth);

  // Log l'accès aux salaires
  useEffect(() => {
    if (salaires && salaires.length > 0) {
      logAction('view', 'rh_salaires', { count: salaires.length, month: selectedMonth });
    }
  }, [salaires, selectedMonth, logAction]);

  useEffect(() => {
    setEditingSalaireId(null);
    setEditValues({ salaire_brut: 0, primes: 0, heures_supplementaires: 0 });
  }, [selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  };

  type RHSalaire = Tables<'rh_salaires_mensuels'>;

  const handleEdit = (salaire: RHSalaire) => {
    setEditingSalaireId(salaire.id);
    setEditValues({
      salaire_brut: salaire.salaire_brut || 0,
      primes: salaire.primes || 0,
      heures_supplementaires: salaire.heures_supplementaires || 0,
    });
  };

  const handleSave = async (salaireId: string) => {
    try {
      const brut = editValues.salaire_brut;
      const primes = editValues.primes || 0;
      const heuresSupp = editValues.heures_supplementaires || 0;
      
      const cotisationsSalariales = brut * 0.23;
      const cotisationsPatronales = brut * 0.45;
      const salaireNet = brut - cotisationsSalariales + primes + heuresSupp;

      await updateSalaire({
        id: salaireId,
        salaire_brut: brut,
        salaire_net: salaireNet,
        cotisations_salariales: cotisationsSalariales,
        cotisations_patronales: cotisationsPatronales,
        primes: primes > 0 ? primes : 0,
        heures_supplementaires: heuresSupp > 0 ? heuresSupp : 0,
        source_type: 'corrected',
      });

      setEditingSalaireId(null);
      setEditValues({ salaire_brut: 0, primes: 0, heures_supplementaires: 0 });
    } catch (error) {
      debug.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleCancel = () => {
    setEditingSalaireId(null);
    setEditValues({ salaire_brut: 0, primes: 0, heures_supplementaires: 0 });
  };

  const handleDelete = async (salaireId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce salaire ?')) {
      try {
        await deleteSalaire(salaireId);
      } catch (error) {
        debug.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const handleReanalyze = async () => {
    if (!confirm("Réanalyser tous les bulletins de salaire ? Cette opération peut prendre plusieurs minutes.")) {
      return;
    }

    setIsReanalyzing(true);
    setShouldCancelReanalysis(false);
    setReanalysisProgress({ current: 0, total: 0 });

    const toastId = toast.loading("Initialisation de la réanalyse...", {
      description: "Préparation du traitement par batch"
    });

    try {
      const BATCH_SIZE = 3; // Réduit pour éviter surcharge serveur
      let offset = 0;
      let hasMore = true;
      let totalUpdated = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];

      // Premier appel pour obtenir le nombre total
      const firstBatch: any = { data: await invokeEdge<any>('reanalyze-all-bulletins', { batch_size: BATCH_SIZE, offset: 0 }) };

      const totalBulletins = firstBatch.data?.results?.total || 0;
      setReanalysisProgress({ current: 0, total: totalBulletins });

      toast.loading(`Traitement en cours...`, {
        id: toastId,
        description: `0 / ${totalBulletins} bulletins traités`
      });

      // Traiter le premier batch
      if (firstBatch.data?.success) {
        totalUpdated += firstBatch.data.results.updated;
        totalFailed += firstBatch.data.results.failed;
        totalSkipped += firstBatch.data.results.skipped;
        allErrors.push(...(firstBatch.data.results.errors || []));
        
        offset += BATCH_SIZE;
        hasMore = firstBatch.data.results.has_more;
        
        setReanalysisProgress({ current: offset, total: totalBulletins });
        toast.loading(`Traitement en cours...`, {
          id: toastId,
          description: `${offset} / ${totalBulletins} bulletins traités`
        });
      }

      // Traiter les batchs suivants
      while (hasMore && !shouldCancelReanalysis) {
        // Pause plus longue entre les batchs pour laisser le serveur respirer
        await new Promise(resolve => setTimeout(resolve, 3000));

        let data: any;
        try {
          data = { data: await invokeEdge<any>('reanalyze-all-bulletins', { batch_size: BATCH_SIZE, offset }) };
        } catch (error: any) {
          debug.error(`Erreur batch offset ${offset}:`, error);
          allErrors.push(`Batch ${offset}: ${error?.message || error}`);
          break;
        }

        if (data.data?.success) {
          totalUpdated += data.data.results.updated;
          totalFailed += data.data.results.failed;
          totalSkipped += data.data.results.skipped;
          allErrors.push(...(data.data.results.errors || []));
          
          offset += BATCH_SIZE;
          hasMore = data.data.results.has_more;
          
          setReanalysisProgress({ current: offset, total: totalBulletins });
          toast.loading(`Traitement en cours...`, {
            id: toastId,
            description: `${Math.min(offset, totalBulletins)} / ${totalBulletins} bulletins traités`
          });
        } else {
          break;
        }
      }

      if (shouldCancelReanalysis) {
        toast.info("Réanalyse annulée", {
          id: toastId,
          description: `${totalUpdated} bulletins mis à jour avant annulation`
        });
      } else {
        toast.success("Réanalyse terminée", {
          id: toastId,
          description: `${totalUpdated} mis à jour, ${totalSkipped} ignorés, ${totalFailed} erreurs`
        });
      }
      
      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['rh-salaires'] });

    } catch (error: unknown) {
      debug.error('Erreur réanalyse:', error);
      toast.error("Erreur lors de la réanalyse", {
        id: toastId,
        description: sanitizeSupabaseError(error)
      });
    } finally {
      setIsReanalyzing(false);
      setShouldCancelReanalysis(false);
      setReanalysisProgress({ current: 0, total: 0 });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Salaires Mensuels</CardTitle>
          <CardDescription>Chargement des données...</CardDescription>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={5} columns={isMobile ? 3 : 7} />
        </CardContent>
      </Card>
    );
  }

  // Grouper les salaires par mois
  const groupedSalaires = groupSalairesByMonth(salaires);
  
  // Créer les options de mois pour le sélecteur
  const availableMonths = groupedSalaires.map(([month]) => month);

  if (!salaires || salaires.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="border-primary/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Actions rapides</h3>
                <p className="text-sm text-muted-foreground">Ajoutez vos premiers salaires</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => setBulkUploadOpen(true)} 
                size="lg"
                className="flex-1"
              >
                <Upload className="mr-2 h-5 w-5" />
                📥 Uploader plusieurs bulletins
              </Button>
              <Button 
                onClick={() => setAddDialogOpen(true)} 
                variant="outline"
                size="lg"
                className="flex-1"
              >
                <Plus className="mr-2 h-5 w-5" />
                Saisir manuellement
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Salaires Mensuels</CardTitle>
            <CardDescription>Aucun salaire enregistré</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-12">
            <div className="max-w-md mx-auto space-y-6">
              <div className="p-6 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-3">💡 Comment ajouter des salaires ?</h4>
                <div className="space-y-3 text-sm text-muted-foreground text-left">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">1</div>
                    <div>
                      <p className="font-medium text-foreground">Upload automatique (recommandé)</p>
                      <p>Utilisez le bouton "📥 Uploader plusieurs bulletins" pour importer vos bulletins PDF. Le système analysera automatiquement les données avec GPT-5.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">2</div>
                    <div>
                      <p className="font-medium text-foreground">Saisie manuelle</p>
                      <p>Si vous préférez, vous pouvez saisir les données manuellement pour chaque employé.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      <AddSalaireDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      
      <BulkUploadBulletinsDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ['rh-salaires'] });
        }}
      />

      {/* Dialog de progression réanalyse */}
      <Dialog open={isReanalyzing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Réanalyse des bulletins en cours</DialogTitle>
            <DialogDescription>
              Traitement par batch de {reanalysisProgress.total} bulletins
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-semibold">
                  {Math.min(reanalysisProgress.current, reanalysisProgress.total)} / {reanalysisProgress.total}
                </span>
              </div>
              <Progress 
                value={reanalysisProgress.total > 0 ? (reanalysisProgress.current / reanalysisProgress.total) * 100 : 0} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground text-center">
                {reanalysisProgress.total > 0 
                  ? `${Math.round((reanalysisProgress.current / reanalysisProgress.total) * 100)}% complété`
                  : 'Initialisation...'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShouldCancelReanalysis(true)}
              disabled={shouldCancelReanalysis}
              className="w-full"
            >
              {shouldCancelReanalysis ? 'Annulation en cours...' : 'Annuler le traitement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

  return (
    <div className="space-y-4">
      <RHQuickActions 
        onAddSalaire={() => setAddDialogOpen(true)}
        onUploadMultiple={() => setBulkUploadOpen(true)}
        onViewAll={selectedMonth ? () => setSelectedMonth(undefined) : undefined}
        onReanalyze={handleReanalyze}
        isReanalyzing={isReanalyzing}
      />
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Salaires Mensuels</CardTitle>
              <CardDescription>
                {selectedMonth ? `Salaires de ${selectedMonth}` : `${salaires.length} salaire(s) enregistré(s)`}
              </CardDescription>
            </div>
            <div className="w-full sm:w-auto">
              <Label htmlFor="month-filter" className="sr-only">Filtrer par mois</Label>
              <Select value={selectedMonth || "all"} onValueChange={(val) => setSelectedMonth(val === "all" ? undefined : val)}>
                <SelectTrigger id="month-filter" className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Tous les mois" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {availableMonths.map((month) => (
                    <SelectItem key={month} value={month}>
                      {new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Affichage groupé par mois si aucun filtre */}
          {!selectedMonth && groupedSalaires.length > 0 ? (
            <div className="space-y-4">
              {groupedSalaires.map(([month, salairesOfMonth]) => (
                <Collapsible key={month} defaultOpen={groupedSalaires.indexOf([month, salairesOfMonth]) === 0}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="h-4 w-4 transition-transform ui-expanded:rotate-180" />
                      <h3 className="font-semibold">
                        {new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </h3>
                      <Badge variant="secondary">{salairesOfMonth.length} salaire(s)</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Total Brut : {formatCurrency(salairesOfMonth.reduce((sum, s) => sum + s.salaire_brut, 0))}
                      {' | '}
                      Total Super Brut : {formatCurrency(salairesOfMonth.reduce((sum, s) => sum + (s.salaire_brut || 0) + (s.cotisations_patronales || 0), 0))}
                      {' | '}
                      Total Net Payé : {formatCurrency(salairesOfMonth.reduce((sum, s) => sum + (s.net_paye || s.salaire_net), 0))}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employé</TableHead>
                            <TableHead className="text-right">Super Brut</TableHead>
                            <TableHead className="text-right">Brut</TableHead>
                            <TableHead className="text-right">Net Payé</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salairesOfMonth.map((salaire) => renderSalaireRow(salaire))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead className="text-right">Super Brut</TableHead>
                    <TableHead className="text-right">Brut</TableHead>
                    <TableHead className="text-right">Cotis. Sal.</TableHead>
                    <TableHead className="text-right">Cotis. Pat.</TableHead>
                    <TableHead className="text-right">Net Payé</TableHead>
                    <TableHead className="text-right">Primes</TableHead>
                    <TableHead className="text-right">H. Supp.</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaires.map((salaire) => renderSalaireRow(salaire, true))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddSalaireDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      
      <BulkUploadBulletinsDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ['rh-salaires'] });
        }}
      />

      {/* Dialog de progression réanalyse */}
      <Dialog open={isReanalyzing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Réanalyse des bulletins en cours</DialogTitle>
            <DialogDescription>
              Traitement par batch de {reanalysisProgress.total} bulletins
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-semibold">
                  {Math.min(reanalysisProgress.current, reanalysisProgress.total)} / {reanalysisProgress.total}
                </span>
              </div>
              <Progress 
                value={reanalysisProgress.total > 0 ? (reanalysisProgress.current / reanalysisProgress.total) * 100 : 0} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground text-center">
                {reanalysisProgress.total > 0 
                  ? `${Math.round((reanalysisProgress.current / reanalysisProgress.total) * 100)}% complété`
                  : 'Initialisation...'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShouldCancelReanalysis(true)}
              disabled={shouldCancelReanalysis}
              className="w-full"
            >
              {shouldCancelReanalysis ? 'Annulation en cours...' : 'Annuler le traitement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderSalaireRow(salaire: any, showAllColumns = false) {
    const isEditing = editingSalaireId === salaire.id;

    // Vue mobile: card compacte
    if (isMobile && !showAllColumns) {
      return (
        <TableRow key={salaire.id} className="block border-b pb-3 mb-3">
          <TableCell colSpan={5} className="block p-0">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {salaire.profiles ? 
                      `${salaire.profiles.prenom} ${salaire.profiles.nom}` : 
                      'Non renseigné'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {salaire.profiles?.fonction || 'Aucun employé associé'}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(salaire)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(salaire.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex justify-between text-sm gap-2">
                <span className="text-primary font-medium">
                  Super Brut: {formatCurrency((salaire.salaire_brut || 0) + (salaire.cotisations_patronales || 0))}
                </span>
                <span>Brut: {formatCurrency(salaire.salaire_brut)}</span>
                <span className="font-semibold">Net Payé: {formatCurrency(salaire.net_paye || salaire.salaire_net)}</span>
              </div>
              <Badge variant={
                salaire.source_type === 'auto_bulletin' ? 'default' :
                salaire.source_type === 'corrected' ? 'secondary' : 'outline'
              } className="text-xs">
                {salaire.source_type === 'auto_bulletin' ? '🤖 Auto' :
                 salaire.source_type === 'corrected' ? '⚠️ Corrigé' : '✏️ Manuel'}
              </Badge>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    // Vue desktop: tableau complet
    return (
      <TableRow key={salaire.id}>
        <TableCell className="font-medium">
          {salaire.profiles ? (
            <>
              {salaire.profiles.prenom} {salaire.profiles.nom}
              <br />
              <span className="text-xs text-muted-foreground">
                {salaire.profiles.fonction || 'Non renseigné'}
              </span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">Non renseigné</span>
              <br />
              <span className="text-xs text-muted-foreground">Aucun employé associé</span>
            </>
          )}
        </TableCell>

        <TableCell className="text-right font-semibold text-primary">
          {formatCurrency((salaire.salaire_brut || 0) + (salaire.cotisations_patronales || 0))}
        </TableCell>

        <TableCell className="text-right">
          {isEditing ? (
            <Input
              type="number"
              step="0.01"
              value={editValues.salaire_brut}
              onChange={(e) => setEditValues({ ...editValues, salaire_brut: parseFloat(e.target.value) })}
              className="w-24"
            />
          ) : (
            formatCurrency(salaire.salaire_brut)
          )}
        </TableCell>
        
        {showAllColumns && (
          <>
            <TableCell className="text-right">{formatCurrency(salaire.cotisations_salariales || 0)}</TableCell>
            <TableCell className="text-right">{formatCurrency(salaire.cotisations_patronales || 0)}</TableCell>
          </>
        )}
        
        <TableCell className="text-right font-semibold">{formatCurrency(salaire.net_paye || salaire.salaire_net)}</TableCell>

        {showAllColumns && (
          <>
            <TableCell className="text-right">
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={editValues.primes || 0}
                  onChange={(e) => setEditValues({ ...editValues, primes: parseFloat(e.target.value) })}
                  className="w-24"
                />
              ) : (
                formatCurrency(salaire.primes || 0)
              )}
            </TableCell>
            <TableCell className="text-right">
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={editValues.heures_supplementaires || 0}
                  onChange={(e) => setEditValues({ ...editValues, heures_supplementaires: parseFloat(e.target.value) })}
                  className="w-24"
                />
              ) : (
                formatCurrency(salaire.heures_supplementaires || 0)
              )}
            </TableCell>
          </>
        )}
        
        <TableCell>
          {salaire.source_type === 'auto_bulletin' ? (
            <Badge variant="default" className="gap-1">
              🤖 Auto
            </Badge>
          ) : salaire.source_type === 'corrected' ? (
            <Badge variant="secondary" className="gap-1">
              ⚠️ Corrigé
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              ✏️ Manuel
            </Badge>
          )}
        </TableCell>
        
        <TableCell className="text-right">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => handleSave(salaire.id)} aria-label="Valider" title="Valider">
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} aria-label="Annuler" title="Annuler">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => handleEdit(salaire)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => handleDelete(salaire.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  }
}
