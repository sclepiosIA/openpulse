import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";

export interface ParsedProduitRow {
  code: string;
  nom: string;
  description?: string | null;
  type: 'service' | 'produit' | 'licence' | 'formation' | 'maintenance';
  prix_unitaire_ht: number;
  taux_tva: number;
  unite: string;
  est_actif: boolean;
  categorie?: string | null;
  _errors?: string[];
}

const VALID_TYPES = ['service', 'produit', 'licence', 'formation', 'maintenance'];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else current += ch;
  }
  result.push(current);
  return result.map(s => s.trim());
}

export function parseProduitsCSV(text: string): ParsedProduitRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const iCode = idx('code'), iNom = idx('nom'), iType = idx('type'),
        iPrix = idx('prix_unitaire_ht'), iTva = idx('taux_tva'),
        iUnite = idx('unite'), iDesc = idx('description'),
        iCat = idx('categorie'), iActif = idx('est_actif');

  return lines.slice(1).map((line, lineIdx) => {
    const cols = parseCSVLine(line);
    const errors: string[] = [];
    const code = iCode >= 0 ? cols[iCode] : '';
    const nom = iNom >= 0 ? cols[iNom] : '';
    const type = (iType >= 0 ? cols[iType] : 'service') as ParsedProduitRow['type'];
    const prix = iPrix >= 0 ? parseFloat(cols[iPrix]?.replace(',', '.')) : 0;
    const tva = iTva >= 0 ? parseFloat(cols[iTva]?.replace(',', '.')) : 20;

    if (!code) errors.push(`Ligne ${lineIdx + 2}: code manquant`);
    if (!nom) errors.push(`Ligne ${lineIdx + 2}: nom manquant`);
    if (!VALID_TYPES.includes(type)) errors.push(`Ligne ${lineIdx + 2}: type invalide (${type})`);
    if (isNaN(prix) || prix < 0) errors.push(`Ligne ${lineIdx + 2}: prix invalide`);

    return {
      code, nom, type,
      prix_unitaire_ht: isNaN(prix) ? 0 : prix,
      taux_tva: isNaN(tva) ? 20 : tva,
      unite: iUnite >= 0 ? (cols[iUnite] || 'unité') : 'unité',
      description: iDesc >= 0 ? (cols[iDesc] || null) : null,
      categorie: iCat >= 0 ? (cols[iCat] || null) : null,
      est_actif: iActif >= 0 ? (cols[iActif]?.toLowerCase() !== 'false' && cols[iActif] !== '0') : true,
      _errors: errors.length ? errors : undefined,
    };
  });
}

export function useProduitImport() {
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  async function importRows(rows: ParsedProduitRow[]) {
    setIsImporting(true);
    try {
      const valid = rows.filter(r => !r._errors).map(({ _errors, ...rest }) => rest);
      if (!valid.length) {
        toast({ title: "Aucune ligne valide", variant: "destructive" });
        return { inserted: 0 };
      }
      const { error, count } = await supabase
        .from("catalogue_produits")
        .insert(valid as never, { count: 'exact' });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["catalogue_produits"] });
      toast({ title: `${count ?? valid.length} produits importés` });
      return { inserted: count ?? valid.length };
    } catch (e: unknown) {
      toast({ title: "Erreur import", description: sanitizeSupabaseError(e), variant: "destructive" });
      return { inserted: 0 };
    } finally {
      setIsImporting(false);
    }
  }

  function exportCSV(rows: Array<{ code: string; nom: string; description?: string | null; type: string; prix_unitaire_ht: number; taux_tva: number; unite: string; est_actif: boolean; categorie?: string | null }>) {
    const headers = ['code', 'nom', 'description', 'type', 'categorie', 'prix_unitaire_ht', 'taux_tva', 'unite', 'est_actif'];
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(','),
      ...rows.map(r => [r.code, r.nom, r.description ?? '', r.type, r.categorie ?? '', r.prix_unitaire_ht, r.taux_tva, r.unite, r.est_actif].map(escape).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `catalogue-produits-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { importRows, exportCSV, isImporting };
}
