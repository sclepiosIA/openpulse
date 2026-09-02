import { useState } from 'react';
import { debug } from '@/lib/debug';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, Save, AlertTriangle } from 'lucide-react';
import type { QuoteResults } from '@/types/simulator';
import { formatEuro } from '@/lib/simulator-config';
import { useQuoteValidationMutation } from '@/hooks/quote/useQuoteValidationMutation';

interface QuoteValidationPanelProps {
  results: QuoteResults;
  etablissementId?: string;
  etablissementNom?: string;
  onValidated?: () => void;
}

type OffreType = 'succes' | 'statique';

export function QuoteValidationPanel({ 
  results, 
  etablissementId,
  etablissementNom,
  onValidated 
}: QuoteValidationPanelProps) {
  const [offreType, setOffreType] = useState<OffreType>('succes');
  const [selectedPalier, setSelectedPalier] = useState<string>('3');
  const validateQuote = useQuoteValidationMutation();

  if (!etablissementId) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          La validation contractuelle n'est disponible que depuis la fiche d'un établissement.
        </AlertDescription>
      </Alert>
    );
  }

  const hasReseller = results.configuration.resellerType !== null;
  const palierIndex = parseInt(selectedPalier) - 1;
  const selectedPalierData = results.paliers[palierIndex];
  
  // Pour le mode statique, on utilise le palier 3 (multiplicateur ≈ 1)
  const statiquePalierData = results.paliers[2]; // Palier 3, index 2

  const getRecapData = () => {
    if (offreType === 'statique') {
      return {
        type: 'Statique',
        coutAnnuel: hasReseller ? statiquePalierData.coutTotalRevendeur : statiquePalierData.coutTotal,
        fraisAcces: hasReseller ? statiquePalierData.fraisAccesRevendeur : statiquePalierData.fraisAcces,
      };
    }
    
    return {
      type: 'Au succès',
      palier: selectedPalier,
      coutAnnuel: hasReseller ? selectedPalierData.coutTotalRevendeur : selectedPalierData.coutTotal,
      fraisAcces: hasReseller ? selectedPalierData.fraisAccesRevendeur : selectedPalierData.fraisAcces,
      tauxObjectif: selectedPalierData.tauxObjectif,
    };
  };

  const handleValidate = async () => {
    try {
      if (offreType === 'succes') {
        const tarifsData = {
          palier1: hasReseller ? results.paliers[0].coutTotalRevendeur : results.paliers[0].coutTotal,
          palier2: hasReseller ? results.paliers[1].coutTotalRevendeur : results.paliers[1].coutTotal,
          palier3: hasReseller ? results.paliers[2].coutTotalRevendeur : results.paliers[2].coutTotal,
          palier4: hasReseller ? results.paliers[3].coutTotalRevendeur : results.paliers[3].coutTotal,
          frais_acces: hasReseller ? results.paliers[0].fraisAccesRevendeur : results.paliers[0].fraisAcces,
        };
        
        const seuilsData = {
          palier1: results.paliers[0].tauxObjectif,
          palier2: results.paliers[1].tauxObjectif,
          palier3: results.paliers[2].tauxObjectif,
          palier4: results.paliers[3].tauxObjectif,
        };

        await validateQuote.mutateAsync({
          type: "succes",
          etablissementId: etablissementId!,
          etablissementNom,
          pallierVise: selectedPalier,
          tarifsData,
          seuilsData,
          fraisAcces: tarifsData.frais_acces,
        });
      } else {
        const tarifAnnuelStatique = hasReseller 
          ? statiquePalierData.prixSolutionRevendeur 
          : statiquePalierData.prixSolution;
        
        const fraisAccesStatique = hasReseller
          ? statiquePalierData.fraisAccesRevendeur
          : statiquePalierData.fraisAcces;

        await validateQuote.mutateAsync({
          type: "statique",
          etablissementId: etablissementId!,
          etablissementNom,
          tarifAnnuel: tarifAnnuelStatique,
          fraisAcces: fraisAccesStatique,
        });
      }

      onValidated?.();
    } catch (error) {
      debug.error('Erreur validation devis:', error);
    }
  };

  const recapData = getRecapData();

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Save className="h-4 w-4" />
          Validation contractuelle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type d'offre */}
        <div className="space-y-2">
          <Label>Type d'offre</Label>
          <RadioGroup
            value={offreType}
            onValueChange={(v) => setOffreType(v as OffreType)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="succes" id="succes" />
              <Label htmlFor="succes" className="cursor-pointer">Au succès</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="statique" id="statique" />
              <Label htmlFor="statique" className="cursor-pointer">Statique (×1)</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Sélection du palier (si mode au succès) */}
        {offreType === 'succes' && (
          <div className="space-y-2">
            <Label>Palier visé</Label>
            <Select value={selectedPalier} onValueChange={setSelectedPalier}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {results.paliers.map((p) => (
                  <SelectItem key={p.palier} value={String(p.palier)}>
                    Palier {p.palier} - Taux {p.tauxObjectif.toFixed(1)}% - {formatEuro(hasReseller ? p.coutTotalRevendeur : p.coutTotal)}/an
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Récapitulatif */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Récapitulatif</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Type :</div>
            <div className="font-medium">{recapData.type}</div>
            
            {offreType === 'succes' && (
              <>
                <div>Palier :</div>
                <div className="font-medium">Palier {recapData.palier}</div>
                <div>Taux objectif :</div>
                <div className="font-medium">{recapData.tauxObjectif?.toFixed(1)}%</div>
              </>
            )}
            
            <div>Frais d'accès :</div>
            <div className="font-medium">{formatEuro(recapData.fraisAcces)}</div>
            
            <div>Coût annuel :</div>
            <div className="font-medium text-primary">{formatEuro(recapData.coutAnnuel)}</div>
          </div>
        </div>

        {/* Bouton de validation */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full gap-2" disabled={validateQuote.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              Valider et enregistrer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la validation</AlertDialogTitle>
              <AlertDialogDescription>
                Vous êtes sur le point d'enregistrer les informations contractuelles pour{' '}
                <strong>{etablissementNom || 'cet établissement'}</strong>.
                <br /><br />
                <strong>Type d'offre :</strong> {recapData.type}
                <br />
                <strong>Coût annuel :</strong> {formatEuro(recapData.coutAnnuel)}
                <br /><br />
                Cette action mettra à jour les données de l'établissement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleValidate} disabled={validateQuote.isPending}>
                {validateQuote.isPending ? 'Enregistrement...' : 'Confirmer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
