import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, format, startOfMonth } from "date-fns";
import { useQontoTransactions } from "@/hooks/tresorerie/useQontoTransactions";
import { queryPresets } from "@/lib/queryPresets";

export interface PrevisionMensuelle {
  mois: string;
  moisLabel: string;
  revenus: number;
  revenusContractualises: number;
  revenusPipeline: number;
  depenses: number;
  depensesSalaires: number;
  depensesRecurrentes: number;
  fluxTresorerie: number;
  soldePrevu: number;
  probabilite: number;
}

export interface EtablissementPrevision {
  id: string;
  nom: string;
  statut: string;
  dateSignature: string | null;
  datePrevisionnelleSignature: string | null;
  pallierVise: string | null;
  tarifsPalliers: Record<string, number> | null;
  modeleStatiqueSucees: string | null;
  revenuMensuelEstime: number;
  probabilite: number;
  periodicite: string;
}

/** Type strict pour les établissements du prévisionnel */
interface EtabPrevisionData {
  id: string;
  nom: string;
  statut: string;
  date_signature: string | null;
  date_previsionnelle_signature: string | null;
  pallier_vise: string | null;
  tarifs_palliers: Record<string, number> | null;
  modele_statique_succes: string | null;
  periodicite_paiement: string | null;
  type_offre: string | null;
  nombre_passages_urgences_annuel: number | null;
}

/** Type strict pour les salaires */
interface SalaireData {
  salaire_net: number | null;
  cotisations_patronales: number | null;
  mois: string;
}

/** Type strict pour les dépenses récurrentes */
interface DepenseRecurrente {
  montant: number | null;
  categorie_code: string | null;
  nom: string | null;
}

// Probabilités de conversion par statut
const PROBABILITES_STATUT: Record<string, number> = {
  'Prospect': 0.05,
  'Contacté': 0.10,
  'Attente RDV': 0.15,
  'RDV pris': 0.25,
  'Attente post RDV': 0.30,
  'Dans les RDV': 0.35,
  'Etude émise': 0.45,
  'Dans les RDV post EME': 0.55,
  'Négociation': 0.65,
  'Contractualisation': 0.80,
  'Vendu': 0.90,
  'Contractuel': 1.0,
  'Conformité': 1.0,
  'Déploiement': 1.0,
  'Formation': 1.0,
  'Go-Live': 1.0,
  'Production': 1.0,
};

/**
 * Calcule le revenu mensuel estimé pour un établissement
 */
function calculerRevenuMensuel(etab: EtabPrevisionData): number {
  // Priorité 1: Tarifs palliers
  if (etab.tarifs_palliers && etab.pallier_vise) {
    const pallierNum = etab.pallier_vise.match(/\d+/)?.[0];
    if (pallierNum) {
      const keys = [`palier${pallierNum}`, `pallier${pallierNum}`, `palier_${pallierNum}`, `pallier_${pallierNum}`];
      for (const key of keys) {
        if (etab.tarifs_palliers[key]) {
          const tarifAnnuel = Number(etab.tarifs_palliers[key]) || 0;
          const periodicite = etab.periodicite_paiement?.toLowerCase() || 'annuel';
          if (periodicite.includes('mensuel')) return tarifAnnuel;
          if (periodicite.includes('trimestriel')) return tarifAnnuel / 3;
          if (periodicite.includes('semestriel')) return tarifAnnuel / 6;
          return tarifAnnuel / 12;
        }
      }
    }
  }

  // Priorité 2: Modèle statique
  if (etab.modele_statique_succes) {
    const montant = parseFloat(etab.modele_statique_succes);
    if (!isNaN(montant)) {
      const periodicite = etab.periodicite_paiement?.toLowerCase() || 'annuel';
      if (periodicite.includes('mensuel')) return montant;
      if (periodicite.includes('trimestriel')) return montant / 3;
      if (periodicite.includes('semestriel')) return montant / 6;
      return montant / 12;
    }
  }

  // Priorité 3: Estimation basée sur passages urgences
  if (etab.nombre_passages_urgences_annuel) {
    const tarifMoyen = 2;
    return (etab.nombre_passages_urgences_annuel * tarifMoyen) / 12;
  }

  return 0;
}

/**
 * Hook pour calculer les prévisions de trésorerie sur 12 mois.
 * 
 * Agrège les revenus contractualisés (établissements en production),
 * les revenus pipeline (probabilisés par statut commercial), les salaires
 * mensuels moyens et les dépenses récurrentes pour projeter les flux de trésorerie.
 * 
 * @returns {Object} Résultat des prévisions
 * @property {PrevisionMensuelle[]} previsions - Prévisions mensuelles sur 12 mois
 * @property {EtablissementPrevision[]} etablissementsPrevisions - Établissements avec leur contribution
 * @property {boolean} isLoading - Chargement en cours
 * @property {function} refetch - Rafraîchir les données
 * 
 * @example
 * ```tsx
 * function TresorerieChart() {
 *   const { previsions, isLoading } = useTresoreriePrevisionnel();
 *   
 *   if (isLoading) return <Skeleton />;
 *   
 *   return (
 *     <AreaChart data={previsions}>
 *       <Area dataKey="revenus" name="Revenus" />
 *       <Area dataKey="depenses" name="Dépenses" />
 *       <Line dataKey="soldePrevu" name="Solde" />
 *     </AreaChart>
 *   );
 * }
 * ```
 * 
 * @see {@link PrevisionMensuelle} pour la structure des prévisions
 * @see {@link EtablissementPrevision} pour la structure des établissements
 */
export function useTresoreriePrevisionnel() {
  const { connection } = useQontoTransactions({});
  const qontoBalance = connection?.bank_accounts?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

  // Performance: Queries parallèles avec useQueries au lieu de 3 useQuery séquentiels
  const results = useQueries({
    queries: [
      {
        queryKey: ["previsionnel-etablissements"],
        queryFn: async (): Promise<EtabPrevisionData[]> => {
          const { data, error } = await supabase
            .from("etablissements")
            .select(`
              id, nom, statut, date_signature, date_previsionnelle_signature,
              pallier_vise, tarifs_palliers, modele_statique_succes,
              periodicite_paiement, type_offre, nombre_passages_urgences_annuel
            `)
            .not('statut', 'in', '("Bloqué","Refus","Reporté","Suspendu")')
            .limit(500);
          if (error) throw error;
          return (data || []) as EtabPrevisionData[];
        },
        ...queryPresets.standard,
      },
      {
        queryKey: ["previsionnel-salaires"],
        queryFn: async (): Promise<SalaireData[]> => {
          const { data, error } = await supabase
            .from("rh_salaires_mensuels")
            .select("salaire_net, cotisations_patronales, mois")
            .order("mois", { ascending: false })
            .limit(100);
          if (error) throw error;
          return (data || []) as SalaireData[];
        },
        ...queryPresets.standard,
      },
      {
        queryKey: ["previsionnel-depenses-recurrentes"],
        queryFn: async (): Promise<DepenseRecurrente[]> => {
          const { data, error } = await supabase
            .from("tresorerie_depenses")
            .select("montant, categorie_code, nom")
            .eq("est_recurrent", true)
            .neq("source", "rh_salaires_net")
            .neq("source", "rh_cotisations")
            .limit(200);
          if (error) throw error;
          return (data || []) as DepenseRecurrente[];
        },
        ...queryPresets.standard,
      },
    ],
  });

  const [etablissementsQuery, salairesQuery, depensesRecurrentesQuery] = results;
  const etablissements = etablissementsQuery.data || [];
  const salaires = salairesQuery.data || [];
  const depensesRecurrentes = depensesRecurrentesQuery.data || [];

  // Performance: Mémoiser les calculs lourds
  const previsions = useMemo((): PrevisionMensuelle[] => {
    if (etablissements.length === 0) return [];

    // Calculer masse salariale moyenne sur 6 derniers mois
    const moisUniques = [...new Set(salaires.map(s => s.mois))].sort().reverse().slice(0, 6);
    const masseSalarialeMensuelle = moisUniques.length > 0
      ? moisUniques.reduce((total, mois) => {
          const salairesDuMois = salaires.filter(s => s.mois === mois);
          return total + salairesDuMois.reduce((sum, s) => 
            sum + (s.salaire_net || 0) + (s.cotisations_patronales || 0), 0
          );
        }, 0) / moisUniques.length
      : 20000;

    const depensesRecurrentesMensuelles = depensesRecurrentes.reduce(
      (sum, d) => sum + (d.montant || 0), 0
    );

    const result: PrevisionMensuelle[] = [];
    let soldeActuel = qontoBalance > 0 ? qontoBalance : 50000;

    for (let i = 0; i < 12; i++) {
      const moisDate = addMonths(startOfMonth(new Date()), i);
      const moisStr = format(moisDate, "yyyy-MM");
      const moisLabel = format(moisDate, "MMM yyyy");

      let revenusContractualises = 0;
      let revenusPipeline = 0;

      for (const etab of etablissements) {
        const revenuMensuel = calculerRevenuMensuel(etab);
        const probabilite = PROBABILITES_STATUT[etab.statut] || 0;

        if (probabilite >= 1.0) {
          revenusContractualises += revenuMensuel;
        } else if (probabilite > 0) {
          const dateSignaturePrevue = etab.date_previsionnelle_signature 
            ? new Date(etab.date_previsionnelle_signature)
            : null;
          
          if (dateSignaturePrevue && dateSignaturePrevue <= moisDate) {
            revenusPipeline += revenuMensuel * probabilite;
          } else if (!dateSignaturePrevue && i >= 3) {
            revenusPipeline += revenuMensuel * probabilite * 0.5;
          }
        }
      }

      const revenus = revenusContractualises + revenusPipeline;
      const depenses = masseSalarialeMensuelle + depensesRecurrentesMensuelles;
      const fluxTresorerie = revenus - depenses;
      soldeActuel += fluxTresorerie;

      result.push({
        mois: moisStr,
        moisLabel,
        revenus,
        revenusContractualises,
        revenusPipeline,
        depenses,
        depensesSalaires: masseSalarialeMensuelle,
        depensesRecurrentes: depensesRecurrentesMensuelles,
        fluxTresorerie,
        soldePrevu: soldeActuel,
        probabilite: revenus > 0 ? revenusContractualises / revenus : 1,
      });
    }

    return result;
  }, [etablissements, salaires, depensesRecurrentes, qontoBalance]);

  // Performance: Mémoiser les établissements prévisions
  const etablissementsPrevisions = useMemo((): EtablissementPrevision[] => {
    return etablissements
      .map((etab) => ({
        id: etab.id,
        nom: etab.nom,
        statut: etab.statut,
        dateSignature: etab.date_signature,
        datePrevisionnelleSignature: etab.date_previsionnelle_signature,
        pallierVise: etab.pallier_vise,
        tarifsPalliers: etab.tarifs_palliers,
        modeleStatiqueSucees: etab.modele_statique_succes,
        revenuMensuelEstime: calculerRevenuMensuel(etab),
        probabilite: PROBABILITES_STATUT[etab.statut] || 0,
        periodicite: etab.periodicite_paiement || 'Annuel',
      }))
      .filter((e) => e.revenuMensuelEstime > 0)
      .sort((a, b) => b.revenuMensuelEstime * b.probabilite - a.revenuMensuelEstime * a.probabilite);
  }, [etablissements]);

  const isLoading = results.some(r => r.isLoading);

  return {
    previsions,
    etablissementsPrevisions,
    isLoading,
    refetch: () => {
      results.forEach(r => r.refetch());
    },
  };
}
