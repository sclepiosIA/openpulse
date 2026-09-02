/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useEmployeeCertifications } from './useEmployeeCertifications';

const {
  EMPLOYEE_ROWS,
  REF_VALIDITY_ROW,
  INSERTED_ROW,
  UPDATED_ROW,
  DELETED_RESPONSE,
  mockFrom,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
} = vi.hoisted(() => {
  const now = new Date();
  const toDateOnly = (d: Date) => d.toISOString().split('T')[0];

  const in10 = new Date(now);
  in10.setDate(in10.getDate() + 10);

  const in40 = new Date(now);
  in40.setDate(in40.getDate() + 40);

  const in120 = new Date(now);
  in120.setDate(in120.getDate() + 120);

  const past5 = new Date(now);
  past5.setDate(past5.getDate() - 5);

  return {
    EMPLOYEE_ROWS: [
      {
        id: 'ec-1',
        profile_id: 'p-1',
        certification_id: 'c-1',
        date_obtention: '2024-01-10',
        date_expiration: toDateOnly(in10),
        statut: 'valide',
        certification: {
          id: 'c-1',
          nom: 'SST',
          description: 'Secourisme',
          organisme: 'INRS',
          duree_validite_mois: 24,
          niveau_difficulte: 'intermediaire',
        },
        profile: {
          id: 'p-1',
          nom: 'Doe',
          prenom: 'Jane',
        },
      },
      {
        id: 'ec-2',
        profile_id: 'p-2',
        certification_id: 'c-2',
        date_obtention: '2024-02-15',
        date_expiration: toDateOnly(in40),
        statut: 'a_renouveler',
        certification: {
          id: 'c-2',
          nom: 'Habilitation',
          description: 'Electrique',
          organisme: 'AFPA',
          duree_validite_mois: 12,
          niveau_difficulte: 'avance',
        },
        profile: {
          id: 'p-2',
          nom: 'Smith',
          prenom: 'John',
        },
      },
      {
        id: 'ec-3',
        profile_id: 'p-1',
        certification_id: 'c-3',
        date_obtention: '2023-01-01',
        date_expiration: toDateOnly(in120),
        statut: 'valide',
        certification: {
          id: 'c-3',
          nom: 'CACES',
          description: 'Engins',
          organisme: 'Centre X',
          duree_validite_mois: 60,
          niveau_difficulte: 'debutant',
        },
        profile: {
          id: 'p-1',
          nom: 'Doe',
          prenom: 'Jane',
        },
      },
      {
        id: 'ec-4',
        profile_id: 'p-3',
        certification_id: 'c-4',
        date_obtention: '2022-05-01',
        date_expiration: toDateOnly(past5),
        statut: 'expiree',
        certification: {
          id: 'c-4',
          nom: 'Incendie',
          description: 'Feu',
          organisme: 'CNPP',
          duree_validite_mois: 36,
          niveau_difficulte: 'intermediaire',
        },
        profile: {
          id: 'p-3',
          nom: 'Lee',
          prenom: 'Ann',
        },
      },
    ],
    REF_VALIDITY_ROW: {
      duree_validite_mois: 12,
    },
    INSERTED_ROW: {
      id: 'ec-new',
      profile_id: 'p-9',
      certification_id: 'c-ref',
      date_obtention: '2024-01-15',
      date_expiration: '2025-01-15',
      statut: 'expiree',
    },
    UPDATED_ROW: {
      id: 'ec-1',
      statut: 'expiree',
    },
    DELETED_RESPONSE: {
      data: null,
      error: null,
    },
    mockFrom: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    sanitizeSupabaseError: vi.fn((error: Error) => `sanitized:${error.message}`),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type DbError = { message: string } | null;

let employeeQueryError: DbError = null;
let referentielMaybeSingleError: DbError = null;
let employeeInsertError: DbError = null;
let employeeUpdateError: DbError = null;
let employeeDeleteError: DbError = null;
let currentEmployeeData = EMPLOYEE_ROWS;
let eqCalls: Array<[string, unknown]> = [];
let lastInsertPayload: unknown;
let lastUpdatePayload: unknown;
let deleteEqId: unknown;

function createBuilder(table: string) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);

      if (table === 'employee_certifications' && column === 'profile_id') {
        currentEmployeeData = currentEmployeeData.filter((row) => row.profile_id === value);
      }

      if (table === 'employee_certifications' && column === 'statut') {
        currentEmployeeData = currentEmployeeData.filter((row) => row.statut === value);
      }

      if (table === 'employee_certifications' && column === 'id' && employeeDeleteError !== null) {
        deleteEqId = value;
      }

      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      lastInsertPayload = payload;
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      lastUpdatePayload = payload;
      return builder;
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => {
      if (table === 'employee_certifications' && employeeInsertError) {
        return { data: null, error: employeeInsertError };
      }
      if (table === 'employee_certifications' && employeeUpdateError) {
        return { data: null, error: employeeUpdateError };
      }
      if (table === 'employee_certifications' && lastUpdatePayload !== undefined) {
        return { data: UPDATED_ROW, error: null };
      }
      if (table === 'employee_certifications' && lastInsertPayload !== undefined) {
        return { data: INSERTED_ROW, error: null };
      }
      return { data: null, error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (referentielMaybeSingleError) {
        return { data: null, error: referentielMaybeSingleError };
      }
      return { data: REF_VALIDITY_ROW, error: null };
    }),
    then: (onFulfilled: (value: { data: unknown; error: DbError }) => unknown) => {
      if (table === 'employee_certifications') {
        if (employeeDeleteError && deleteEqId !== undefined) {
          return Promise.resolve(onFulfilled({ data: null, error: employeeDeleteError }));
        }
        if (employeeQueryError) {
          return Promise.resolve(onFulfilled({ data: null, error: employeeQueryError }));
        }
        return Promise.resolve(onFulfilled({ data: currentEmployeeData, error: null }));
      }

      return Promise.resolve(onFulfilled({ data: null, error: null }));
    },
    catch: vi.fn(),
  };

  return builder;
}

function setupMockFrom() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'employee_certifications') {
      currentEmployeeData = EMPLOYEE_ROWS;
      return createBuilder(table);
    }

    if (table === 'referentiel_certifications') {
      return createBuilder(table);
    }

    return createBuilder(table);
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  employeeQueryError = null;
  referentielMaybeSingleError = null;
  employeeInsertError = null;
  employeeUpdateError = null;
  employeeDeleteError = null;
  currentEmployeeData = EMPLOYEE_ROWS;
  eqCalls = [];
  lastInsertPayload = undefined;
  lastUpdatePayload = undefined;
  deleteEqId = undefined;
  setupMockFrom();
});

describe('useEmployeeCertifications', () => {
  it('charge les certifications et calcule les certifications expirant bientôt', async () => {
    const { result } = renderHook(() => useEmployeeCertifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('employee_certifications');
    expect(result.current.error).toBeNull();
    expect(result.current.employeeCertifications).toHaveLength(4);
    expect(result.current.employeeCertifications.map((c) => c.id)).toEqual(['ec-1', 'ec-2', 'ec-3', 'ec-4']);
    expect(result.current.expiringCertifications.map((c) => c.id)).toEqual(['ec-1', 'ec-2']);
    expect(result.current.employeeCertifications[0]?.certification?.nom).toBe('SST');
    expect(result.current.employeeCertifications[1]?.profile?.prenom).toBe('John');
  });

  it('applique les filtres profileId, statut et expiringInDays', async () => {
    const { result } = renderHook(
      () =>
        useEmployeeCertifications({
          profileId: 'p-1',
          statut: 'valide',
          expiringInDays: 30,
        }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(eqCalls).toContainEqual(['profile_id', 'p-1']);
    expect(eqCalls).toContainEqual(['statut', 'valide']);
    expect(result.current.employeeCertifications).toHaveLength(1);
    expect(result.current.employeeCertifications[0]?.id).toBe('ec-1');
    expect(result.current.employeeCertifications[0]?.profile_id).toBe('p-1');
    expect(result.current.expiringCertifications.map((c) => c.id)).toEqual(['ec-1']);
  });

  it('remonte une erreur de requête', async () => {
    employeeQueryError = { message: 'x' };
    setupMockFrom();

    const { result } = renderHook(() => useEmployeeCertifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('x');
    expect(result.current.employeeCertifications).toEqual([]);
    expect(result.current.expiringCertifications).toEqual([]);
  });

  it('ajoute une certification en calculant date_expiration et statut', async () => {
    const { result } = renderHook(() => useEmployeeCertifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addCertification.mutateAsync({
        profile_id: 'p-9',
        certification_id: 'c-ref',
        date_obtention: '2024-01-15',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('referentiel_certifications');
    expect(mockFrom).toHaveBeenCalledWith('employee_certifications');
    expect(lastInsertPayload).toEqual({
      profile_id: 'p-9',
      certification_id: 'c-ref',
      date_obtention: '2024-01-15',
      date_expiration: '2025-01-15',
      statut: 'expiree',
    });
    expect(toastSuccess).toHaveBeenCalledWith('Certification ajoutée');
  });

  it('met à jour une certification avec les bonnes données', async () => {
    const { result } = renderHook(() => useEmployeeCertifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateCertification.mutateAsync({
        id: 'ec-1',
        statut: 'expiree',
      });
    });

    expect(lastUpdatePayload).toEqual({ statut: 'expiree' });
    expect(eqCalls).toContainEqual(['id', 'ec-1']);
    expect(toastSuccess).toHaveBeenCalledWith('Certification mise à jour');
  });

  it('supprime une certification avec le bon id', async () => {
    const { result } = renderHook(() => useEmployeeCertifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteCertification.mutateAsync('ec-2');
    });

    expect(eqCalls).toContainEqual(['id', 'ec-2']);
    expect(toastSuccess).toHaveBeenCalledWith('Certification supprimée');
  });

  it('gère les erreurs de mutation addCertification via le sanitizer et toast.error', async () => {
    employeeInsertError = { message: 'insert failed' };
    setupMockFrom();

    const { result } = renderHook(() => useEmployeeCertifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.addCertification.mutateAsync({
          profile_id: 'p-9',
          certification_id: 'c-ref',
          date_obtention: '2024-01-15',
        }),
      ).rejects.toBeTruthy();
    });

    expect(sanitizeSupabaseError).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('sanitized:insert failed');
  });
});