import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { evaluate } from 'https://esm.sh/mathjs@11.11.2';
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// 🔒 SECURITY: Safe formula evaluation with math.js
// Replaces unsafe eval() to prevent code injection
function safeEvaluate(formula: string, variables: Record<string, number>): number {
  try {
    // Only allow whitelisted variables and basic math operations
    const allowedVariables = ['salaires_bruts', 'nb_employes', 'tva_collectee', 'tva_deductible'];
    
    // Validate that formula only contains allowed characters
    const sanitizedFormula = formula.replace(/\s/g, '');
    const allowedPattern = /^[\d+\-*/.()]+$|^([a-z_]+[\d+\-*/.()]*)+$/i;
    
    if (!allowedPattern.test(sanitizedFormula)) {
      console.warn(`Formula rejected (invalid characters): ${formula}`);
      return 0;
    }
    
    // Filter variables to only include whitelisted ones
    const safeVariables: Record<string, number> = {};
    for (const key of allowedVariables) {
      if (key in variables) {
        safeVariables[key] = variables[key];
      }
    }
    
    // Use math.js evaluate with scope (no access to dangerous functions)
    const result = evaluate(formula, safeVariables);
    
    if (typeof result !== 'number' || !isFinite(result)) {
      console.warn(`Formula evaluation returned non-number: ${result}`);
      return 0;
    }
    
    return result;
  } catch (e: unknown) {
    console.error('Error evaluating formula safely:', formula, e);
    return 0;
  }
}

interface RecurringExpenseRule {
  categorie_code: string;
  nom: string;
  formule_calcul: string;
  jour_du_mois: number;
  recurrence: 'mensuel' | 'trimestriel' | 'annuel';
}

// Règles métier pour les dépenses récurrentes
const RECURRING_RULES: RecurringExpenseRule[] = [
  {
    categorie_code: 'DEP_URSSAF',
    nom: 'URSSAF',
    formule_calcul: 'salaires_bruts * 0.45',
    jour_du_mois: 15,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_MUTUELLE',
    nom: 'Mutuelle entreprise',
    formule_calcul: 'nb_employes * 60',
    jour_du_mois: 1,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_PREVOYANCE',
    nom: 'Prévoyance',
    formule_calcul: 'salaires_bruts * 0.015',
    jour_du_mois: 1,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_RETRAITE',
    nom: 'Retraite complémentaire',
    formule_calcul: 'salaires_bruts * 0.08',
    jour_du_mois: 15,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_TVA',
    nom: 'TVA',
    formule_calcul: 'tva_collectee - tva_deductible',
    jour_du_mois: 20,
    recurrence: 'mensuel'
  },
  // Abonnements mensuels
  {
    categorie_code: 'DEP_GITHUB',
    nom: 'GitHub Team',
    formule_calcul: '44',
    jour_du_mois: 1,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_SUPABASE',
    nom: 'Supabase Pro',
    formule_calcul: '25',
    jour_du_mois: 1,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_AZURE',
    nom: 'Azure OpenAI',
    formule_calcul: '200',
    jour_du_mois: 1,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_NOTION',
    nom: 'Notion Team',
    formule_calcul: '80',
    jour_du_mois: 1,
    recurrence: 'mensuel'
  },
  {
    categorie_code: 'DEP_FIGMA',
    nom: 'Figma Professional',
    formule_calcul: '45',
    jour_du_mois: 1,
    recurrence: 'mensuel'
  }
];

async function calculateExpenseAmount(
  supabase: any,
  formule: string,
  mois: Date
): Promise<number> {
  // Si c'est un nombre fixe
  if (!isNaN(Number(formule))) {
    return Number(formule);
  }

  // Calculer salaires_bruts depuis rh_salaires_mensuels du mois en cours
  if (formule.includes('salaires_bruts')) {
    const moisStr = mois.toISOString().split('T')[0].substring(0, 7) + '-01';
    
    const { data: salaires, error } = await supabase
      .from('rh_salaires_mensuels')
      .select('salaire_brut')
      .eq('mois', moisStr)
      .eq('statut', 'prevu');

    if (error) {
      console.error('Error fetching salaires from rh_salaires_mensuels:', error);
      // Fallback sur profiles si pas de données RH
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('salaire_brut')
        .eq('actif', true);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return 0;
      }

      const totalSalairesBruts = profiles?.reduce((sum: number, p: any) => {
        return sum + (p.salaire_brut || 0);
      }, 0) || 0;

      // 🔒 SECURITY: Use safeEvaluate instead of eval()
      return safeEvaluate(formule, { salaires_bruts: totalSalairesBruts });
    }

    const totalSalairesBruts = salaires?.reduce((sum: number, s: any) => {
      return sum + (s.salaire_brut || 0);
    }, 0) || 0;

    console.log(`Calculated salaires_bruts for ${moisStr}: ${totalSalairesBruts}€`);

    // 🔒 SECURITY: Use safeEvaluate instead of eval()
    return safeEvaluate(formule, { salaires_bruts: totalSalairesBruts });
  }

  // Calculer nb_employes
  if (formule.includes('nb_employes')) {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('actif', true);

    if (error) {
      console.error('Error counting employees:', error);
      return 0;
    }

    // 🔒 SECURITY: Use safeEvaluate instead of eval()
    return safeEvaluate(formule, { nb_employes: count || 0 });
  }

  // Formule TVA — non implémenté : nécessite l'ajout de colonnes TVA dédiées
  // (montant_ht, taux_tva, montant_tva) sur tresorerie_recettes / tresorerie_depenses
  // puis le calcul réel = SUM(tva collectée sur recettes) - SUM(tva déductible sur dépenses).
  // En attendant, ces dépenses récurrentes doivent être créées manuellement.
  if (formule.includes('tva_collectee')) {
    console.warn('Formule TVA non implémentée — colonnes TVA manquantes en BDD');
    return 0;
  }

  return 0;
}

async function generateRecurringExpenses(supabase: any): Promise<number> {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let expensesCreated = 0;

  for (const rule of RECURRING_RULES) {
    // Vérifier si l'expense existe déjà pour ce mois
    const dateExpense = new Date(currentYear, currentMonth, rule.jour_du_mois);
    const dateExpenseStr = dateExpense.toISOString().split('T')[0];

    const { data: existing, error: checkError } = await supabase
      .from('tresorerie_depenses')
      .select('id')
      .eq('categorie_code', rule.categorie_code)
      .eq('date_prevue', dateExpenseStr)
      .eq('est_recurrent', true)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing expense:', checkError);
      continue;
    }

    if (existing) {
      console.log(`Expense already exists for ${rule.nom} on ${dateExpenseStr}`);
      continue;
    }

    // Calculer le montant
    const montant = await calculateExpenseAmount(supabase, rule.formule_calcul, dateExpense);

    if (montant === 0) {
      console.log(`Skipping ${rule.nom} - amount is 0`);
      continue;
    }

    // Créer la dépense
    const { error: insertError } = await supabase
      .from('tresorerie_depenses')
      .insert({
        nom: rule.nom,
        montant: Math.round(montant * 100) / 100,
        date_prevue: dateExpenseStr,
        statut: 'en_attente',
        categorie_code: rule.categorie_code,
        est_recurrent: true,
        recurrence: rule.recurrence,
        notes: `Généré automatiquement le ${today.toISOString().split('T')[0]} via formule: ${rule.formule_calcul}`
      });

    if (insertError) {
      console.error(`Error creating expense for ${rule.nom}:`, insertError);
      continue;
    }

    console.log(`Created recurring expense: ${rule.nom} - ${montant}€ on ${dateExpenseStr}`);
    expensesCreated++;
  }

  return expensesCreated;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const denied = requireInternalSecret(req, corsHeaders);
    if (denied) return denied;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting recurring expenses generation...');
    const expensesCreated = await generateRecurringExpenses(supabase);

    return new Response(
      JSON.stringify({ success: true, expensesCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    return buildErrorResponse('generate-recurring-expenses', error, corsHeaders, 500);
  }
});

