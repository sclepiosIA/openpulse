import { useMemo } from 'react';
import type { SimulationParams, AnalyticsParams, AnalyticsResults } from '@/types/simulator';

interface UseAnalyticsCalculatorProps {
  params: SimulationParams;
  analyticsParams: AnalyticsParams;
}

/**
 * Hook de calcul du module Analytics (données mensuelles → projections annuelles)
 */
export function useAnalyticsCalculator({ params, analyticsParams }: UseAnalyticsCalculatorProps): AnalyticsResults {
  return useMemo(() => {
    const {
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

    const { uhcdMois, consultMois, plusMois, totalProj } = analyticsParams;

    // ============ MENSUEL VERS ANNUEL ============

    const uhcdAn = uhcdMois * 12;
    const consultAn = consultMois * 12;
    const uhcdMarqueAn = plusMois * 12;
    const totalPassagesInit = (uhcdMois + consultMois) * 12;

    // ============ TAUX UHCD ============

    const totalMois = uhcdMois + consultMois;
    const pctUhcd = totalMois > 0 ? (uhcdMois / totalMois) * 100 : 0;
    const pctUhcdPlus = totalMois > 0 ? ((uhcdMois + plusMois) / totalMois) * 100 : 0;

    // ============ AVEC OPENPULSE ============

    const uhcdPlusTotal = uhcdAn + uhcdMarqueAn;
    const consultAnPlus = Math.max(0, consultAn - uhcdMarqueAn);

    // ============ REVENUS BASELINE ============

    const consultExtBase = consultAn;
    const avisBase = consultExtBase * (taux_avis_baseline / 100);
    const ccmu2Base = consultExtBase * (taux_ccmu2_baseline / 100);
    const ccmu3Base = consultExtBase * (taux_ccmu3_baseline / 100);

    const revUhcdBase = uhcdAn * TARIF_UHCD;
    const revAvisBase = avisBase * TARIF_AVIS_SPE;
    const revCcmu2Base = ccmu2Base * TARIF_CCMU2;
    const revCcmu3Base = ccmu3Base * TARIF_CCMU3;
    const revTotalBase = revUhcdBase + revAvisBase + revCcmu2Base + revCcmu3Base;

    // ============ REVENUS AVEC OPENPULSE ============

    const consultExtPlus = consultAnPlus;
    const avisPlus = consultExtPlus * (taux_avis_cible / 100);
    const ccmu2Plus = consultExtPlus * (taux_ccmu2_cible / 100);
    const ccmu3Plus = consultExtPlus * (taux_ccmu3_cible / 100);

    const revUhcdPlus = uhcdPlusTotal * TARIF_UHCD;
    const revAvisPlus = avisPlus * TARIF_AVIS_SPE;
    const revCcmu2Plus = ccmu2Plus * TARIF_CCMU2;
    const revCcmu3Plus = ccmu3Plus * TARIF_CCMU3;

    // Bonus mono-RUM (5% sur les UHCD avec OpenPulse)
    const gainMonoRUM = BONUS_MONORUM * revUhcdPlus;

    const revTotalPlus = revUhcdPlus + revAvisPlus + revCcmu2Plus + revCcmu3Plus + gainMonoRUM;

    // ============ ROI EN POURCENTAGE ============

    const roiAnUhcdPct = revUhcdBase > 0 ? ((revUhcdPlus - revUhcdBase) / revUhcdBase) * 100 : 0;
    const roiAnTotalPct = revTotalBase > 0 ? ((revTotalPlus - revTotalBase) / revTotalBase) * 100 : 0;

    // ============ PROJECTIONS SCALÉES ============

    const scale = totalPassagesInit > 0 ? totalProj / totalPassagesInit : 1;
    const uhcdProj = Math.round(uhcdAn * scale);
    const uhcdPlusProj = Math.round(uhcdPlusTotal * scale);

    return {
      uhcdAn,
      consultAn,
      uhcdMarqueAn,
      totalPassagesInit,
      pctUhcd,
      pctUhcdPlus,
      uhcdPlusTotal,
      consultAnPlus,
      revUhcdBase,
      revAvisBase,
      revCcmu2Base,
      revCcmu3Base,
      revTotalBase,
      revUhcdPlus,
      revAvisPlus,
      revCcmu2Plus,
      revCcmu3Plus,
      gainMonoRUM,
      revTotalPlus,
      roiAnUhcdPct,
      roiAnTotalPct,
      scale,
      uhcdProj,
      uhcdPlusProj,
    };
  }, [params, analyticsParams]);
}
