import { newProspects } from './newProspectsData';

import React, { useState } from 'react';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/shared/use-toast';
import { supabase } from '@/lib/supabaseBrowser';
import type { TablesInsert } from '@/integrations/supabase/types';
import { Loader2 } from 'lucide-react';

// Mapping des statuts du tableau vers les statuts de la base de données
import type { Database } from '@/integrations/supabase/types';

type StatutEtablissement = Database['public']['Enums']['statut_etablissement'];
type TypeDPI = Database['public']['Enums']['type_dpi'];

const mapStatut = (statut: string): StatutEtablissement => {
  const mapping: Record<string, StatutEtablissement> = {
    'I-Etude médico-éco émise': 'Etude émise',
    'H-Dans les rdvs': 'Dans les RDV',
    'G-Attente post rdv': 'Attente post RDV',
    'F-RDV pris': 'RDV pris',
    'E-Attente rdv': 'Attente RDV',
    'C-Bloqué': 'Bloqué',
    'B-Reporté': 'Reporté'
  };
  return mapping[statut] || 'Prospect';
};

// Mapping des DPI
const mapDPI = (dpi: string): TypeDPI | null => {
  const mapping: Record<string, TypeDPI> = {
    'Maison': 'Autre Lourd',
    'Hôpital Manager': 'Hopital Manager',
    'Autres lourd': 'Autre Lourd',
    'Autres web': 'Autre Web',
    'ResUrgences': 'ResUrgences',
    'Terminal Urgences': 'Terminal Urgences'
  };
  
  if (mapping[dpi]) return mapping[dpi];
  
  // Vérifier si c'est un DPI connu
  const dpisConnus: TypeDPI[] = [
    'Hopital Manager', 'ORBIS', 'Care4U', 'Easily', 'Axigate', 'ResUrgences',
    'Terminal Urgences', 'Sillage', 'Cerner', 'UrQual', 'TrakCare', 'DxCare',
    'Xtreme Santé', 'M-Crossway', 'Mediburn', 'Maincare', 'Autre Lourd', 'Autre Web', 'Inconnu'
  ];
  
  return dpisConnus.includes(dpi as TypeDPI) ? (dpi as TypeDPI) : 'Inconnu';
};

// Conversion ETA signature vers date
const parseETA = (eta: string | null): string | null => {
  if (!eta) return null;
  
  // Format: "2026 T3" -> Q3 2026
  const match = eta.match(/(\d{4})\s*T(\d)/);
  if (match) {
    const year = parseInt(match[1]);
    const trimestre = parseInt(match[2]);
    const mois = (trimestre - 1) * 3 + 2; // Milieu du trimestre
    return new Date(year, mois, 15).toISOString().split('T')[0];
  }
  
  if (eta === 'soon') {
    const dans3Mois = new Date();
    dans3Mois.setMonth(dans3Mois.getMonth() + 3);
    return dans3Mois.toISOString().split('T')[0];
  }
  
  return null;
};

export const ImportNewProspects: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < newProspects.length; i++) {
        const prospect = newProspects[i];
        
        try {
          // Vérifier si l'établissement existe déjà
          const { data: existing } = await supabase
            .from('etablissements')
            .select('id')
            .eq('nom', prospect.nom)
            .maybeSingle();

          if (existing) {
            debug.log(`Établissement ${prospect.nom} existe déjà, ignoré`);
            continue;
          }

          // Préparer les données pour l'insertion
          const insertData = {
            nom: prospect.nom,
            type: prospect.type,
            statut: mapStatut(prospect.statut) || 'Prospect',
            ville: prospect.ville,
            region: prospect.region,
            date_prise_contact: new Date().toISOString().split('T')[0],
            progression: 0
          } as TablesInsert<'etablissements'>; // Le slug sera généré par le trigger

          // Ajouter les champs optionnels seulement s'ils ne sont pas null/undefined
          if (mapDPI(prospect.dpi || '')) {
            insertData.dpi = mapDPI(prospect.dpi || '');
          }
          
          if (prospect.adresse) {
            insertData.adresse = prospect.adresse;
          }
          
          if (prospect.code_postal) {
            insertData.code_postal = prospect.code_postal;
          }
          
          if (prospect.notes) {
            insertData.notes = prospect.notes;
          }
          
          if (parseETA(prospect.eta_signature)) {
            insertData.date_previsionnelle_signature = parseETA(prospect.eta_signature);
          }

          // Créer l'établissement
          const { error } = await supabase
            .from('etablissements')
            .insert(insertData);

          if (error) {
            debug.error(`Erreur pour ${prospect.nom}:`, error);
            errors.push(`${prospect.nom}: ${error.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          debug.error(`Erreur inattendue pour ${prospect.nom}:`, err);
          errors.push(`${prospect.nom}: Erreur inattendue`);
          errorCount++;
        }

        setProgress(((i + 1) / newProspects.length) * 100);
        
        // Petite pause pour éviter de surcharger la base
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const resultMessage = `Import terminé: ${successCount} créés, ${errorCount} erreurs`;
      setImportResult(resultMessage);
      
      if (errors.length > 0) {
        debug.log('Erreurs détaillées:', errors);
      }

      toast({
        title: "Import terminé",
        description: resultMessage,
        variant: successCount > 0 ? "default" : "destructive"
      });

    } catch (error) {
      debug.error('Erreur générale:', error);
      toast({
        title: "Erreur d'import",
        description: "Une erreur est survenue lors de l'import",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Import des nouveaux prospects</CardTitle>
        <CardDescription>
          Import de {newProspects.length} nouveaux prospects avec leurs informations complètes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isImporting && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Import en cours... {Math.round(progress)}%
            </p>
          </div>
        )}
        
        {importResult && (
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm">{importResult}</p>
          </div>
        )}

        <Button 
          onClick={handleImport} 
          disabled={isImporting}
          className="w-full"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Import en cours...
            </>
          ) : (
            `Importer ${newProspects.length} prospects`
          )}
        </Button>

        <div className="text-xs text-muted-foreground">
          <p>Les prospects suivants seront importés :</p>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {newProspects.slice(0, 10).map((prospect) => (
              <li key={`new-prospect-${prospect.nom}-${prospect.ville}`} className="truncate">
                • {prospect.nom} ({prospect.ville}) - {prospect.statut}
              </li>
            ))}
            {newProspects.length > 10 && (
              <li className="text-muted-foreground">... et {newProspects.length - 10} autres</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};