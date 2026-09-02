import { useMemo } from 'react';
import type {
  SimulationParams,
  QuoteConfiguration,
  QuoteResults,
  ProjectionPalier,
} from '@/types/simulator';
import { PALIER_CONFIG } from '@/lib/simulator-config';

interface UseQuoteCalculatorProps {
  params: SimulationParams;
  configuration: QuoteConfiguration | null;
}

/**
 * Hook de calcul de devis avec les 4 paliers du modèle au succès
 */
export function useQuoteCalculator({ params, configuration }: UseQuoteCalculatorProps): QuoteResults | null {
  return useMemo(() => {
    if (!configuration) return null;

    const {
      passages,
      baseline,
      taux_mono,
      taux_avis_baseline,
      taux_avis_cible,
      taux_ccmu2_baseline,
      taux_ccmu2_cible,
      taux_ccmu3_baseline,
      taux_ccmu3_cible,
      TARIF_UHCD,
      TARIF_AVIS_SPE,
      TARIF_CCMU2,
      TARIF_CCMU3,
      BONUS_MONORUM,
    } = params;

    const { centerType, dpiType, resellerType } = configuration;

    // ============ DONNÉES DE BASE ============

    const passagesAnnuels = passages;
    const uhcdActuels = Math.round(passagesAnnuels * (baseline / 100));
    const uhcdMonoRum = Math.round(uhcdActuels * (taux_mono / 100));
    const tauxUhcdMonoRumSurTotal = (uhcdMonoRum / passagesAnnuels) * 100;

    // Consultations externes baseline
    const consultExtBaseline = passagesAnnuels - uhcdActuels;

    // Volumes et gains baseline
    const avisBaseline = consultExtBaseline * (taux_avis_baseline / 100);
    const ccmu2Baseline = consultExtBaseline * (taux_ccmu2_baseline / 100);
    const ccmu3Baseline = consultExtBaseline * (taux_ccmu3_baseline / 100);

    const gainUhcdBaseline = uhcdActuels * TARIF_UHCD;
    const gainAvisBaseline = avisBaseline * TARIF_AVIS_SPE;
    const gainCcmu2Baseline = ccmu2Baseline * TARIF_CCMU2;
    const gainCcmu3Baseline = ccmu3Baseline * TARIF_CCMU3;

    // ============ CALCUL DES PALIERS ============

    const paliers: ProjectionPalier[] = PALIER_CONFIG.map((palierConfig) => {
      const { palier, description, multiplicateur, augmentationMonoRum } = palierConfig;

      // Nouveau taux mono-RUM sur total
      const nouveauTauxMonoRumSurTotal = tauxUhcdMonoRumSurTotal + augmentationMonoRum;

      // UHCD mono-RUM supplémentaires
      const uhcdMonoRumObjectif = Math.round(passagesAnnuels * (nouveauTauxMonoRumSurTotal / 100));
      const uhcdMonoRumSupplementaires = Math.round(passagesAnnuels * (augmentationMonoRum / 100));
      const uhcdSupplementaires = uhcdMonoRumSupplementaires;

      // UHCD objectif global
      const uhcdObjectif = uhcdActuels + Math.round(uhcdSupplementaires / (taux_mono / 100));
      const tauxObjectif = (uhcdObjectif / passagesAnnuels) * 100;

      // ============ COÛTS ============

      const fraisAcces = dpiType.baseFrais * centerType.multiplicateurFrais;
      const pauAnnuel = passagesAnnuels * centerType.prixPAU;
      const prixSolution = pauAnnuel * multiplicateur;
      const coutTotal = fraisAcces + prixSolution;

      // Avec markup revendeur
      const markupMultiplier = resellerType ? (1 + resellerType.markup) : 1;
      const fraisAccesRevendeur = fraisAcces * markupMultiplier;
      const prixSolutionRevendeur = prixSolution * markupMultiplier;
      const coutTotalRevendeur = coutTotal * markupMultiplier;

      // ============ CALCUL DU ROI ============

      // Consultations externes cible
      const consultExtTarget = passagesAnnuels - uhcdObjectif;

      // Volumes target
      const avisTarget = consultExtTarget * (taux_avis_cible / 100);
      const ccmu2Target = consultExtTarget * (taux_ccmu2_cible / 100);
      const ccmu3Target = consultExtTarget * (taux_ccmu3_cible / 100);

      // Gains target
      const gainUhcdTarget = uhcdObjectif * TARIF_UHCD;
      const gainAvisTarget = avisTarget * TARIF_AVIS_SPE;
      const gainCcmu2Target = ccmu2Target * TARIF_CCMU2;
      const gainCcmu3Target = ccmu3Target * TARIF_CCMU3;

      // Bonus mono-RUM (5% sur tous les UHCD mono-RUM cible)
      const uhcdMonoRumTarget = uhcdObjectif * (taux_mono / 100);
      const gainMonoUhcdBonusTarget = BONUS_MONORUM * (uhcdMonoRumTarget * TARIF_UHCD);

      // ROI par levier
      const roiUhcd = gainUhcdTarget - gainUhcdBaseline;
      const roiAvisSpec = gainAvisTarget - gainAvisBaseline;
      const roiCcmu2 = gainCcmu2Target - gainCcmu2Baseline;
      const roiCcmu3 = gainCcmu3Target - gainCcmu3Baseline;
      const roiMonoUhcdBonus = gainMonoUhcdBonusTarget;

      // ROI total et net
      const roiTotal = roiUhcd + roiAvisSpec + roiCcmu2 + roiCcmu3 + roiMonoUhcdBonus;
      const coutFinal = resellerType ? coutTotalRevendeur : coutTotal;
      const roiNet = roiTotal - coutFinal;
      const roiPourcentage = coutFinal > 0 ? (roiNet / coutFinal) * 100 : 0;

      return {
        palier,
        description,
        tauxObjectif,
        nouveauTauxMonoRumSurTotal,
        uhcdObjectif,
        uhcdSupplementaires,
        uhcdMonoRumObjectif,
        multiplicateur,
        fraisAcces,
        prixSolution,
        coutTotal,
        fraisAccesRevendeur,
        prixSolutionRevendeur,
        coutTotalRevendeur,
        roiTotal,
        roiNet,
        roiPourcentage,
        roiUhcd,
        roiAvisSpec,
        roiCcmu2,
        roiCcmu3,
        roiMonoUhcdBonus,
      };
    });

    return {
      configuration,
      passagesAnnuels,
      uhcdActuels,
      uhcdMonoRum,
      tauxUhcdMonoRumSurTotal,
      paliers,
      gainUhcdBaseline,
      gainAvisBaseline,
      gainCcmu2Baseline,
      gainCcmu3Baseline,
    };
  }, [params, configuration]);
}
