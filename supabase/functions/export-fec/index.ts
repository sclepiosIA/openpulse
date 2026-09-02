import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient, safeErrorLog } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

/**
 * Export FEC (Fichier des Écritures Comptables)
 * Format conforme à l'article A47 A-1 du Livre des Procédures Fiscales
 * 
 * Colonnes obligatoires du FEC:
 * 1. JournalCode, 2. JournalLib, 3. EcritureNum, 4. EcritureDate
 * 5. CompteNum, 6. CompteLib, 7. CompAuxNum, 8. CompAuxLib
 * 9. PieceRef, 10. PieceDate, 11. EcritureLib, 12. Debit
 * 13. Credit, 14. EcritureLet, 15. DateLet, 16. ValidDate
 * 17. Montantdevise, 18. Idevise
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 🔒 Validate JWT — reject anon/unauthenticated callers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub || claimsData.claims.role !== 'authenticated') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 🔒 Restrict to admin/direction roles (financial export)
    const userId = claimsData.claims.sub as string;
    const { data: hasAccess } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const { data: hasDirection } = await supabase.rpc('has_role', { _user_id: userId, _role: 'direction' });
    if (!hasAccess && !hasDirection) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { startDate, endDate, exercice } = await req.json();

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'startDate and endDate are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch all factures in the period
    const { data: factures, error: facturesError } = await supabase
      .from("factures")
      .select(`
        *,
        etablissement:etablissements(id, nom, siret),
        lignes:factures_lignes(*),
        paiements:paiements_factures(*)
      `)
      .gte("date_emission", startDate)
      .lte("date_emission", endDate)
      .in("statut", ['emise', 'envoyee', 'en_attente', 'partiellement_payee', 'payee']);

    if (facturesError) throw facturesError;

    // Fetch all expenses in the period
    const { data: depenses, error: depensesError } = await supabase
      .from("tresorerie")
      .select("*")
      .eq("type", "depense")
      .gte("date", startDate)
      .lte("date", endDate);

    if (depensesError) throw depensesError;

    // Generate FEC entries
    const fecEntries: FECEntry[] = [];
    let ecritureNum = 1;

    // Process invoices (sales)
    for (const facture of factures || []) {
      const dateEmission = formatDateFEC(facture.date_emission);
      
      // Client debit entry (411xxx)
      fecEntries.push({
        JournalCode: "VT",
        JournalLib: "Journal des Ventes",
        EcritureNum: String(ecritureNum).padStart(6, '0'),
        EcritureDate: dateEmission,
        CompteNum: "411000",
        CompteLib: "Clients",
        CompAuxNum: facture.client_siret || "",
        CompAuxLib: facture.client_nom,
        PieceRef: facture.numero,
        PieceDate: dateEmission,
        EcritureLib: `Facture ${facture.numero} - ${facture.client_nom}`,
        Debit: formatMontantFEC(facture.montant_ttc),
        Credit: "0,00",
        EcritureLet: "",
        DateLet: "",
        ValidDate: dateEmission,
        Montantdevise: "",
        Idevise: ""
      });

      // Revenue credit entry (70xxxx)
      fecEntries.push({
        JournalCode: "VT",
        JournalLib: "Journal des Ventes",
        EcritureNum: String(ecritureNum).padStart(6, '0'),
        EcritureDate: dateEmission,
        CompteNum: "706000",
        CompteLib: "Prestations de services",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: facture.numero,
        PieceDate: dateEmission,
        EcritureLib: `Facture ${facture.numero} - ${facture.client_nom}`,
        Debit: "0,00",
        Credit: formatMontantFEC(facture.montant_ht),
        EcritureLet: "",
        DateLet: "",
        ValidDate: dateEmission,
        Montantdevise: "",
        Idevise: ""
      });

      // TVA credit entry (44571)
      if (facture.montant_tva > 0) {
        fecEntries.push({
          JournalCode: "VT",
          JournalLib: "Journal des Ventes",
          EcritureNum: String(ecritureNum).padStart(6, '0'),
          EcritureDate: dateEmission,
          CompteNum: "445710",
          CompteLib: "TVA collectée",
          CompAuxNum: "",
          CompAuxLib: "",
          PieceRef: facture.numero,
          PieceDate: dateEmission,
          EcritureLib: `TVA Facture ${facture.numero}`,
          Debit: "0,00",
          Credit: formatMontantFEC(facture.montant_tva),
          EcritureLet: "",
          DateLet: "",
          ValidDate: dateEmission,
          Montantdevise: "",
          Idevise: ""
        });
      }

      ecritureNum++;

      // Process payments for this invoice
      for (const paiement of facture.paiements || []) {
        const datePaiement = formatDateFEC(paiement.date_paiement);
        
        // Bank debit entry (512xxx)
        fecEntries.push({
          JournalCode: "BQ",
          JournalLib: "Journal de Banque",
          EcritureNum: String(ecritureNum).padStart(6, '0'),
          EcritureDate: datePaiement,
          CompteNum: "512000",
          CompteLib: "Banque",
          CompAuxNum: "",
          CompAuxLib: "",
          PieceRef: paiement.reference_paiement || facture.numero,
          PieceDate: datePaiement,
          EcritureLib: `Règlement ${facture.numero}`,
          Debit: formatMontantFEC(paiement.montant),
          Credit: "0,00",
          EcritureLet: `LET${facture.numero}`,
          DateLet: datePaiement,
          ValidDate: datePaiement,
          Montantdevise: "",
          Idevise: ""
        });

        // Client credit entry (411xxx)
        fecEntries.push({
          JournalCode: "BQ",
          JournalLib: "Journal de Banque",
          EcritureNum: String(ecritureNum).padStart(6, '0'),
          EcritureDate: datePaiement,
          CompteNum: "411000",
          CompteLib: "Clients",
          CompAuxNum: facture.client_siret || "",
          CompAuxLib: facture.client_nom,
          PieceRef: paiement.reference_paiement || facture.numero,
          PieceDate: datePaiement,
          EcritureLib: `Règlement ${facture.numero}`,
          Debit: "0,00",
          Credit: formatMontantFEC(paiement.montant),
          EcritureLet: `LET${facture.numero}`,
          DateLet: datePaiement,
          ValidDate: datePaiement,
          Montantdevise: "",
          Idevise: ""
        });

        ecritureNum++;
      }
    }

    // Process expenses
    for (const depense of depenses || []) {
      const dateDepense = formatDateFEC(depense.date);
      const compteCharge = getCompteCharge(depense.categorie);

      // Expense debit entry (6xxxxx)
      fecEntries.push({
        JournalCode: "AC",
        JournalLib: "Journal des Achats",
        EcritureNum: String(ecritureNum).padStart(6, '0'),
        EcritureDate: dateDepense,
        CompteNum: compteCharge,
        CompteLib: depense.categorie || "Charges diverses",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: depense.reference || `DEP-${depense.id.slice(0, 8)}`,
        PieceDate: dateDepense,
        EcritureLib: depense.description || "Dépense",
        Debit: formatMontantFEC(depense.montant),
        Credit: "0,00",
        EcritureLet: "",
        DateLet: "",
        ValidDate: dateDepense,
        Montantdevise: "",
        Idevise: ""
      });

      // Bank credit entry (512xxx)
      fecEntries.push({
        JournalCode: "AC",
        JournalLib: "Journal des Achats",
        EcritureNum: String(ecritureNum).padStart(6, '0'),
        EcritureDate: dateDepense,
        CompteNum: "512000",
        CompteLib: "Banque",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: depense.reference || `DEP-${depense.id.slice(0, 8)}`,
        PieceDate: dateDepense,
        EcritureLib: depense.description || "Dépense",
        Debit: "0,00",
        Credit: formatMontantFEC(depense.montant),
        EcritureLet: "",
        DateLet: "",
        ValidDate: dateDepense,
        Montantdevise: "",
        Idevise: ""
      });

      ecritureNum++;
    }

    // Generate CSV content
    const header = "JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise";
    
    const rows = fecEntries.map(e => 
      `${e.JournalCode}|${e.JournalLib}|${e.EcritureNum}|${e.EcritureDate}|${e.CompteNum}|${e.CompteLib}|${e.CompAuxNum}|${e.CompAuxLib}|${e.PieceRef}|${e.PieceDate}|${e.EcritureLib}|${e.Debit}|${e.Credit}|${e.EcritureLet}|${e.DateLet}|${e.ValidDate}|${e.Montantdevise}|${e.Idevise}`
    );

    const fecContent = [header, ...rows].join("\n");

    // Generate filename
    const siren = "123456789"; // Should be fetched from company settings
    const dateCloture = endDate.replace(/-/g, '');
    const filename = `${siren}FEC${dateCloture}.txt`;

    return new Response(JSON.stringify({
      success: true,
      filename,
      content: fecContent,
      stats: {
        totalEntries: fecEntries.length,
        facturesCount: factures?.length || 0,
        depensesCount: depenses?.length || 0,
        period: { startDate, endDate }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error exporting FEC:", safeErrorLog('export-fec', error));
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

interface FECEntry {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string;
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  Debit: string;
  Credit: string;
  EcritureLet: string;
  DateLet: string;
  ValidDate: string;
  Montantdevise: string;
  Idevise: string;
}

function formatDateFEC(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatMontantFEC(amount: number): string {
  return (amount || 0).toFixed(2).replace('.', ',');
}

function getCompteCharge(categorie: string | null): string {
  const mapping: Record<string, string> = {
    'salaires': '641000',
    'charges_sociales': '645000',
    'loyer': '613200',
    'electricite': '606100',
    'telephone': '626000',
    'internet': '626000',
    'fournitures': '606400',
    'transport': '625100',
    'restaurant': '625700',
    'formation': '618500',
    'logiciel': '651000',
    'materiel': '606300',
    'marketing': '623400',
    'assurance': '616000',
    'bancaire': '627000',
    'juridique': '622600',
    'comptable': '622600'
  };
  return mapping[categorie?.toLowerCase() || ''] || '618800';
}
