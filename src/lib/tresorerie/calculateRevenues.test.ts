/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import {
  isPaymentMonth,
  calculatePaymentForMonth,
  calculatePeriodicPaymentAmount,
  isInitialPaymentMonth,
  getInitialPayment,
  calculateTotalPaymentForMonth,
  calculateMonthlyRevenues,
  getModeleDetaille,
} from './calculateRevenues';

const { AUTH_STATE, mockFrom, mockNavigate, stableRows, builderFactory } = vi.hoisted(() => {
  const stableRows = [{ id: '1' }];

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      containedBy: vi.fn(() => builder),
      rangeGt: vi.fn(() => builder),
      rangeGte: vi.fn(() => builder),
      rangeLt: vi.fn(() => builder),
      rangeLte: vi.fn(() => builder),
      overlaps: vi.fn(() => builder),
      textSearch: vi.fn(() => builder),
      filter: vi.fn(() => builder),
      match: vi.fn(() => builder),
      not: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      abortSignal: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: stableRows[0], error: null })),
      single: vi.fn(() => Promise.resolve({ data: stableRows[0], error: null })),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      then: (onFulfilled: (value: { data: typeof stableRows; error: null }) => unknown) =>
        Promise.resolve({ data: stableRows, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: stableRows, error: null }).catch(onRejected),
    };
    return builder;
  };

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 'test@example.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => createBuilder()),
    mockNavigate: vi.fn(),
    stableRows,
    builderFactory: createBuilder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function useAsyncValue<T>(factory: () => Promise<T>) {
  const [state, setState] = React.useState<{
    isLoading: boolean;
    isError: boolean;
    data: T | null;
    error: Error | null;
  }>({
    isLoading: true,
    isError: false,
    data: null,
    error: null,
  });

  React.useEffect(() => {
    let active = true;
    factory()
      .then((data) => {
        if (!active) return;
        setState({ isLoading: false, isError: false, data, error: null });
      })
      .catch((error: Error) => {
        if (!active) return;
        setState({ isLoading: false, isError: true, data: null, error });
      });

    return () => {
      active = false;
    };
  }, [factory]);

  return state;
}

function makeEtablissement(
  overrides: Record<string, unknown> = {}
): {
  id: string;
  statut: string;
  date_premier_paiement: string | null;
  date_signature: string | null;
  periodicite_paiement: string | null;
  type_offre: string | null;
  pallier_vise: string | null;
  tarifs_palliers: Record<string, unknown> | null;
  modele_statique_succes: string | null;
  nombre_passages_urgences_annuel: number | null;
  paiement_initial: number | null;
  modele_detaille: string | null;
} {
  return {
    id: 'etab-1',
    statut: 'Production',
    date_premier_paiement: '2024-01-15',
    date_signature: '2023-12-10',
    periodicite_paiement: 'mensuel',
    type_offre: null,
    pallier_vise: null,
    tarifs_palliers: null,
    modele_statique_succes: null,
    nombre_passages_urgences_annuel: null,
    paiement_initial: null,
    modele_detaille: null,
    ...overrides,
  };
}

describe('calculateRevenues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => builderFactory());
  });

  describe('isPaymentMonth', () => {
    it('retourne false sans date de référence', () => {
      const etab = makeEtablissement({
        date_premier_paiement: null,
        date_signature: null,
      });

      expect(isPaymentMonth(etab, new Date('2024-03-01'))).toBe(false);
    });

    it('gère correctement les périodicités mensuelle, bimensuelle, trimestrielle, quadrimestrielle, semestrielle et annuelle', () => {
      const ref = '2024-01-15';

      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'mensuel', date_premier_paiement: ref }), new Date('2024-02-01'))).toBe(true);

      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'bimensuel', date_premier_paiement: ref }), new Date('2024-03-01'))).toBe(true);
      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'bimensuel', date_premier_paiement: ref }), new Date('2024-02-01'))).toBe(false);

      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'trimestriel', date_premier_paiement: ref }), new Date('2024-04-01'))).toBe(true);
      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'trimestriel', date_premier_paiement: ref }), new Date('2024-05-01'))).toBe(false);

      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'quadrimestriel', date_premier_paiement: ref }), new Date('2024-05-01'))).toBe(true);
      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'quadrimestriel', date_premier_paiement: ref }), new Date('2024-06-01'))).toBe(false);

      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'semestriel', date_premier_paiement: ref }), new Date('2024-07-01'))).toBe(true);
      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'semestriel', date_premier_paiement: ref }), new Date('2024-08-01'))).toBe(false);

      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'annuel', date_premier_paiement: ref }), new Date('2025-01-01'))).toBe(true);
      expect(isPaymentMonth(makeEtablissement({ periodicite_paiement: 'annuel', date_premier_paiement: ref }), new Date('2024-02-01'))).toBe(false);
    });

    it('utilise date_signature quand date_premier_paiement est absente', () => {
      const etab = makeEtablissement({
        date_premier_paiement: null,
        date_signature: '2024-02-20',
        periodicite_paiement: 'bimensuel',
      });

      expect(isPaymentMonth(etab, new Date('2024-04-01'))).toBe(true);
      expect(isPaymentMonth(etab, new Date('2024-03-01'))).toBe(false);
    });
  });

  describe('calculatePaymentForMonth / calculatePeriodicPaymentAmount', () => {
    it('retourne 0 si le mois ne correspond pas à la périodicité', () => {
      const etab = makeEtablissement({
        periodicite_paiement: 'trimestriel',
        modele_statique_succes: '1200',
      });

      expect(calculatePaymentForMonth(etab, new Date('2024-02-01'))).toBe(0);
    });

    it('calcule un modèle Au succès avec variantes de clé de palier', () => {
      const etab = makeEtablissement({
        type_offre: 'Au succès',
        pallier_vise: 'Palier 2',
        tarifs_palliers: { pallier_2: 2400 },
        periodicite_paiement: 'trimestriel',
      });

      expect(calculatePaymentForMonth(etab, new Date('2024-04-01'))).toBe(600);
      expect(calculatePeriodicPaymentAmount(etab)).toBe(600);
    });

    it('calcule un modèle statique numérique selon la périodicité', () => {
      const etab = makeEtablissement({
        modele_statique_succes: '1200',
        periodicite_paiement: 'semestriel',
      });

      expect(calculatePaymentForMonth(etab, new Date('2024-07-01'))).toBe(600);
      expect(calculatePeriodicPaymentAmount(etab)).toBe(600);
    });

    it('calcule l’estimation basée sur les passages urgences annuels', () => {
      const etab = makeEtablissement({
        nombre_passages_urgences_annuel: 900,
        periodicite_paiement: 'annuel',
      });

      expect(calculatePaymentForMonth(etab, new Date('2025-01-01'))).toBe(1800);
      expect(calculatePeriodicPaymentAmount(etab)).toBe(1800);
    });

    it('retourne 0 quand aucune source de montant n’est exploitable', () => {
      const etab = makeEtablissement({
        type_offre: 'Au succès',
        pallier_vise: 'Palier X',
        tarifs_palliers: { autre: 1000 },
        modele_statique_succes: 'abc',
        nombre_passages_urgences_annuel: null,
      });

      expect(calculatePaymentForMonth(etab, new Date('2024-02-01'))).toBe(0);
      expect(calculatePeriodicPaymentAmount(etab)).toBe(0);
    });
  });

  describe('paiement initial et total', () => {
    it('détecte le mois du paiement initial et additionne initial + récurrent', () => {
      const etab = makeEtablissement({
        date_signature: '2024-03-12',
        date_premier_paiement: '2024-03-12',
        paiement_initial: 300,
        modele_statique_succes: '1200',
        periodicite_paiement: 'mensuel',
      });

      expect(isInitialPaymentMonth(etab, new Date('2024-03-01'))).toBe(true);
      expect(isInitialPaymentMonth(etab, new Date('2024-04-01'))).toBe(false);
      expect(getInitialPayment(etab, new Date('2024-03-01'))).toBe(300);
      expect(getInitialPayment(etab, new Date('2024-04-01'))).toBe(0);
      expect(calculateTotalPaymentForMonth(etab, new Date('2024-03-01'))).toBe(400);
    });

    it('retourne false/0 sans paiement initial ou sans date de signature', () => {
      const sansPaiement = makeEtablissement({
        paiement_initial: 0,
        date_signature: '2024-03-12',
      });

      const sansSignature = makeEtablissement({
        paiement_initial: 500,
        date_signature: null,
      });

      expect(isInitialPaymentMonth(sansPaiement, new Date('2024-03-01'))).toBe(false);
      expect(isInitialPaymentMonth(sansSignature, new Date('2024-03-01'))).toBe(false);
      expect(getInitialPayment(sansSignature, new Date('2024-03-01'))).toBe(0);
    });
  });

  describe('calculateMonthlyRevenues', () => {
    it('filtre les établissements non en production et retourne les champs métier attendus', () => {
      const mois = new Date('2024-03-01');
      const etablissements = [
        makeEtablissement({
          id: 'prod-1',
          statut: 'Production',
          date_signature: '2024-03-05',
          date_premier_paiement: '2024-03-05',
          paiement_initial: 200,
          modele_statique_succes: '1200',
          modele_detaille: 'Statique Premium',
        }),
        makeEtablissement({
          id: 'prod-2',
          statut: 'Production',
          type_offre: 'Au succès',
          pallier_vise: 'Palier 3',
          tarifs_palliers: { palier3: 3600 },
          periodicite_paiement: 'trimestriel',
          date_premier_paiement: '2024-01-10',
        }),
        makeEtablissement({
          id: 'prospect-1',
          statut: 'Prospect',
          modele_statique_succes: '9999',
        }),
      ];

      const result = calculateMonthlyRevenues(etablissements, mois);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        etablissement_id: 'prod-1',
        mois,
        montant_prevu: 300,
        modele: 'Statique Premium',
        palier: null,
      });
      expect(result[1]).toEqual({
        etablissement_id: 'prod-2',
        mois,
        montant_prevu: 0,
        modele: 'Au succès',
        palier: 'Palier 3',
      });
    });
  });

  describe('getModeleDetaille', () => {
    it('priorise modele_detaille puis déduit le modèle selon le type d’offre', () => {
      expect(
        getModeleDetaille(
          makeEtablissement({
            modele_detaille: 'Modèle custom',
            type_offre: 'Au succès',
            pallier_vise: 'Palier 4',
          })
        )
      ).toBe('Modèle custom');

      expect(
        getModeleDetaille(
          makeEtablissement({
            modele_detaille: null,
            type_offre: 'Au succès',
            pallier_vise: 'Palier 4',
          })
        )
      ).toBe('Succès+4');

      expect(
        getModeleDetaille(
          makeEtablissement({
            modele_detaille: null,
            type_offre: 'Au succès',
            pallier_vise: null,
          })
        )
      ).toBe('Au succès');

      expect(
        getModeleDetaille(
          makeEtablissement({
            modele_detaille: null,
            type_offre: null,
            modele_statique_succes: '1500',
          })
        )
      ).toBe('Statique');

      expect(
        getModeleDetaille(
          makeEtablissement({
            modele_detaille: null,
            type_offre: null,
            modele_statique_succes: null,
          })
        )
      ).toBe('Indéterminé');
    });
  });

  describe('hook wrapper de validation loading/success/error', () => {
    it('passe de isLoading à succès avec des valeurs métier réelles', async () => {
      const wrapper = createWrapper();
      const etab = makeEtablissement({
        date_signature: '2024-03-12',
        date_premier_paiement: '2024-03-12',
        paiement_initial: 300,
        modele_statique_succes: '1200',
        periodicite_paiement: 'mensuel',
      });

      const { result } = renderHook(
        () =>
          useAsyncValue(async () => calculateTotalPaymentForMonth(etab, new Date('2024-03-01'))),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBe(null);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBe(400);
      expect(result.current.error).toBe(null);
    });

    it('passe en erreur quand une réponse de type { data:null, error:{ message } } est rencontrée', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAsyncValue(async () => {
            const response = { data: null, error: { message: 'x' } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBe(null);
      expect(result.current.error?.message).toBe('x');
    });
  });
});