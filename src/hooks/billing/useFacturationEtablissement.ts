import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";
import { addMonths, startOfMonth, format, isBefore, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";

export interface TarifsPalliers {
  palier1?: number;
  palier2?: number;
  palier3?: number;
  palier4?: number;
}

export interface EtablissementFacturation {
  etablissement_id: string;
  nom: string;
  ville: string;
  statut: string;
  modele: 'Statique' | 'Succès' | 'Estimation' | 'Non défini';
  type_offre: string | null;
  periodicite: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';
  tarifs_palliers: TarifsPalliers | null;
  pallier_vise: string | null;
  montant_annuel: number;
  montant_periodique: number;
  paiement_initial: number | null;
  modele_statique_succes: number | null;
  nombre_passages: number | null;
  date_signature: string | null;
  date_go_live: string | null;
  prochaine_echeance: Date | null;
  derniere_facture_date: string | null;
  factures_count: number;
}

export interface EcheanceFacturation {
  etablissement: EtablissementFacturation;
  mois: Date;
  montant: number;
  type: 'récurrent' | 'initial';
  libelle: string;
}

// Calcul du montant annuel selon le modèle économique
export function calculateMontantAnnuel(etab: Record<string, unknown>): { montant: number; modele: EtablissementFacturation['modele'] } {
  // 1. Priorité aux tarifs par paliers (modèle Au Succès)
  if (etab.tarifs_palliers && etab.pallier_vise) {
    const palliers = etab.tarifs_palliers as TarifsPalliers;
    const pallierVise = etab.pallier_vise as string;
    const pallierKey = pallierVise.toLowerCase().replace(/\s/g, '') as keyof TarifsPalliers;
    
    // Essayer différentes clés possibles
    const montant = palliers[pallierKey] 
      || palliers[`palier${pallierVise.replace(/\D/g, '')}` as keyof TarifsPalliers]
      || (palliers as Record<string, number>)[pallierVise];
    
    if (montant && typeof montant === 'number') {
      return { montant, modele: 'Succès' };
    }
  }

  // 2. Modèle statique (la valeur peut être string ou number)
  const modeleStatique = etab.modele_statique_succes as string | number | null | undefined;
  if (modeleStatique) {
    const montantStatique = typeof modeleStatique === 'string' 
      ? parseFloat(modeleStatique) 
      : modeleStatique;
    
    if (montantStatique && !isNaN(montantStatique) && montantStatique > 0) {
      return { montant: montantStatique, modele: 'Statique' };
    }
  }

  // 3. Estimation basée sur les passages (2€/passage)
  const passages = etab.nombre_passages_urgences_annuel as number | null | undefined;
  if (passages && passages > 0) {
    return { montant: passages * 2, modele: 'Estimation' };
  }

  return { montant: 0, modele: 'Non défini' };
}

// Calcul du montant périodique selon la périodicité
export function calculateMontantPeriodique(montantAnnuel: number, periodicite: string): number {
  switch (periodicite) {
    case 'mensuel': return montantAnnuel / 12;
    case 'trimestriel': return montantAnnuel / 4;
    case 'semestriel': return montantAnnuel / 2;
    case 'annuel': return montantAnnuel;
    default: return montantAnnuel / 12;
  }
}

// Détermine si un mois donné est une échéance pour l'établissement
function isEcheanceMois(periodicite: string, referenceDate: Date, targetDate: Date): boolean {
  const refMonth = referenceDate.getMonth();
  const targetMonth = targetDate.getMonth();
  
  switch (periodicite) {
    case 'mensuel':
      return true;
    case 'trimestriel':
      return (targetMonth - refMonth) % 3 === 0;
    case 'semestriel':
      return (targetMonth - refMonth) % 6 === 0;
    case 'annuel':
      return targetMonth === refMonth;
    default:
      return true;
  }
}

// Calcule la prochaine échéance
function getNextEcheance(periodicite: string, referenceDate: Date, now: Date): Date {
  let nextDate = startOfMonth(referenceDate);
  
  while (isBefore(nextDate, now) || !isEcheanceMois(periodicite, referenceDate, nextDate)) {
    nextDate = addMonths(nextDate, 1);
  }
  
  return nextDate;
}

export function useFacturationEtablissements() {
  return useQuery({
    queryKey: ['facturation-etablissements'],
    queryFn: async (): Promise<EtablissementFacturation[]> => {
      // Récupérer les établissements en Production ou Contractuel
      const { data: etablissements, error: etabError } = await supabase
        .from('etablissements')
        .select('id, nom, ville, statut, type_offre, periodicite_paiement, tarifs_palliers, pallier_vise, modele_statique_succes, nombre_passages_urgences_annuel, paiement_initial, date_signature, date_go_live')
        .in('statut', ['Production', 'Contractuel', 'Déploiement'])
        .order('nom');

      if (etabError) throw etabError;
      if (!etablissements) return [];

      // Récupérer le compte des factures par établissement
      const { data: facturesCount, error: factError } = await supabase
        .from('factures')
        .select('etablissement_id, created_at')
        .in('etablissement_id', etablissements.map(e => e.id))
        .order('created_at', { ascending: false });

      if (factError) debug.error('Error fetching factures:', factError);

      // Grouper les factures par établissement
      const facturesMap = new Map<string, { count: number; lastDate: string | null }>();
      for (const f of (facturesCount || [])) {
        if (!f.etablissement_id) continue;
        const existing = facturesMap.get(f.etablissement_id);
        if (existing) {
          existing.count++;
        } else {
          facturesMap.set(f.etablissement_id, { count: 1, lastDate: f.created_at });
        }
      }

      const now = new Date();

      return etablissements.map(etab => {
        const { montant: montantAnnuel, modele } = calculateMontantAnnuel(etab);
        const periodicite = (etab.periodicite_paiement || 'mensuel') as EtablissementFacturation['periodicite'];
        const montantPeriodique = calculateMontantPeriodique(montantAnnuel, periodicite);
        
        // Référence pour le calcul des échéances (date de signature ou go-live)
        const referenceDate = etab.date_go_live 
          ? new Date(etab.date_go_live) 
          : etab.date_signature 
            ? new Date(etab.date_signature)
            : new Date();

        const factureInfo = facturesMap.get(etab.id);

        const modeleStatiqueNum = etab.modele_statique_succes 
          ? (typeof etab.modele_statique_succes === 'string' 
              ? parseFloat(etab.modele_statique_succes) 
              : etab.modele_statique_succes)
          : null;

        return {
          etablissement_id: etab.id,
          nom: etab.nom,
          ville: etab.ville,
          statut: etab.statut,
          modele,
          type_offre: etab.type_offre,
          periodicite,
          tarifs_palliers: etab.tarifs_palliers as TarifsPalliers | null,
          pallier_vise: etab.pallier_vise,
          montant_annuel: montantAnnuel,
          montant_periodique: montantPeriodique,
          paiement_initial: etab.paiement_initial,
          modele_statique_succes: modeleStatiqueNum,
          nombre_passages: etab.nombre_passages_urgences_annuel,
          date_signature: etab.date_signature,
          date_go_live: etab.date_go_live,
          prochaine_echeance: getNextEcheance(periodicite, referenceDate, now),
          derniere_facture_date: factureInfo?.lastDate || null,
          factures_count: factureInfo?.count || 0,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook pour obtenir les échéances à venir sur N mois
export function useEcheancesFacturation(moisAvenir: number = 3) {
  const { data: etablissements, isLoading, error } = useFacturationEtablissements();

  const echeances: EcheanceFacturation[] = [];
  const now = new Date();

  if (etablissements) {
    for (let i = 0; i < moisAvenir; i++) {
      const moisCible = addMonths(startOfMonth(now), i);

      for (const etab of etablissements) {
        if (etab.montant_periodique <= 0) continue;

        const referenceDate = etab.date_go_live 
          ? new Date(etab.date_go_live) 
          : etab.date_signature 
            ? new Date(etab.date_signature)
            : new Date();

        // Vérifier si c'est une échéance pour ce mois
        if (isEcheanceMois(etab.periodicite, referenceDate, moisCible)) {
          // Vérifier si une facture a déjà été émise pour ce mois
          const periodeLabel = format(moisCible, 'MMMM yyyy', { locale: fr });
          
          echeances.push({
            etablissement: etab,
            mois: moisCible,
            montant: etab.montant_periodique,
            type: 'récurrent',
            libelle: `Abonnement OpenPulse - ${periodeLabel}`,
          });
        }

        // Paiement initial si c'est le mois de signature et pas encore facturé
        if (etab.paiement_initial && etab.paiement_initial > 0 && etab.date_signature) {
          const signatureDate = new Date(etab.date_signature);
          if (isSameMonth(signatureDate, moisCible) && etab.factures_count === 0) {
            echeances.push({
              etablissement: etab,
              mois: moisCible,
              montant: etab.paiement_initial,
              type: 'initial',
              libelle: 'Paiement initial - Installation',
            });
          }
        }
      }
    }
  }

  // Grouper par mois
  const echeancesParMois = echeances.reduce((acc, e) => {
    const key = format(e.mois, 'yyyy-MM');
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {} as Record<string, EcheanceFacturation[]>);

  return {
    echeances,
    echeancesParMois,
    isLoading,
    error,
    totalMontant: echeances.reduce((sum, e) => sum + e.montant, 0),
  };
}

// Hook pour calculer le modèle économique d'un établissement spécifique
export function useEtablissementModeleEconomique(etablissementId: string | null) {
  return useQuery({
    queryKey: ['etablissement-modele-economique', etablissementId],
    queryFn: async () => {
      if (!etablissementId) return null;

      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom, ville, statut, type_offre, periodicite_paiement, tarifs_palliers, pallier_vise, modele_statique_succes, nombre_passages_urgences_annuel, paiement_initial, date_signature, date_go_live')
        .eq('id', etablissementId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const { montant: montantAnnuel, modele } = calculateMontantAnnuel(data);
      const periodicite = (data.periodicite_paiement || 'mensuel') as EtablissementFacturation['periodicite'];
      const montantPeriodique = calculateMontantPeriodique(montantAnnuel, periodicite);

      return {
        etablissement_id: data.id,
        nom: data.nom,
        modele,
        periodicite,
        montant_annuel: montantAnnuel,
        montant_periodique: montantPeriodique,
        pallier_vise: data.pallier_vise,
        type_offre: data.type_offre,
        tarifs_palliers: data.tarifs_palliers as TarifsPalliers | null,
      };
    },
    enabled: !!etablissementId,
  });
}
