import { useMemo, useState } from "react";
import { debug } from "@/lib/debug";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { User, Info, ExternalLink, Pencil, Pause, Trash2, Loader2 } from "lucide-react";
import type { DailyDetailItem } from "./DayDetailTooltip";
import { useTresorerieDepenses } from "@/hooks/tresorerie/useTresorerieDepenses";
import { useSalaireProjectionsOverrides } from "@/hooks/hr/useSalaireProjectionsOverrides";

interface SalairePrevActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salaireItem: DailyDetailItem | null;
  derniersNetPayes: Map<string, {
    prenom: string;
    nom: string;
    netPaye: number;
    dernierMois: string;
  }>;
}

type Mode = 'view' | 'edit' | 'exclude';
type EditScope = 'this_month' | 'from_this_month';
type ExcludeScope = 'this_month' | 'from_this_month';

export function SalairePrevActionsDialog({
  open,
  onOpenChange,
  salaireItem,
  derniersNetPayes,
}: SalairePrevActionsDialogProps) {
  const navigate = useNavigate();
  const { createDepense, isCreating: isCreatingDepense } = useTresorerieDepenses();
  const { createOverride, isCreating: isCreatingOverride } = useSalaireProjectionsOverrides();
  
  const [mode, setMode] = useState<Mode>('view');
  const [editScope, setEditScope] = useState<EditScope>('from_this_month');
  const [excludeScope, setExcludeScope] = useState<ExcludeScope>('from_this_month');
  const [newMontant, setNewMontant] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extraire les infos du salaire depuis l'ID
  // Format: salaire-prev-{profileId}-{moisKey}
  const salaireInfo = useMemo(() => {
    if (!salaireItem?.id) return null;

    const parts = salaireItem.id.split('-');
    if (parts.length < 4) return null;

    // profileId est entre 'salaire-prev-' et la date
    // salaire-prev-uuid-yyyy-mm-dd -> on prend tout entre 'salaire-prev-' et les 10 derniers caractères (date)
    const idWithoutPrefix = salaireItem.id.replace('salaire-prev-', '');
    const moisKey = idWithoutPrefix.slice(-10); // yyyy-mm-dd
    const profileId = idWithoutPrefix.slice(0, -11); // Tout sauf -yyyy-mm-dd

    const employeInfo = derniersNetPayes.get(profileId);
    if (!employeInfo) return null;

    // Parser la date du mois projeté
    const moisProjection = moisKey.slice(0, 7); // yyyy-mm
    const dernierMoisConnu = employeInfo.dernierMois.slice(0, 7);

    return {
      profileId,
      prenom: employeInfo.prenom,
      nom: employeInfo.nom,
      netPaye: employeInfo.netPaye,
      moisProjection,
      moisKey,
      dernierMoisConnu,
    };
  }, [salaireItem, derniersNetPayes]);

  const handleVoirDossierRH = () => {
    if (salaireInfo?.profileId) {
      navigate(`/people?member=${salaireInfo.profileId}&tab=dossier`);
      onOpenChange(false);
    }
  };

  const handleStartEdit = () => {
    setNewMontant(salaireInfo?.netPaye?.toString() || '');
    setMode('edit');
  };

  const handleCancelEdit = () => {
    setMode('view');
    setNewMontant('');
  };

  const handleStartExclude = () => {
    setExcludeScope('from_this_month');
    setMode('exclude');
  };

  const handleCancelExclude = () => {
    setMode('view');
  };

  const handleSaveEdit = async () => {
    if (!salaireInfo) return;
    
    const montant = parseFloat(newMontant);
    if (isNaN(montant) || montant <= 0) return;

    setIsSubmitting(true);
    try {
      if (editScope === 'this_month') {
        // Créer une dépense ponctuelle pour ce mois uniquement
        const dateJour28 = `${salaireInfo.moisProjection}-28`;
        createDepense({
          nom: `Salaire ${salaireInfo.prenom} ${salaireInfo.nom}`,
          montant: montant,
          date_prevue: dateJour28,
          notes: `Surcharge manuelle du salaire prévisionnel`,
          statut: 'en_attente',
        });
      } else {
        // Créer une surcharge permanente à partir de ce mois
        await createOverride({
          profile_id: salaireInfo.profileId,
          montant: montant,
          date_effet: `${salaireInfo.moisProjection}-01`,
          notes: `Modification à partir de ${format(new Date(salaireInfo.moisProjection + '-01'), 'MMMM yyyy', { locale: fr })}`,
        });
      }
      onOpenChange(false);
      setMode('view');
    } catch (error) {
      debug.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspendre = async () => {
    if (!salaireInfo) return;
    
    setIsSubmitting(true);
    try {
      // Créer une dépense avec date_prevue = 1900-01-01 pour "À payer plus tard"
      createDepense({
        nom: `Salaire ${salaireInfo.prenom} ${salaireInfo.nom} (${format(new Date(salaireInfo.moisProjection + '-01'), 'MMM yyyy', { locale: fr })})`,
        montant: salaireInfo.netPaye,
        date_prevue: '1900-01-01',
        notes: `Salaire suspendu depuis la projection de ${salaireInfo.moisProjection}`,
        statut: 'en_attente',
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmExclude = async () => {
    if (!salaireInfo) return;
    
    setIsSubmitting(true);
    try {
      if (excludeScope === 'this_month') {
        // Exclure ce mois uniquement : créer deux overrides
        // 1. Exclure le mois courant
        await createOverride({
          profile_id: salaireInfo.profileId,
          montant: 0,
          date_effet: `${salaireInfo.moisProjection}-01`,
          notes: `Exclu pour ${format(new Date(salaireInfo.moisProjection + '-01'), 'MMMM yyyy', { locale: fr })} uniquement`,
        });
        
        // 2. Reprendre le mois suivant avec le dernier net payé connu
        const currentDate = new Date(salaireInfo.moisProjection + '-01');
        currentDate.setMonth(currentDate.getMonth() + 1);
        const nextMonth = format(currentDate, 'yyyy-MM');
        
        await createOverride({
          profile_id: salaireInfo.profileId,
          montant: salaireInfo.netPaye,
          date_effet: `${nextMonth}-01`,
          notes: `Reprise après exclusion ponctuelle`,
        });
      } else {
        // Exclure à partir de ce mois (permanent)
        await createOverride({
          profile_id: salaireInfo.profileId,
          montant: 0,
          date_effet: `${salaireInfo.moisProjection}-01`,
          notes: `Exclusion permanente à partir de ${format(new Date(salaireInfo.moisProjection + '-01'), 'MMMM yyyy', { locale: fr })}`,
        });
      }
      onOpenChange(false);
      setMode('view');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset mode when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setMode('view');
      setNewMontant('');
      setExcludeScope('from_this_month');
    }
    onOpenChange(newOpen);
  };

  if (!salaireItem || !salaireInfo) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Détails du salaire</DialogTitle>
            <DialogDescription>
              Impossible de charger les informations du salaire.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const moisProjectionLabel = format(
    new Date(salaireInfo.moisProjection + '-01'),
    'MMMM yyyy',
    { locale: fr }
  );

  const dernierMoisLabel = format(
    new Date(salaireInfo.dernierMoisConnu + '-01'),
    'MMMM yyyy',
    { locale: fr }
  );

  const isBusy = isSubmitting || isCreatingDepense || isCreatingOverride;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Salaire {salaireInfo.prenom} {salaireInfo.nom}</span>
            <span className="text-destructive font-bold">
              -{formatCurrency(salaireItem.montant)}
            </span>
          </DialogTitle>
          <DialogDescription>
            Projection automatique du salaire net
          </DialogDescription>
        </DialogHeader>

        {/* Info box */}
        <div className="bg-muted/50 rounded-lg p-4 border space-y-2">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p>
                Projection basée sur le dernier net payé connu ({dernierMoisLabel})
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Montant projeté</span>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {formatCurrency(salaireInfo.netPaye)}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Projection pour</span>
            <span className="text-sm font-medium capitalize">{moisProjectionLabel}</span>
          </div>
        </div>

        {/* Mode édition */}
        {mode === 'edit' && (
          <div className="border rounded-lg p-4 space-y-4 bg-background">
            <div className="space-y-2">
              <Label htmlFor="newMontant">Nouveau montant (€)</Label>
              <Input
                id="newMontant"
                type="number"
                step="0.01"
                min="0"
                value={newMontant}
                onChange={(e) => setNewMontant(e.target.value)}
                placeholder="Ex: 2600"
              />
            </div>

            <div className="space-y-3">
              <Label>Portée de la modification</Label>
              <RadioGroup value={editScope} onValueChange={(v) => setEditScope(v as EditScope)}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="this_month" id="edit_this_month" className="mt-1" />
                  <Label htmlFor="edit_this_month" className="font-normal cursor-pointer">
                    <div>Ce mois uniquement</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      ({moisProjectionLabel})
                    </div>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="from_this_month" id="edit_from_this_month" className="mt-1" />
                  <Label htmlFor="edit_from_this_month" className="font-normal cursor-pointer">
                    <div>À partir de ce mois</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      ({moisProjectionLabel} et suivants)
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleCancelEdit} disabled={isBusy}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} disabled={isBusy || !newMontant}>
                {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}

        {/* Mode exclusion */}
        {mode === 'exclude' && (
          <div className="border border-destructive/30 rounded-lg p-4 space-y-4 bg-destructive/5">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <Trash2 className="h-4 w-4" />
              Exclure ce salaire
            </div>

            <div className="space-y-3">
              <Label>Portée de l'exclusion</Label>
              <RadioGroup value={excludeScope} onValueChange={(v) => setExcludeScope(v as ExcludeScope)}>
                <div className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50">
                  <RadioGroupItem value="this_month" id="exclude_this_month" className="mt-1" />
                  <Label htmlFor="exclude_this_month" className="font-normal cursor-pointer flex-1">
                    <div>Ce mois uniquement</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      ({moisProjectionLabel})
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      → Le salaire sera à nouveau projeté dès le mois suivant
                    </div>
                  </Label>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50">
                  <RadioGroupItem value="from_this_month" id="exclude_from_this_month" className="mt-1" />
                  <Label htmlFor="exclude_from_this_month" className="font-normal cursor-pointer flex-1">
                    <div>À partir de ce mois</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      ({moisProjectionLabel} et suivants)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      → Le salaire ne sera plus projeté du tout
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleCancelExclude} disabled={isBusy}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleConfirmExclude} disabled={isBusy}>
                {isBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmer l'exclusion
              </Button>
            </div>
          </div>
        )}

        {/* Mode vue - Actions disponibles */}
        {mode === 'view' && (
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              onClick={handleStartEdit}
              className="w-full justify-start"
              disabled={isBusy}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Modifier le montant
            </Button>

            <Button
              variant="outline"
              onClick={handleSuspendre}
              className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
              disabled={isBusy}
            >
              {isBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pause className="h-4 w-4 mr-2" />}
              Suspendre (À payer plus tard)
            </Button>

            <Button
              variant="outline"
              onClick={handleStartExclude}
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isBusy}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Exclure ce salaire
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-2 border-t">
          <Button
            variant="ghost"
            onClick={handleVoirDossierRH}
            className="text-muted-foreground"
            disabled={isBusy}
          >
            <User className="h-4 w-4 mr-2" />
            Dossier RH
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isBusy}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
