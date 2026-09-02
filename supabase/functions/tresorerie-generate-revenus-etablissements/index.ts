import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from '../_shared/cors.ts';
import { buildErrorResponse } from '../_shared/error-sanitizer.ts';


interface Etablissement {
  id: string;
  nom: string;
  statut: string;
  type_offre: string | null;
  modele_detaille: string | null;
  periodicite_paiement: string | null;
  date_premier_paiement: string | null;
  date_signature: string | null;
  date_go_live: string | null;
  tarifs_palliers: any;
  pallier_vise: string | null;
  modele_statique_succes: string | null;
  nombre_passages_urgences_annuel: number | null;
  paiement_initial: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('origin')) });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Génération des revenus depuis les établissements...');

    // Récupérer les établissements en Production/Go-Live/Contractuel avec date de premier paiement
    const { data: etablissements, error: fetchError } = await supabaseClient
      .from('etablissements')
      .select('*')
      .in('statut', ['Production', 'Go-Live', 'Contractuel'])
      .not('date_premier_paiement', 'is', null);

    if (fetchError) {
      throw fetchError;
    }

    if (!etablissements || etablissements.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Aucun établissement avec date de premier paiement',
          count: 0 
        }),
        { headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      );
    }

    const created = [];
    const errors = [];
    const now = new Date();

    // Générer 12 mois de revenus pour chaque établissement
    for (const etab of etablissements as Etablissement[]) {
      try {
        const dateRef = new Date(etab.date_premier_paiement!);
        
        // Calculer le montant unitaire et déterminer le type de revenu
        const { montantUnitaire, typeRevenu, sourceModele, sourcePallier } = calculerMontantEtType(etab);
        
        if (montantUnitaire === 0) {
          console.warn(`Établissement ${etab.nom}: montant nul, ignoré`);
          continue;
        }

        // Générer les revenus pour les 12 prochains mois
        for (let i = 0; i < 12; i++) {
          const mois = new Date(dateRef);
          mois.setMonth(mois.getMonth() + i);

          // Vérifier si c'est un mois de paiement selon la périodicité
          if (!estMoisDePaiement(etab, mois, dateRef)) {
            continue;
          }

          // Format complet YYYY-MM-DD pour la colonne mois de type date
          const moisStr = `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, '0')}-01`;
          const statut = mois < now ? 'a_facturer' : 'contractualise';

          // Vérifier si ce revenu existe déjà
          const { data: existingRevenu } = await supabaseClient
            .from('tresorerie_revenus')
            .select('id')
            .eq('etablissement_id', etab.id)
            .eq('mois', moisStr)
            .single();

          if (!existingRevenu) {
            const { error: insertError } = await supabaseClient
              .from('tresorerie_revenus')
              .insert({
                etablissement_id: etab.id,
                mois: moisStr,
                montant_prevu: montantUnitaire,
                statut,
                type_revenu: typeRevenu,
                source_modele: sourceModele,
                source_periodicite: etab.periodicite_paiement || 'mensuel',
                source_pallier: sourcePallier,
                notes: `Revenu ${sourceModele} - ${etab.nom}`,
              });

            if (insertError) {
              console.error(`Erreur insertion revenu ${etab.nom} ${moisStr}:`, insertError);
              errors.push({ etablissement: etab.nom, mois: moisStr, error: insertError.message });
            } else {
              created.push({ etablissement: etab.nom, mois: moisStr, montant: montantUnitaire });
            }
          }
        }

        // Gérer le paiement initial si applicable
        if (etab.paiement_initial && etab.paiement_initial > 0 && etab.date_signature) {
          const moisSignature = etab.date_signature.substring(0, 7);
          const { data: existingInitial } = await supabaseClient
            .from('tresorerie_revenus')
            .select('id')
            .eq('etablissement_id', etab.id)
            .eq('mois', moisSignature)
            .eq('type_revenu', 'ponctuel')
            .single();

          if (!existingInitial) {
            await supabaseClient
              .from('tresorerie_revenus')
              .insert({
                etablissement_id: etab.id,
                mois: `${moisSignature}-01`,
                montant_prevu: etab.paiement_initial,
                statut: new Date(etab.date_signature) < now ? 'a_facturer' : 'contractualise',
                type_revenu: 'paiement_initial',
                source_modele: 'ponctuel',
                notes: `Paiement initial - ${etab.nom}`,
              });
          }
        }

      } catch (etabError) {
        console.error(`Erreur traitement établissement ${etab.nom}:`, etabError);
        errors.push({ etablissement: etab.nom, error: String(etabError) });
      }
    }

    console.log(`Génération terminée: ${created.length} revenus créés`);

    return new Response(
      JSON.stringify({ 
        message: 'Revenus générés avec succès',
        created: created.length,
        errors: errors.length,
        details: {
          created,
          errors
        }
      }),
      { headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('tresorerie-generate-revenus-etablissements', error, getCorsHeaders(req.headers.get('origin')), 500);
  }

});

/**
 * Calcule le montant unitaire et détermine le type de revenu selon le modèle
 */
function calculerMontantEtType(etab: Etablissement): {
  montantUnitaire: number;
  typeRevenu: string;
  sourceModele: string;
  sourcePallier: string | null;
} {
  const periodicite = etab.periodicite_paiement || 'annuel';

  // 1. Modèle "Au succès" avec palliers
  if (etab.type_offre === 'Au succès' && etab.pallier_vise && etab.tarifs_palliers) {
    const palNum = String(etab.pallier_vise).toLowerCase().match(/\d+/)?.[0];
    if (palNum) {
      const candidates = [`palier${palNum}`, `pallier${palNum}`, `palier_${palNum}`, `pallier_${palNum}`];
      const keys = Object.keys(etab.tarifs_palliers || {});
      const foundKey = keys.find(k => candidates.includes(String(k).toLowerCase()));
      if (foundKey) {
        const tarifAnnuel = Number(etab.tarifs_palliers[foundKey]);
        const montantUnitaire = calculerMontantPeriodique(tarifAnnuel, periodicite);
        const typeRevenu = determinerTypeRevenu('succes', etab.modele_detaille, periodicite);
        return {
          montantUnitaire,
          typeRevenu,
          sourceModele: 'succes',
          sourcePallier: etab.pallier_vise
        };
      }
    }
  }

  // 2. Modèle statique numérique
  if (etab.modele_statique_succes && /^[0-9]+\.?[0-9]*$/.test(String(etab.modele_statique_succes))) {
    const montantAnnuel = Number(etab.modele_statique_succes);
    const montantUnitaire = calculerMontantPeriodique(montantAnnuel, periodicite);
    const typeRevenu = determinerTypeRevenu('statique', null, periodicite);
    return {
      montantUnitaire,
      typeRevenu,
      sourceModele: 'statique',
      sourcePallier: null
    };
  }

  // 3. Estimation 2€/passage
  if (etab.nombre_passages_urgences_annuel) {
    const montantAnnuel = etab.nombre_passages_urgences_annuel * 2;
    const montantUnitaire = calculerMontantPeriodique(montantAnnuel, periodicite);
    const typeRevenu = determinerTypeRevenu('succes', null, periodicite);
    return {
      montantUnitaire,
      typeRevenu,
      sourceModele: 'succes',
      sourcePallier: null
    };
  }

  return {
    montantUnitaire: 0,
    typeRevenu: 'succes_mensuel',
    sourceModele: 'inconnu',
    sourcePallier: null
  };
}

/**
 * Calcule le montant périodique à partir d'un montant annuel
 */
function calculerMontantPeriodique(montantAnnuel: number, periodicite: string): number {
  switch (periodicite) {
    case 'mensuel':
      return montantAnnuel / 12;
    case 'trimestriel':
      return montantAnnuel / 4;
    case 'annuel':
      return montantAnnuel;
    default:
      return montantAnnuel / 12;
  }
}

/**
 * Détermine le type de revenu selon le modèle et la périodicité
 */
function determinerTypeRevenu(sourceModele: string, modeleDetaille: string | null, periodicite: string): string {
  // Les seules valeurs valides selon la contrainte CHECK de la table :
  // 'abonnement_mensuel', 'paiement_initial', 'etude_medico_eco', 'autre'
  
  if (sourceModele === 'ponctuel') {
    return 'paiement_initial';
  }
  
  // Pour tous les modèles récurrents (succes, statique), utiliser abonnement_mensuel
  return 'abonnement_mensuel';
}

/**
 * Vérifie si un mois donné est un mois de paiement selon la périodicité
 */
function estMoisDePaiement(etab: Etablissement, mois: Date, dateRef: Date): boolean {
  const periodicite = etab.periodicite_paiement || 'mensuel';
  
  if (periodicite === 'mensuel') {
    return true;
  } else if (periodicite === 'trimestriel') {
    const moisDiff = (mois.getFullYear() - dateRef.getFullYear()) * 12 + (mois.getMonth() - dateRef.getMonth());
    return moisDiff % 3 === 0;
  } else if (periodicite === 'annuel') {
    return mois.getMonth() === dateRef.getMonth();
  }
  
  return false;
}
