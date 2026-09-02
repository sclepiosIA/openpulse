import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { useQuoteCalculator } from './useQuoteCalculator';
import { PALIER_CONFIG } from '@/lib/simulator-config';

const { STABLE_AUTH } = vi.hoisted(() => ({
  STABLE_AUTH: {
    user: { id: 'u1', email: 'test@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useQuoteCalculator', () => {
  const params = {
    passages: 10000,
    baseline: 20,
    taux_mono: 50,
    taux_avis_baseline: 10,
    taux_avis_cible: 20,
    taux_ccmu2_baseline: 30,
    taux_ccmu2_cible: 25,
    taux_ccmu3_baseline: 15,
    taux_ccmu3_cible: 10,
    TARIF_UHCD: 100,
    TARIF_AVIS_SPE: 50,
    TARIF_CCMU2: 30,
    TARIF_CCMU3: 20,
    BONUS_MONORUM: 0.05,
  };

  const configuration = {
    centerType: {
      multiplicateurFrais: 2,
      prixPAU: 3,
    },
    dpiType: {
      baseFrais: 1000,
    },
    resellerType: {
      markup: 0.1,
    },
  };

  it('retourne null quand la configuration est absente', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useQuoteCalculator({ params, configuration: null }),
      { wrapper },
    );

    expect(result.current).toBeNull();
  });

  it('calcule correctement les valeurs métier et tous les paliers', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useQuoteCalculator({ params, configuration }),
      { wrapper },
    );

    expect(result.current).not.toBeNull();

    if (!result.current) {
      throw new Error('Expected quote results');
    }

    expect(result.current.configuration).toBe(configuration);
    expect(result.current.passagesAnnuels).toBe(10000);
    expect(result.current.uhcdActuels).toBe(2000);
    expect(result.current.uhcdMonoRum).toBe(1000);
    expect(result.current.tauxUhcdMonoRumSurTotal).toBe(10);
    expect(result.current.gainUhcdBaseline).toBe(200000);
    expect(result.current.gainAvisBaseline).toBe(40000);
    expect(result.current.gainCcmu2Baseline).toBe(72000);
    expect(result.current.gainCcmu3Baseline).toBe(24000);
    expect(result.current.paliers).toHaveLength(PALIER_CONFIG.length);

    const firstConfig = PALIER_CONFIG[0];
    const firstPalier = result.current.paliers[0];

    const expectedAugmentation = firstConfig.augmentationMonoRum;
    const expectedNouveauTaux = 10 + expectedAugmentation;
    const expectedUhcdMonoRumObjectif = Math.round(10000 * (expectedNouveauTaux / 100));
    const expectedUhcdSupplementaires = Math.round(10000 * (expectedAugmentation / 100));
    const expectedUhcdObjectif = 2000 + Math.round(expectedUhcdSupplementaires / 0.5);
    const expectedTauxObjectif = (expectedUhcdObjectif / 10000) * 100;

    const expectedFraisAcces = 1000 * 2;
    const expectedPauAnnuel = 10000 * 3;
    const expectedPrixSolution = expectedPauAnnuel * firstConfig.multiplicateur;
    const expectedCoutTotal = expectedFraisAcces + expectedPrixSolution;
    const expectedFraisAccesRevendeur = expectedFraisAcces * 1.1;
    const expectedPrixSolutionRevendeur = expectedPrixSolution * 1.1;
    const expectedCoutTotalRevendeur = expectedCoutTotal * 1.1;

    const consultExtTarget = 10000 - expectedUhcdObjectif;
    const avisTarget = consultExtTarget * 0.2;
    const ccmu2Target = consultExtTarget * 0.25;
    const ccmu3Target = consultExtTarget * 0.1;

    const gainUhcdTarget = expectedUhcdObjectif * 100;
    const gainAvisTarget = avisTarget * 50;
    const gainCcmu2Target = ccmu2Target * 30;
    const gainCcmu3Target = ccmu3Target * 20;
    const uhcdMonoRumTarget = expectedUhcdObjectif * 0.5;
    const gainMonoUhcdBonusTarget = 0.05 * (uhcdMonoRumTarget * 100);

    const expectedRoiUhcd = gainUhcdTarget - 200000;
    const expectedRoiAvisSpec = gainAvisTarget - 40000;
    const expectedRoiCcmu2 = gainCcmu2Target - 72000;
    const expectedRoiCcmu3 = gainCcmu3Target - 24000;
    const expectedRoiTotal =
      expectedRoiUhcd +
      expectedRoiAvisSpec +
      expectedRoiCcmu2 +
      expectedRoiCcmu3 +
      gainMonoUhcdBonusTarget;
    const expectedRoiNet = expectedRoiTotal - expectedCoutTotalRevendeur;
    const expectedRoiPourcentage = (expectedRoiNet / expectedCoutTotalRevendeur) * 100;

    expect(firstPalier.palier).toBe(firstConfig.palier);
    expect(firstPalier.description).toBe(firstConfig.description);
    expect(firstPalier.multiplicateur).toBe(firstConfig.multiplicateur);
    expect(firstPalier.nouveauTauxMonoRumSurTotal).toBe(expectedNouveauTaux);
    expect(firstPalier.uhcdMonoRumObjectif).toBe(expectedUhcdMonoRumObjectif);
    expect(firstPalier.uhcdSupplementaires).toBe(expectedUhcdSupplementaires);
    expect(firstPalier.uhcdObjectif).toBe(expectedUhcdObjectif);
    expect(firstPalier.tauxObjectif).toBe(expectedTauxObjectif);

    expect(firstPalier.fraisAcces).toBe(expectedFraisAcces);
    expect(firstPalier.prixSolution).toBe(expectedPrixSolution);
    expect(firstPalier.coutTotal).toBe(expectedCoutTotal);
    expect(firstPalier.fraisAccesRevendeur).toBe(expectedFraisAccesRevendeur);
    expect(firstPalier.prixSolutionRevendeur).toBe(expectedPrixSolutionRevendeur);
    expect(firstPalier.coutTotalRevendeur).toBe(expectedCoutTotalRevendeur);

    expect(firstPalier.roiUhcd).toBe(expectedRoiUhcd);
    expect(firstPalier.roiAvisSpec).toBe(expectedRoiAvisSpec);
    expect(firstPalier.roiCcmu2).toBe(expectedRoiCcmu2);
    expect(firstPalier.roiCcmu3).toBe(expectedRoiCcmu3);
    expect(firstPalier.roiMonoUhcdBonus).toBe(gainMonoUhcdBonusTarget);
    expect(firstPalier.roiTotal).toBe(expectedRoiTotal);
    expect(firstPalier.roiNet).toBe(expectedRoiNet);
    expect(firstPalier.roiPourcentage).toBe(expectedRoiPourcentage);
  });

  it('applique correctement l’absence de revendeur', () => {
    const wrapper = createWrapper();

    const noResellerConfiguration = {
      centerType: {
        multiplicateurFrais: 1.5,
        prixPAU: 2,
      },
      dpiType: {
        baseFrais: 800,
      },
      resellerType: null,
    };

    const { result } = renderHook(
      () => useQuoteCalculator({ params, configuration: noResellerConfiguration }),
      { wrapper },
    );

    expect(result.current).not.toBeNull();

    if (!result.current) {
      throw new Error('Expected quote results');
    }

    const palier = result.current.paliers[0];
    expect(palier.fraisAcces).toBe(1200);
    expect(palier.fraisAccesRevendeur).toBe(1200);
    expect(palier.coutTotalRevendeur).toBe(palier.coutTotal);
    expect(palier.roiNet).toBe(palier.roiTotal - palier.coutTotal);
  });

  it('retourne un roiPourcentage à 0 si le coût final est nul', () => {
    const wrapper = createWrapper();

    const zeroCostConfiguration = {
      centerType: {
        multiplicateurFrais: 0,
        prixPAU: 0,
      },
      dpiType: {
        baseFrais: 0,
      },
      resellerType: null,
    };

    const { result } = renderHook(
      () => useQuoteCalculator({ params, configuration: zeroCostConfiguration }),
      { wrapper },
    );

    expect(result.current).not.toBeNull();

    if (!result.current) {
      throw new Error('Expected quote results');
    }

    for (const palier of result.current.paliers) {
      expect(palier.coutTotal).toBe(0);
      expect(palier.roiPourcentage).toBe(0);
    }
  });
});