import React, { useState } from 'react';
import { debug } from '@/lib/debug';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseBrowser';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from '@tanstack/react-query';

interface CsvRow {
  [key: string]: string;
}

import type { TablesInsert } from '@/integrations/supabase/types'

interface TarifsPalliers {
  [key: string]: number;
}

type ImportData = Partial<TablesInsert<'etablissements'>> & {
  tarifs_palliers?: TarifsPalliers;
  [key: string]: unknown;
}

interface FieldMapping {
  csvColumn: string;
  dbField: string;
}

const ETABLISSEMENT_FIELDS = [
  { key: 'nom', label: 'Nom de l\'établissement', required: true },
  { key: 'ville', label: 'Ville', required: true },
  { key: 'region', label: 'Région', required: true },
  { key: 'type', label: 'Type (CH/CHU/GHT/ESPIC/Privé)', required: true },
  { key: 'statut', label: 'Statut', required: false },
  { key: 'dpi', label: 'DPI', required: false },
  { key: 'nombre_passages_urgences_annuel', label: 'Nombre de passages urgences', required: false },
  { key: 'adresse', label: 'Adresse', required: false },
  { key: 'code_postal', label: 'Code postal', required: false },
  { key: 'telephone', label: 'Téléphone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'date_signature', label: 'Date signature', required: false },
  { key: 'date_previsionnelle_signature', label: 'Date de signature estimée', required: false },
  { key: 'pallier_vise', label: 'Pallier visé', required: false },
  { key: 'pallier_realise', label: 'Pallier réalisé', required: false },
  { key: 'modele_statique_succes', label: 'Modèle (succès statique)', required: false },
  { key: 'tarif_pallier_1', label: 'Tarif Pallier 1', required: false },
  { key: 'tarif_pallier_2', label: 'Tarif Pallier 2', required: false },
  { key: 'tarif_pallier_3', label: 'Tarif Pallier 3', required: false },
  { key: 'tarif_pallier_4', label: 'Tarif Pallier 4', required: false },
];

import { FALLBACK_STATUTS_IMPORT, FALLBACK_TYPES_ETABLISSEMENT, FALLBACK_DPI } from "@/config/referenceDataDefaults"
import { useStatutsEtablissement, useTypesEtablissement, useDpiList } from "@/hooks/system/useReferenceData"

export const ImportEtablissements: React.FC = () => {
  const { data: statutsRef } = useStatutsEtablissement();
  const { data: typesRef } = useTypesEtablissement();
  const { data: dpiRef } = useDpiList();

  const STATUT_VALUES = statutsRef.length > 0 ? statutsRef.map(s => s.label) : [...FALLBACK_STATUTS_IMPORT];
  const TYPE_VALUES = typesRef.length > 0 ? typesRef.map(s => s.label) : [...FALLBACK_TYPES_ETABLISSEMENT];
  const DPI_VALUES = dpiRef.length > 0 ? dpiRef.map(s => s.label) : [...FALLBACK_DPI];
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);
  
  const queryClient = useQueryClient();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast.error('Erreur lors de la lecture du fichier CSV');
          return;
        }
        
        const data = results.data as CsvRow[];
        setCsvData(data);
        
        const headers = Object.keys(data[0] || {});
        setCsvHeaders(headers);
        
        // Initialiser les mappings avec des suggestions automatiques
        const autoMappings: FieldMapping[] = ETABLISSEMENT_FIELDS.map(field => {
          const suggestedColumn = headers.find(header => 
            header.toLowerCase().includes(field.key.toLowerCase()) ||
            header.toLowerCase().includes(field.label.toLowerCase())
          );
          
          return {
            csvColumn: suggestedColumn || '',
            dbField: field.key
          };
        });
        
        setFieldMappings(autoMappings);
        setImportResults(null);
      },
      error: (error) => {
        toast.error(sanitizeSupabaseError(error));
      }
    });
  };

  const updateMapping = (dbField: string, csvColumn: string) => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.dbField === dbField 
          ? { ...mapping, csvColumn: csvColumn === 'none' ? '' : csvColumn }
          : mapping
      )
    );
  };

  const validateData = (row: CsvRow, mappings: FieldMapping[]): string[] => {
    const errors: string[] = [];
    
    mappings.forEach(mapping => {
      if (!mapping.csvColumn) return;
      
      const field = ETABLISSEMENT_FIELDS.find(f => f.key === mapping.dbField);
      const value = row[mapping.csvColumn]?.trim();
      
      if (field?.required && !value) {
        errors.push(`${field.label} est requis`);
      }
      
      // Validation spécifique pour certains champs
      if (value) {
        switch (mapping.dbField) {
          case 'type':
            if (!TYPE_VALUES.includes(value)) {
              errors.push(`Type invalide: ${value}. Valeurs acceptées: ${TYPE_VALUES.join(', ')}`);
            }
            break;
          case 'statut':
            if (!STATUT_VALUES.includes(value)) {
              errors.push(`Statut invalide: ${value}. Valeurs acceptées: ${STATUT_VALUES.join(', ')}`);
            }
            break;
          case 'dpi':
            if (!DPI_VALUES.includes(value)) {
              errors.push(`DPI invalide: ${value}. Valeurs acceptées: ${DPI_VALUES.join(', ')}`);
            }
            break;
          case 'nombre_passages_urgences_annuel':
            if (isNaN(Number(value))) {
              errors.push(`${field?.label} doit être un nombre`);
            }
            break;
          case 'tarif_pallier_1':
          case 'tarif_pallier_2':
          case 'tarif_pallier_3':
          case 'tarif_pallier_4':
            if (isNaN(Number(value))) {
              errors.push(`${field?.label} doit être un nombre`);
            }
            break;
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              errors.push(`Email invalide: ${value}`);
            }
            break;
        }
      }
    });
    
    return errors;
  };

  const transformRowData = (row: CsvRow, mappings: FieldMapping[]) => {
    const data: ImportData = {};
    
    mappings.forEach(mapping => {
      if (!mapping.csvColumn) return;
      
      const value = row[mapping.csvColumn]?.trim();
      if (!value) return;
      
      switch (mapping.dbField) {
        case 'nombre_passages_urgences_annuel':
          data[mapping.dbField] = parseInt(value, 10);
          break;
        case 'tarif_pallier_1':
        case 'tarif_pallier_2':
        case 'tarif_pallier_3':
        case 'tarif_pallier_4':
          // Gérer les tarifs des palliers - on va les grouper dans tarifs_palliers JSON
          if (!data.tarifs_palliers) {
            data.tarifs_palliers = {};
          }
          const pallierNumber = mapping.dbField.split('_')[2];
          data.tarifs_palliers[`pallier_${pallierNumber}`] = parseFloat(value);
          break;
        case 'date_signature':
        case 'date_previsionnelle_signature':
          // Essayer de parser la date
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            data[mapping.dbField] = date.toISOString().split('T')[0];
          }
          break;
        default:
          data[mapping.dbField] = value;
      }
    });
    
    return data;
  };

  const handleImport = async () => {
    if (csvData.length === 0) {
      toast.error('Aucune donnée à importer');
      return;
    }

    const activeMappings = fieldMappings.filter(m => m.csvColumn);
    if (activeMappings.length === 0) {
      toast.error('Aucun mapping configuré');
      return;
    }

    setIsImporting(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowErrors = validateData(row, activeMappings);
        
        if (rowErrors.length > 0) {
          errors.push(`Ligne ${i + 2}: ${rowErrors.join(', ')}`);
          continue;
        }

        const data = transformRowData(row, activeMappings);
        
        // Vérifier les champs requis
        if (!data.nom || !data.ville || !data.region || !data.type) {
          errors.push(`Ligne ${i + 2}: Champs requis manquants (nom, ville, région, type)`);
          continue;
        }

        const { error } = await supabase
          .from('etablissements')
          .insert(data as TablesInsert<'etablissements'>);

        if (error) {
          errors.push(`Ligne ${i + 2}: ${error.message}`);
        } else {
          successCount++;
        }
      }

      setImportResults({ success: successCount, errors });
      
      if (successCount > 0) {
        toast.success(`${successCount} établissement(s) importé(s) avec succès`);
        queryClient.invalidateQueries({ queryKey: ['etablissements'] });
      }
      
      if (errors.length > 0) {
        toast.error(`${errors.length} erreur(s) lors de l'import`);
      }

    } catch (error) {
      toast.error('Erreur lors de l\'import');
      debug.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ETABLISSEMENT_FIELDS.map(field => field.label);
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_etablissements.csv';
    a.style.display = 'none';
    
    // Ajout sécurisé au DOM
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage sécurisé
    try {
      if (a.parentNode === document.body) {
        document.body.removeChild(a);
      }
    } catch (cleanupError) {
      debug.warn('Warning: DOM cleanup failed:', cleanupError);
    } finally {
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import d'établissements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="csvFile">Fichier CSV</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </div>
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="mt-6"
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger template
            </Button>
          </div>
          
          {csvHeaders.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Configuration des colonnes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ETABLISSEMENT_FIELDS.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Select
                      value={fieldMappings.find(m => m.dbField === field.key)?.csvColumn || 'none'}
                      onValueChange={(value) => updateMapping(field.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une colonne CSV" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {csvHeaders.map(header => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {csvData.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>{csvData.length} ligne(s) détectée(s)</span>
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="flex items-center gap-2"
                >
                  {isImporting ? 'Import en cours...' : 'Importer'}
                </Button>
              </div>
              
              {importResults && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        {importResults.success} établissement(s) importé(s) avec succès
                      </div>
                      {importResults.errors.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            {importResults.errors.length} erreur(s):
                          </div>
                          <div className="max-h-40 overflow-y-auto text-sm text-red-600">
                            {importResults.errors.map((error, index) => (
                              <div key={`import-error-${index}-${error.slice(0, 20)}`}>• {error}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {csvHeaders.slice(0, 5).map(header => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                      {csvHeaders.length > 5 && <TableHead>...</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 3).map((row, index) => (
                      // stable: csv preview rows have no id, ordered preview
                      <TableRow key={`csv-row-${index}`}>
                        {csvHeaders.slice(0, 5).map(header => (
                          <TableCell key={header} className="max-w-32 truncate">
                            {row[header]}
                          </TableCell>
                        ))}
                        {csvHeaders.length > 5 && <TableCell>...</TableCell>}
                      </TableRow>
                    ))}
                    {csvData.length > 3 && (
                      <TableRow>
                        <TableCell colSpan={Math.min(csvHeaders.length, 6)} className="text-center text-muted-foreground">
                          ... et {csvData.length - 3} ligne(s) de plus
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};