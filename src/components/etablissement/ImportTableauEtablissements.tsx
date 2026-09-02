import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { debug } from '@/lib/debug';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hospital, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseBrowser';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Jeu d'établissements à importer — données de DÉMONSTRATION.
 *
 * POURQUOI CE JEU EST FICTIF
 * La version d'origine portait 44 établissements RÉELS, nommés, avec leur ville,
 * leur région, le logiciel de dossier patient qu'ils utilisent et leur statut
 * commercial « Prospect ». Ce n'était pas un jeu d'essai : c'était le pipeline
 * commercial de l'éditeur, dans du code de production, promis à la publication.
 * Aucun de ces établissements n'avait consenti à y figurer, et le rapprochement
 * « quel établissement utilise quel concurrent » est une information de marché.
 *
 * Le fichier voisin `newProspectsData.ts` avait déjà reçu ce traitement ;
 * celui-ci avait été oublié.
 *
 * Les établissements, villes et régions ci-dessous ne désignent aucune entité
 * réelle. La forme est contractuelle : mêmes clés, même export.
 *
 * LES VALEURS DE `dpi` SONT CONTRAINTES PAR LA BASE
 * La colonne est une énumération `type_dpi` ; une valeur absente est refusée à
 * l'insertion, et l'écran ne le signale que par un décompte partiel. La version
 * d'origine écrivait « Autre lourd » là où l'énumération attend « Autre Lourd » :
 * vérifié en base, `'Autre lourd'::type_dpi` rend « invalid input value for enum
 * type_dpi ». Ces trois lignes échouaient donc en silence. Seuls des libellés
 * génériques, présents dans l'énumération, sont employés ici.
 */
const ETABLISSEMENTS_TABLEAU = [
  { nom: 'CH de Val-Fleuri', ville: 'Val-Fleuri', region: 'Région Nord', type: 'CH', dpi: 'Autre Lourd', statut: 'Prospect' },
  { nom: 'CHU des Trois-Rivières', ville: 'Trois-Rivières', region: 'Région Ouest', type: 'CHU', dpi: 'Autre Lourd', statut: 'Prospect' },
  { nom: 'GHT Plaine-du-Sud', ville: 'Bourg-en-Plaine', region: 'Région Sud', type: 'GHT', dpi: 'Autre Web', statut: 'Prospect' },
  { nom: 'CH de Mont-Clair', ville: 'Mont-Clair', region: 'Région Est', type: 'CH', dpi: 'Autre Web', statut: 'Prospect' },
  { nom: 'ESPIC Sainte-Colline', ville: 'Sainte-Colline', region: 'Région Centre', type: 'ESPIC', dpi: 'Inconnu', statut: 'Prospect' },
  { nom: 'Clinique du Grand-Pré', ville: 'Grand-Pré', region: 'Région Ouest', type: 'Privé', dpi: 'Inconnu', statut: 'Prospect' },
  { nom: 'CHU de Rive-Haute', ville: 'Rive-Haute', region: 'Région Nord', type: 'CHU', dpi: 'Autre Lourd', statut: 'Prospect' },
  { nom: 'CH de Longchamp', ville: 'Longchamp', region: 'Région Sud', type: 'CH', dpi: 'Autre Web', statut: 'Prospect' },
  { nom: 'GHT Vallée-Bleue', ville: 'Vallée-Bleue', region: 'Région Est', type: 'GHT', dpi: 'Inconnu', statut: 'Prospect' },
  { nom: 'ESPIC Les Quatre-Chênes', ville: 'Quatre-Chênes', region: 'Région Centre', type: 'ESPIC', dpi: 'Autre Lourd', statut: 'Prospect' },
  { nom: 'Clinique de Beauregard', ville: 'Beauregard', region: 'Région Ouest', type: 'Privé', dpi: 'Autre Web', statut: 'Prospect' },
  { nom: 'CH de Pierrefonds', ville: 'Pierrefonds', region: 'Région Nord', type: 'CH', dpi: 'Inconnu', statut: 'Prospect' },
];

export const ImportTableauEtablissements: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleImportEtablissements = async () => {
    setIsImporting(true);
    
    try {
      let successCount = 0;
      const errors: string[] = [];

      for (const etab of ETABLISSEMENTS_TABLEAU) {
        const { error } = await supabase
          .from('etablissements')
          .insert({
            nom: etab.nom,
            ville: etab.ville,
            region: etab.region,
            type: etab.type as 'CH' | 'GHT' | 'CHU' | 'ESPIC' | 'Privé',
            statut: 'Prospect' as const,
            date_prise_contact: new Date().toISOString().split('T')[0],
            dpi: etab.dpi as never
          } as any); // Le slug sera généré par le trigger

        if (error) {
          errors.push(`${etab.nom}: ${error.message}`);
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} établissements importés avec succès`);
        queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      }
      
      if (errors.length > 0) {
        debug.error('Erreurs d\'import:', errors);
        toast.error(`${errors.length} erreur(s) lors de l'import`);
      }

    } catch (error) {
      toast.error('Erreur lors de l\'import');
      debug.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hospital className="h-5 w-5" />
          Import des établissements du tableau
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cette action ajoutera {ETABLISSEMENTS_TABLEAU.length} établissements du tableau 
            en tant que prospects avec leurs informations DPI.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-muted-foreground max-h-40 overflow-y-auto">
            {ETABLISSEMENTS_TABLEAU.map((etab) => (
              <div key={`etab-tableau-${etab.nom}`} className="flex items-center gap-1">
                <Hospital className="h-3 w-3" />
                <span className="truncate">{etab.nom} ({etab.dpi})</span>
              </div>
            ))}
          </div>

          <Button 
            onClick={handleImportEtablissements}
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <Hospital className="h-4 w-4 mr-2" />
                Importer les {ETABLISSEMENTS_TABLEAU.length} établissements
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};