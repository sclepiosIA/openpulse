import React, { useState } from 'react';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hospital, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseBrowser';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from '@tanstack/react-query';

const ETABLISSEMENTS_PREDDEFINIS = [
  { nom: 'CHU Martinique - Site de Fort-de-France', ville: 'Fort-de-France', region: 'Martinique', type: 'CHU' as const },
  { nom: 'CHU Martinique - Site de Trinité', ville: 'Trinité', region: 'Martinique', type: 'CHU' as const },
  { nom: 'CHRU de Brest', ville: 'Brest', region: 'Bretagne', type: 'CHU' as const },
  { nom: 'CHU de Poitiers', ville: 'Poitiers', region: 'Nouvelle-Aquitaine', type: 'CHU' as const },
  { nom: 'CHU de Caen Normandie', ville: 'Caen', region: 'Normandie', type: 'CHU' as const },
  { nom: 'CHRU de Strasbourg', ville: 'Strasbourg', region: 'Grand Est', type: 'CHU' as const },
  { nom: 'CHU de Clermont-Ferrand', ville: 'Clermont-Ferrand', region: 'Auvergne-Rhône-Alpes', type: 'CHU' as const },
  { nom: 'CHRU de Lille', ville: 'Lille', region: 'Hauts-de-France', type: 'CHU' as const },
  { nom: 'CHU de Saint-Étienne', ville: 'Saint-Étienne', region: 'Auvergne-Rhône-Alpes', type: 'CHU' as const },
  { nom: 'CHU de Nîmes', ville: 'Nîmes', region: 'Occitanie', type: 'CHU' as const },
  { nom: 'CHU de Dijon Bourgogne', ville: 'Dijon', region: 'Bourgogne-Franche-Comté', type: 'CHU' as const },
  { nom: 'CHU de Besançon', ville: 'Besançon', region: 'Bourgogne-Franche-Comté', type: 'CHU' as const },
  { nom: 'CHU de Reims', ville: 'Reims', region: 'Grand Est', type: 'CHU' as const },
  { nom: 'CHU de Limoges', ville: 'Limoges', region: 'Nouvelle-Aquitaine', type: 'CHU' as const },
  { nom: 'CHU de La Réunion - Site Nord', ville: 'Saint-Denis', region: 'La Réunion', type: 'CHU' as const },
  { nom: 'CHU de La Réunion - Site Sud', ville: 'Saint-Pierre', region: 'La Réunion', type: 'CHU' as const },
  { nom: 'CHU de Guadeloupe', ville: 'Pointe-à-Pitre', region: 'Guadeloupe', type: 'CHU' as const },
  { nom: 'CHU de Guyane', ville: 'Cayenne', region: 'Guyane', type: 'CHU' as const },
  { nom: 'CHU de Mayotte', ville: 'Mamoudzou', region: 'Mayotte', type: 'CHU' as const },
  { nom: 'CHU de Nouvelle-Calédonie', ville: 'Nouméa', region: 'Nouvelle-Calédonie', type: 'CHU' as const }
];

export const ImportPredefiniEtablissements: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleImportEtablissements = async () => {
    setIsImporting(true);
    
    try {
      const etablissementsWithStatut = ETABLISSEMENTS_PREDDEFINIS.map(etab => ({
        ...etab,
        statut: 'Prospect' as const,
        date_prise_contact: new Date().toISOString().split('T')[0],
      }));

      const { data, error } = await supabase
        .from('etablissements')
        .insert(etablissementsWithStatut as any); // Le slug sera généré par le trigger

      if (error) {
        toast.error(sanitizeSupabaseError(error));
      } else {
        toast.success(`${ETABLISSEMENTS_PREDDEFINIS.length} établissements importés avec succès`);
        queryClient.invalidateQueries({ queryKey: ['etablissements'] });
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
          Import d'établissements prédéfinis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cette action ajoutera {ETABLISSEMENTS_PREDDEFINIS.length} établissements CHU français 
            en tant que prospects dans la base de données.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-muted-foreground max-h-40 overflow-y-auto">
            {ETABLISSEMENTS_PREDDEFINIS.map((etab) => (
              <div key={`etab-predef-${etab.nom}`} className="flex items-center gap-1">
                <Hospital className="h-3 w-3" />
                <span className="truncate">{etab.nom}</span>
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
                Importer les {ETABLISSEMENTS_PREDDEFINIS.length} établissements
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};