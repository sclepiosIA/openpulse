import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Liste des noms d'employés connus pour le matching
const EMPLOYEE_NAMES = [
  'corentin', 'rémi', 'remi', 'jonathan', 'linoa', 'alexandre', 'mathieu',
  'pierre', 'jean', 'marie', 'paul', 'nicolas', 'thomas', 'julien'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: service_role bearer, INTERNAL_FUNCTION_SECRET, ou utilisateur
  // authentifié avec un rôle trésorerie (admin/direction/rh/copil)
  const auth = req.headers.get('Authorization') || '';
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const providedSecret = req.headers.get('x-internal-secret');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isServiceRole = !!serviceRoleKey && auth === `Bearer ${serviceRoleKey}`;
  const isInternal = !!internalSecret && providedSecret === internalSecret;
  let isAuthorizedUser = false;
  if (!isServiceRole && !isInternal && auth.startsWith('Bearer ')) {
    try {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        serviceRoleKey ?? ''
      );
      const token = auth.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await adminClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (!claimsError && userId) {
        const { data: roles } = await adminClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .in('role', ['admin', 'direction', 'rh', 'copil']);
        isAuthorizedUser = !!roles && roles.length > 0;
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    }
  }
  if (!isServiceRole && !isInternal && !isAuthorizedUser) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Accès non autorisé à la synchronisation Qonto',
      code: 'role_forbidden'
    }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const apiKey = Deno.env.get('QONTO_API_KEY');
    const organizationId = Deno.env.get('QONTO_ORGANIZATION_ID');

    if (!apiKey) {
      console.error('QONTO_API_KEY non configuré');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'QONTO_API_KEY non configuré dans les secrets Supabase',
          config_missing: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!organizationId) {
      console.error('QONTO_ORGANIZATION_ID non configuré');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'QONTO_ORGANIZATION_ID non configuré dans les secrets Supabase',
          config_missing: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = `${organizationId}:${apiKey}`;
    console.log(`🔄 Démarrage sync Qonto pour org: ${organizationId}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const startTime = Date.now();
    const batchId = crypto.randomUUID();

    const body = await req.json().catch(() => ({}));
    const daysBack = body.days_back || 90;
    const forceRelink = body.force_relink || false;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    const settledAtFrom = fromDate.toISOString().split('T')[0];

    console.log(`📅 Récupération des transactions depuis ${settledAtFrom}`);

    // Charger les profils employés pour le matching
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, prenom, nom, email')
      .eq('actif', true);
    
    const employeeProfiles = profiles || [];
    console.log(`👥 ${employeeProfiles.length} profils employés chargés pour matching`);

    // ========== ÉTAPE 1: Récupérer les comptes bancaires ==========
    console.log('📊 Récupération des comptes bancaires...');
    const orgResponse = await fetch('https://thirdparty.qonto.com/v2/organization', {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!orgResponse.ok) {
      const errorText = await orgResponse.text();
      console.error(`❌ Erreur API Qonto /organization: ${orgResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erreur API Qonto /organization: ${orgResponse.status}`,
          details: errorText,
          api_error: true
        }),
        { status: orgResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgData = await orgResponse.json();
    const bankAccountsData = orgData.organization?.bank_accounts || [];
    
    if (bankAccountsData.length === 0) {
      console.error('❌ Aucun compte bancaire trouvé');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Aucun compte bancaire trouvé dans l\'organisation Qonto',
          api_error: true
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💳 ${bankAccountsData.length} compte(s) bancaire(s) trouvé(s)`);

    const bankAccounts = bankAccountsData.map((acc: any) => ({
      iban: acc.iban,
      balance: acc.balance,
      balance_cents: acc.balance_cents,
      name: acc.name || 'Compte principal',
      slug: acc.slug,
      currency: acc.currency || 'EUR',
    }));

    const totalBalance = bankAccounts.reduce((sum: number, b: any) => sum + (b.balance || 0), 0);
    console.log(`💰 Solde total Qonto: ${totalBalance}€`);

    // ========== ÉTAPE 2: Récupérer TOUTES les transactions ==========
    let allTransactions: any[] = [];

    for (const account of bankAccountsData) {
      console.log(`🔍 Récupération transactions pour compte: ${account.name}`);
      
      let currentPage = 1;
      let hasMore = true;
      let accountTransactions: any[] = [];

      while (hasMore) {
        const qontoUrl = `https://thirdparty.qonto.com/v2/transactions?iban=${account.iban}&settled_at_from=${settledAtFrom}&per_page=100&current_page=${currentPage}`;
        
        const transactionsResponse = await fetch(qontoUrl, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });

        if (!transactionsResponse.ok) {
          const errorText = await transactionsResponse.text();
          console.error(`❌ Erreur transactions page ${currentPage}: ${transactionsResponse.status}`);
          break;
        }

        const transactionsData = await transactionsResponse.json();
        const pageTransactions = transactionsData.transactions || [];
        
        accountTransactions = [...accountTransactions, ...pageTransactions];
        
        const meta = transactionsData.meta;
        hasMore = meta?.next_page !== null && meta?.next_page !== undefined;
        
        console.log(`  📄 Page ${currentPage}: ${pageTransactions.length} transactions`);
        
        currentPage++;
        if (currentPage > 50) break;
      }
      
      console.log(`  ✅ ${accountTransactions.length} transactions pour ${account.name}`);
      allTransactions = [...allTransactions, ...accountTransactions];
    }

    console.log(`✅ Total: ${allTransactions.length} transactions récupérées`);

    let totalImported = 0;
    let totalReconciled = 0;
    let totalSkipped = 0;
    let totalReused = 0;
    const errors: string[] = [];

    // Traiter chaque transaction
    for (const tx of allTransactions) {
      try {
        const { data: existing } = await supabaseClient
          .from('tresorerie_operations_bancaires')
          .select('id')
          .eq('qonto_transaction_id', tx.transaction_id)
          .single();

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Mapping catégorie amélioré avec détection URSSAF
        const categorieCode = mapQontoCategoryEnhanced(tx);
        const txDate = (tx.settled_at || tx.emitted_at).split('T')[0];
        const moisDate = txDate.slice(0, 7) + '-01'; // Format YYYY-MM-01 pour tresorerie_revenus

        // ========== CRÉER AUTOMATIQUEMENT REVENU OU DÉPENSE ==========
        let createdRecetteId: string | null = null;
        let createdDepenseId: string | null = null;

        if (tx.side === 'credit') {
          // Transaction positive → Vérifier si un revenu existe déjà avec cette clé composite
          const noteLabel = `[Qonto] ${tx.label || 'Transaction crédit'}`;
          
          // ANTI-DOUBLON AMÉLIORÉ: Chercher un revenu existant par date + montant (avec tolérance)
          // Cette vérification évite les doublons même si le libellé diffère légèrement
          const { data: existingRevenu } = await supabaseClient
            .from('tresorerie_revenus')
            .select('id')
            .eq('source_modele', 'qonto')
            .eq('date_paiement_reel', txDate)
            .gte('montant_paye', Math.abs(tx.amount) - 0.01)
            .lte('montant_paye', Math.abs(tx.amount) + 0.01)
            .maybeSingle();

          let existingRevenuReused = false;
          if (existingRevenu) {
            // Revenu existant → réutiliser
            createdRecetteId = existingRevenu.id;
            existingRevenuReused = true;
            totalReused++;
            console.log(`📎 Revenu existant réutilisé: ${tx.label}`);
          } else {
            // Créer un nouveau revenu
            const { data: newRevenu, error: revenuError } = await supabaseClient
              .from('tresorerie_revenus')
              .insert({
                mois: moisDate,
                date_prevue: txDate,
                date_paiement_reel: txDate,
                montant_prevu: Math.abs(tx.amount),
                montant_paye: Math.abs(tx.amount),
                statut: 'paye',
                type_revenu: 'autre',
                notes: noteLabel,
                source_modele: 'qonto',
              })
              .select('id')
              .single();

            if (revenuError) {
              console.error('Erreur création revenu:', revenuError);
            } else if (newRevenu) {
              createdRecetteId = newRevenu.id;
              console.log(`💰 Revenu créé: ${tx.label} - ${Math.abs(tx.amount)}€`);
            }
          }
        } else {
          // Transaction négative → Créer une dépense
          const { data: newDepense, error: depenseError } = await supabaseClient
            .from('tresorerie_depenses')
            .insert({
              nom: tx.label || 'Dépense Qonto',
              montant: Math.abs(tx.amount),
              date_prevue: txDate,
              date_paiement_reel: txDate,
              statut: 'paye',
              categorie_code: categorieCode,
              source: 'qonto_sync',
              source_id: tx.transaction_id,
              notes: `[Qonto] Sync automatique`,
            })
            .select('id')
            .single();

          if (depenseError) {
            console.error('Erreur création dépense:', depenseError);
          } else if (newDepense) {
            createdDepenseId = newDepense.id;
            console.log(`💸 Dépense créée: ${tx.label} - ${Math.abs(tx.amount)}€`);
          }
        }

        // Insérer l'opération bancaire avec lien vers revenu/dépense créé
        const { error: insertError } = await supabaseClient
          .from('tresorerie_operations_bancaires')
          .insert({
            qonto_transaction_id: tx.transaction_id,
            qonto_account_id: tx.bank_account_id,
            qonto_sync_batch_id: batchId,
            date_operation: tx.emitted_at,
            date_valeur: tx.settled_at || tx.emitted_at,
            libelle: tx.label || 'Transaction Qonto',
            montant: Math.abs(tx.amount),
            type_operation: tx.side === 'credit' ? 'credit' : 'debit',
            categorie_code: categorieCode,
            reconcilie: createdRecetteId !== null || createdDepenseId !== null,
            recette_id: createdRecetteId,
            depense_id: createdDepenseId,
            raw_qonto_data: tx,
          });

        if (insertError) {
          console.error('Erreur insertion opération bancaire:', insertError);
          errors.push(`Transaction ${tx.transaction_id}: ${insertError.message}`);
          // Rollback: supprimer le revenu orphelin créé si l'opération bancaire échoue
          if (createdRecetteId && !existingRevenuReused) {
            await supabaseClient.from('tresorerie_revenus').delete().eq('id', createdRecetteId);
            console.warn(`🔄 Rollback revenu orphelin: ${createdRecetteId}`);
          }
        } else {
          totalImported++;
          if (createdRecetteId || createdDepenseId) {
            totalReconciled++;
          }
        }
      } catch (txError) {
        console.error(`Erreur transaction ${tx.transaction_id}:`, txError);
        errors.push(`Transaction ${tx.transaction_id}: ${txError.message}`);
      }
    }

    // ========== ÉTAPE 3: MIGRER LES TRANSACTIONS EXISTANTES SANS LIEN ==========
    console.log('🔄 Migration des transactions orphelines...');
    let orphansMigrated = 0;

    // 1. Récupérer les crédits sans recette_id
    const { data: creditsOrphelins } = await supabaseClient
      .from('tresorerie_operations_bancaires')
      .select('*')
      .eq('type_operation', 'credit')
      .is('recette_id', null);

    console.log(`📥 ${creditsOrphelins?.length || 0} crédits orphelins à migrer`);

    // Pour chaque crédit orphelin → vérifier si un revenu existe déjà OU créer et lier
    for (const op of creditsOrphelins || []) {
      const txDate = op.date_valeur?.split('T')[0] || op.date_operation?.split('T')[0];
      const moisDate = txDate.slice(0, 7) + '-01';
      const noteLabel = `[Qonto] ${op.libelle || 'Transaction crédit'}`;

      // ANTI-DOUBLON AMÉLIORÉ: Vérifier si un revenu existe déjà par date + montant (avec tolérance)
      const { data: existingRevenu } = await supabaseClient
        .from('tresorerie_revenus')
        .select('id')
        .eq('source_modele', 'qonto')
        .eq('date_paiement_reel', txDate)
        .gte('montant_paye', op.montant - 0.01)
        .lte('montant_paye', op.montant + 0.01)
        .maybeSingle();

      if (existingRevenu) {
        // Revenu existant → juste mettre à jour le lien
        await supabaseClient
          .from('tresorerie_operations_bancaires')
          .update({ recette_id: existingRevenu.id, reconcilie: true })
          .eq('id', op.id);
        orphansMigrated++;
        console.log(`📎 Lien orphelin vers revenu existant: ${op.libelle}`);
      } else {
        // Créer un nouveau revenu
        const { data: newRevenu, error: revError } = await supabaseClient
          .from('tresorerie_revenus')
          .insert({
            mois: moisDate,
            date_prevue: txDate,
            date_paiement_reel: txDate,
            montant_prevu: op.montant,
            montant_paye: op.montant,
            statut: 'paye',
            type_revenu: 'autre',
            notes: noteLabel,
            source_modele: 'qonto',
          })
          .select('id')
          .single();

        if (newRevenu && !revError) {
          await supabaseClient
            .from('tresorerie_operations_bancaires')
            .update({ recette_id: newRevenu.id, reconcilie: true })
            .eq('id', op.id);
          orphansMigrated++;
        }
      }
    }

    // 2. Récupérer les débits sans depense_id
    const { data: debitsOrphelins } = await supabaseClient
      .from('tresorerie_operations_bancaires')
      .select('*')
      .eq('type_operation', 'debit')
      .is('depense_id', null);

    console.log(`📤 ${debitsOrphelins?.length || 0} débits orphelins à migrer`);

    // Pour chaque débit orphelin → créer une dépense et lier
    for (const op of debitsOrphelins || []) {
      const txDate = op.date_valeur?.split('T')[0] || op.date_operation?.split('T')[0];

      const { data: newDepense, error: depError } = await supabaseClient
        .from('tresorerie_depenses')
        .insert({
          nom: op.libelle || 'Dépense Qonto',
          montant: op.montant,
          date_prevue: txDate,
          date_paiement_reel: txDate,
          statut: 'paye',
          categorie_code: op.categorie_code,
          source: 'qonto_sync',
          source_id: op.id,
          notes: `[Qonto] Sync automatique`,
        })
        .select('id')
        .single();

      if (newDepense && !depError) {
        await supabaseClient
          .from('tresorerie_operations_bancaires')
          .update({ depense_id: newDepense.id, reconcilie: true })
          .eq('id', op.id);
        orphansMigrated++;
      }
    }

    console.log(`✅ ${orphansMigrated} transactions orphelines migrées`);

    // ========== ÉTAPE 4: Mettre à jour connexion Qonto ==========
    const { data: existingConn } = await supabaseClient
      .from('tresorerie_qonto_connections')
      .select('id, sync_count')
      .eq('organization_id', organizationId)
      .single();

    if (existingConn) {
      await supabaseClient
        .from('tresorerie_qonto_connections')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_count: (existingConn.sync_count || 0) + 1,
          bank_accounts: bankAccounts,
          is_active: true,
          last_error: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', existingConn.id);
    } else {
      await supabaseClient
        .from('tresorerie_qonto_connections')
        .insert({
          organization_id: organizationId,
          access_token_encrypted: 'API_KEY_MODE',
          is_active: true,
          last_sync_at: new Date().toISOString(),
          sync_count: 1,
          bank_accounts: bankAccounts,
          last_error: errors.length > 0 ? errors.join('; ') : null,
        });
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Sync terminée: ${totalImported} importées, ${totalReconciled} rapprochées, ${totalSkipped} ignorées, ${totalReused} réutilisées`);

    return new Response(
      JSON.stringify({
        success: true,
        transactions_fetched: totalImported,
        auto_reconciled: totalReconciled,
        transactions_skipped: totalSkipped,
        revenues_reused: totalReused,
        total_from_qonto: allTransactions.length,
        accounts_count: bankAccountsData.length,
        bank_accounts: bankAccounts,
        total_balance: totalBalance,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: duration,
        batch_id: batchId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur qonto-sync-transactions:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: sanitizeErrorForClient(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Mapping amélioré des catégories avec détection URSSAF dans le libellé
 */
function mapQontoCategoryEnhanced(tx: any): string | null {
  const label = (tx.label || '').toLowerCase();
  const category = tx.category?.toLowerCase() || '';
  
  // PRIORITÉ 1: Détection URSSAF dans le libellé (indépendamment de la catégorie Qonto)
  if (label.includes('urssaf') || label.includes('cotisations sociales')) {
    console.log(`🏛️ URSSAF détecté dans libellé: "${tx.label}"`);
    return 'DEP_URSSAF';
  }
  
  // PRIORITÉ 2: Détection salaires par nom d'employé dans le libellé
  if (detectEmployeeInLabel(label)) {
    console.log(`👤 Salaire détecté dans libellé: "${tx.label}"`);
    return 'DEP_SALAIRES_NETS';
  }
  
  // PRIORITÉ 3: Mapping par catégorie Qonto
  const mapping: Record<string, string> = {
    // Dépenses courantes
    'office_rental': 'DEP_LOYER',
    'office_supplies': 'DEP_FOURNITURES',
    'software': 'DEP_LOGICIELS',
    'insurance': 'DEP_ASSURANCES',
    'telecom': 'DEP_TELECOM',
    'meal': 'DEP_REPAS',
    'bank_fee': 'DEP_FRAIS_BANCAIRES',
    'tax': 'DEP_TVA',
    'transport': 'DEP_DEPLACEMENT',
    'marketing': 'DEP_MARKETING',
    // Charges salariales - CORRIGÉ
    'salary': 'DEP_SALAIRES_NETS',
    'social_contribution': 'DEP_URSSAF', // CORRIGÉ: était DEP_TVA
    // Autres
    'utility': 'DEP_FOURNITURES',
    'subscription': 'DEP_LOGICIELS',
    'professional_services': 'DEP_FRAIS_JURIDIQUES',
    'education': 'DEP_FORMATION',
    'entertainment': 'DEP_DIVERS',
  };

  const mapped = mapping[category];
  if (!mapped && category) {
    console.log(`⚠️ Catégorie Qonto non mappée: ${category}`);
  }
  return mapped || null;
}

/**
 * Détecte si un libellé contient un nom d'employé connu
 */
function detectEmployeeInLabel(label: string): boolean {
  const employeePatterns = [
    'corentin', 'rémi', 'remi', 'jonathan', 'linoa',
    'virement salaire', 'salaire', 'paye', 'paie',
    'vir sepa', 'virement interne'
  ];
  
  return employeePatterns.some(pattern => label.includes(pattern));
}

/**
 * Réconciliation automatique améliorée avec matching employés
 */
async function tryAutoReconciliationEnhanced(
  supabase: any,
  tx: any,
  categorieCode: string | null,
  employeeProfiles: any[]
): Promise<boolean> {
  try {
    const amount = Math.abs(tx.amount);
    const txDate = new Date(tx.emitted_at);
    const label = (tx.label || '').toLowerCase();
    
    // Fenêtre de ±30 jours pour plus de flexibilité
    const thirtyDaysBefore = new Date(txDate);
    thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);
    const thirtyDaysAfter = new Date(txDate);
    thirtyDaysAfter.setDate(thirtyDaysAfter.getDate() + 30);

    // Tolérance ±5% sur le montant
    const amountMin = amount * 0.95;
    const amountMax = amount * 1.05;

    if (tx.side === 'debit') {
      // ========== RÉCONCILIATION SALAIRES RH ==========
      if (categorieCode === 'DEP_SALAIRES_NETS' || detectEmployeeInLabel(label)) {
        // Chercher un match par nom d'employé dans le libellé
        const matchedEmployee = employeeProfiles.find(emp => {
          const prenomLower = (emp.prenom || '').toLowerCase();
          const nomLower = (emp.nom || '').toLowerCase();
          return label.includes(prenomLower) || label.includes(nomLower) ||
                 label.includes(`${prenomLower} ${nomLower}`) ||
                 label.includes(`${nomLower} ${prenomLower}`);
        });

        if (matchedEmployee) {
          console.log(`👤 Employé trouvé dans libellé: ${matchedEmployee.prenom} ${matchedEmployee.nom}`);
          
          // Chercher la dépense RH correspondante
          const { data: depensesRH } = await supabase
            .from('tresorerie_depenses')
            .select('id, nom, montant, source, source_id')
            .eq('source', 'rh_salaires_net')
            .gte('montant', amountMin)
            .lte('montant', amountMax)
            .is('date_paiement_reel', null);

          if (depensesRH && depensesRH.length > 0) {
            // Trouver celle qui correspond à l'employé
            const matchedDepense = depensesRH.find((d: any) => 
              d.nom.toLowerCase().includes(matchedEmployee.prenom.toLowerCase()) ||
              d.nom.toLowerCase().includes(matchedEmployee.nom.toLowerCase())
            );

            if (matchedDepense) {
              await supabase
                .from('tresorerie_operations_bancaires')
                .update({
                  depense_id: matchedDepense.id,
                  reconcilie: true,
                })
                .eq('qonto_transaction_id', tx.transaction_id);

              await supabase
                .from('tresorerie_depenses')
                .update({
                  date_paiement_reel: tx.settled_at || tx.emitted_at,
                  statut: 'paye',
                })
                .eq('id', matchedDepense.id);

              console.log(`✅ Réconciliation salaire: ${tx.label} → ${matchedDepense.nom}`);
              return true;
            }
          }
        }
      }

      // ========== RÉCONCILIATION URSSAF / COTISATIONS ==========
      if (categorieCode === 'DEP_URSSAF' || label.includes('urssaf')) {
        const { data: cotisations } = await supabase
          .from('tresorerie_depenses')
          .select('id, nom, montant')
          .eq('source', 'rh_cotisations')
          .gte('montant', amountMin)
          .lte('montant', amountMax)
          .is('date_paiement_reel', null);

        if (cotisations && cotisations.length > 0) {
          const bestMatch = cotisations[0];
          
          await supabase
            .from('tresorerie_operations_bancaires')
            .update({
              depense_id: bestMatch.id,
              reconcilie: true,
            })
            .eq('qonto_transaction_id', tx.transaction_id);

          await supabase
            .from('tresorerie_depenses')
            .update({
              date_paiement_reel: tx.settled_at || tx.emitted_at,
              statut: 'paye',
            })
            .eq('id', bestMatch.id);

          console.log(`✅ Réconciliation URSSAF: ${tx.label} → ${bestMatch.nom}`);
          return true;
        }
      }

      // ========== RÉCONCILIATION DÉBITS GÉNÉRIQUES ==========
      const { data: depenses } = await supabase
        .from('tresorerie_depenses')
        .select('id, nom, montant')
        .gte('montant', amountMin)
        .lte('montant', amountMax)
        .gte('date_prevue', thirtyDaysBefore.toISOString().split('T')[0])
        .lte('date_prevue', thirtyDaysAfter.toISOString().split('T')[0])
        .is('date_paiement_reel', null);

      if (depenses && depenses.length > 0) {
        let bestMatch = depenses[0];
        if (depenses.length > 1) {
          const labelMatch = depenses.find((d: any) => {
            const depenseLabel = (d.nom || '').toLowerCase();
            return label.includes(depenseLabel) || depenseLabel.includes(label);
          });
          if (labelMatch) bestMatch = labelMatch;
        }

        await supabase
          .from('tresorerie_operations_bancaires')
          .update({
            depense_id: bestMatch.id,
            reconcilie: true,
          })
          .eq('qonto_transaction_id', tx.transaction_id);

        await supabase
          .from('tresorerie_depenses')
          .update({
            date_paiement_reel: tx.settled_at || tx.emitted_at,
            statut: 'paye',
          })
          .eq('id', bestMatch.id);

        console.log(`✅ Réconciliation débit: ${tx.label} → ${bestMatch.nom}`);
        return true;
      }
    } else {
      // ========== RÉCONCILIATION CRÉDITS (Revenus) ==========
      const { data: revenus } = await supabase
        .from('tresorerie_revenus')
        .select('id, libelle, montant, etablissement_id')
        .gte('montant', amountMin)
        .lte('montant', amountMax)
        .gte('date_prevue', thirtyDaysBefore.toISOString().split('T')[0])
        .lte('date_prevue', thirtyDaysAfter.toISOString().split('T')[0])
        .is('date_encaissement_reel', null);

      if (revenus && revenus.length > 0) {
        let bestMatch = revenus[0];
        if (revenus.length > 1) {
          const labelMatch = revenus.find((r: any) => {
            const revenuLabel = (r.libelle || '').toLowerCase();
            return label.includes(revenuLabel) || revenuLabel.includes(label);
          });
          if (labelMatch) bestMatch = labelMatch;
        }

        await supabase
          .from('tresorerie_operations_bancaires')
          .update({
            revenu_id: bestMatch.id,
            reconcilie: true,
          })
          .eq('qonto_transaction_id', tx.transaction_id);

        await supabase
          .from('tresorerie_revenus')
          .update({
            date_encaissement_reel: tx.settled_at || tx.emitted_at,
            statut: 'encaisse',
          })
          .eq('id', bestMatch.id);

        console.log(`✅ Réconciliation crédit: ${tx.label} → ${bestMatch.libelle}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Erreur réconciliation auto:', error);
    return false;
  }
}
