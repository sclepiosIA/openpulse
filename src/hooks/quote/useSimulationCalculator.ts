import { useMemo } from 'react';
import type { SimulationParams, SimulationResults, LevierRow } from '@/types/simulator';
import { LEVIER_NAMES } from '@/lib/simulator-config';

/**
 * Hook de calcul de simulation selon les formules du cahier des charges
 */
export function useSimulationCalculator(params: SimulationParams): SimulationResults {
  return useMemo(() => {
    const {
      passages,
      baseline,
      cible,
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

    // ============ VOLUMES DE BASE ============

    // UHCD
    const uhcdBaseline = passages * (baseline / 100);
    const uhcdTarget = passages * (cible / 100);
    const uhcdDiff = Math.max(0, uhcdTarget - uhcdBaseline);

    // Mono-RUM
    const monoBaseline = uhcdBaseline * (taux_mono / 100);
    const monoTarget = uhcdTarget * (taux_mono / 100);

    // Consultations externes
    const consultExtBaseline = passages - uhcdBaseline;
    const consultExtTarget = passages - uhcdTarget;

    // ============ VOLUMES PAR LEVIER ============

    // Baseline
    const avisBaseline = consultExtBaseline * (taux_avis_baseline / 100);
    const ccmu2Baseline = consultExtBaseline * (taux_ccmu2_baseline / 100);
    const ccmu3Baseline = consultExtBaseline * (taux_ccmu3_baseline / 100);

    // Cible
    const avisCible = consultExtTarget * (taux_avis_cible / 100);
    const ccmu2Cible = consultExtTarget * (taux_ccmu2_cible / 100);
    const ccmu3Cible = consultExtTarget * (taux_ccmu3_cible / 100);

    // ============ GAINS PAR LEVIER ============

    // Gains baseline
    const gainAvisBaseline = avisBaseline * TARIF_AVIS_SPE;
    const gainCcmu2Baseline = ccmu2Baseline * TARIF_CCMU2;
    const gainCcmu3Baseline = ccmu3Baseline * TARIF_CCMU3;
    const gainUhcdBaseline = uhcdBaseline * TARIF_UHCD;
    const gainMonoUhcdBonusBaseline = 0; // Pas de bonus en situation actuelle

    // Gains cible
    const gainAvisCible = avisCible * TARIF_AVIS_SPE;
    const gainCcmu2Cible = ccmu2Cible * TARIF_CCMU2;
    const gainCcmu3Cible = ccmu3Cible * TARIF_CCMU3;
    const gainUhcdCible = uhcdTarget * TARIF_UHCD;
    const gainMonoUhcdBonusCible = BONUS_MONORUM * (monoTarget * TARIF_UHCD);

    // ============ DIFFÉRENTIELS (ROI) ============

    const gainUhcdDiff = gainUhcdCible - gainUhcdBaseline;
    const gainAvisDiff = gainAvisCible - gainAvisBaseline;
    const gainCcmu2Diff = gainCcmu2Cible - gainCcmu2Baseline;
    const gainCcmu3Diff = gainCcmu3Cible - gainCcmu3Baseline;
    const gainMonoUhcdBonusDiff = gainMonoUhcdBonusCible;

    // ============ LEVIERS DÉTAILLÉS ============

    const leviers: LevierRow[] = [
      {
        levier: LEVIER_NAMES.avis,
        volumeBaseline: Math.round(avisBaseline),
        gainBaseline: gainAvisBaseline,
        volumeTarget: Math.round(avisCible),
        gainTarget: gainAvisCible,
        volumeDiff: Math.round(avisCible - avisBaseline),
        gainDiff: gainAvisDiff,
      },
      {
        levier: LEVIER_NAMES.ccmu2,
        volumeBaseline: Math.round(ccmu2Baseline),
        gainBaseline: gainCcmu2Baseline,
        volumeTarget: Math.round(ccmu2Cible),
        gainTarget: gainCcmu2Cible,
        volumeDiff: Math.round(ccmu2Cible - ccmu2Baseline),
        gainDiff: gainCcmu2Diff,
      },
      {
        levier: LEVIER_NAMES.ccmu3,
        volumeBaseline: Math.round(ccmu3Baseline),
        gainBaseline: gainCcmu3Baseline,
        volumeTarget: Math.round(ccmu3Cible),
        gainTarget: gainCcmu3Cible,
        volumeDiff: Math.round(ccmu3Cible - ccmu3Baseline),
        gainDiff: gainCcmu3Diff,
      },
      {
        levier: LEVIER_NAMES.uhcd,
        volumeBaseline: Math.round(monoBaseline),
        gainBaseline: gainUhcdBaseline,
        volumeTarget: Math.round(monoTarget),
        gainTarget: gainUhcdCible,
        volumeDiff: Math.round(monoTarget - monoBaseline),
        gainDiff: gainUhcdDiff,
      },
      {
        levier: LEVIER_NAMES.bonus,
        volumeBaseline: 0,
        gainBaseline: gainMonoUhcdBonusBaseline,
        volumeTarget: Math.round(monoTarget),
        gainTarget: gainMonoUhcdBonusCible,
        volumeDiff: Math.round(monoTarget),
        gainDiff: gainMonoUhcdBonusDiff,
      },
    ];

    // ============ TOTAUX ============

    const totalGainBaseline = gainAvisBaseline + gainCcmu2Baseline + gainCcmu3Baseline + gainUhcdBaseline + gainMonoUhcdBonusBaseline;
    const totalGainTarget = gainAvisCible + gainCcmu2Cible + gainCcmu3Cible + gainUhcdCible + gainMonoUhcdBonusCible;
    const totalGainDiff = gainAvisDiff + gainCcmu2Diff + gainCcmu3Diff + gainUhcdDiff + gainMonoUhcdBonusDiff;

    // Gain moyen par dossier UHCD supplémentaire
    const gainParDossier = TARIF_UHCD + (BONUS_MONORUM * TARIF_UHCD * taux_mono / 100);

    return {
      uhcdBaseline: Math.round(uhcdBaseline),
      uhcdTarget: Math.round(uhcdTarget),
      uhcdDiff: Math.round(uhcdDiff),
      monoBaseline: Math.round(monoBaseline),
      monoTarget: Math.round(monoTarget),
      consultExtBaseline: Math.round(consultExtBaseline),
      consultExtTarget: Math.round(consultExtTarget),
      leviers,
      totalGainBaseline,
      totalGainTarget,
      totalGainDiff,
      gainParDossier,
    };
  }, [params]);
}
