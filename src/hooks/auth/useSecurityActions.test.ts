import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockFrom, RESULTS, RECORDED_INSERTS } = vi.hoisted(() => {
  const etablissements = [
    { id: 'e1', nom: 'Etablissement 1', ville: 'Ville A', statut: 'ouvert', created_at: '2021-01-01T00:00:00.000Z' }
  ];
  const taches = [
    { id: 't1', titre: 'Tâche 1', statut: 'ouverte', priorite: 'haute', etablissement_id: 'e1', assigned_to: null, created_at: '2021-02-01T00:00:00.000Z' }
  ];
  const contacts = [
    { id: 'c1', nom: 'Nom', prenom: 'Prénom', email: 'contact@example.test', telephone: '0199001234', fonction: 'Directeur', etablissement_id: 'e1', created_at: '2021-03-01T00:00:00.000Z' }
  ];
  const profiles = [{ id: 'p1' }];

  const results: Record<string, { data: unknown[] | null; error: unknown | null }> = {
    profiles: { data: profiles, error: null },
    system_stats: { data: [], error: null },
    etablissements: { data: etablissements, error: null },
    taches: { data: taches, error: null },
    contacts: { data: contacts, error: null }
  };

  const recordedInserts: Array<{ table: string; payload: unknown }> = [];

  const mockFromFn = vi.fn((table: string) => {
    const state: { op?: string; payload?: unknown } = {};
    const builder = {
      select(..._args: unknown[]) {
        state.op = 'select';
        return builder;
      },
      limit(_n: number) {
        if (!state.op) state.op = 'limit';
        return builder;
      },
      insert(payload: unknown) {
        state.op = 'insert';
        state.payload = payload;
        recordedInserts.push({ table, payload });
        return builder;
      },
      update(_payload: unknown) {
        state.op = 'update';
        return builder;
      },
      delete() {
        state.op = 'delete';
        return builder;
      },
      eq() {
        return builder;
      },
      gte() {
        return builder;
      },
      lte() {
        return builder;
      },
      in() {
        return builder;
      },
      order() {
        return builder;
      },
      single() {
        return builder;
      },
      maybeSingle() {
        return builder;
      },
      then(onFulfilled: (res: unknown) => unknown) {
        const tableKey = table;
        const tableResult = results[tableKey];
        const resolved = (() => {
          if (state.op === 'insert') {
            return { data: tableResult ? tableResult.data : null, error: tableResult ? tableResult.error : null };
          }
          return { data: tableResult ? tableResult.data : null, error: tableResult ? tableResult.error : null };
        })();
        return Promise.resolve(resolved).then(onFulfilled);
      },
      catch(onRejected: (err: unknown) => unknown) {
        return Promise.resolve().catch(onRejected);
      }
    };
    return builder;
  });

  return { mockFrom: mockFromFn, RESULTS: results, RECORDED_INSERTS: recordedInserts };
});

vi.mock('@/integrations/supabase/client', () => {
  return { supabase: { from: mockFrom } };
});

import { useAdminDataActions } from './useSecurityActions';

describe('useAdminDataActions', () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 }
      }
    });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = createQueryClient();
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };

  beforeEach(() => {
    mockFrom.mockClear();
    RECORDED_INSERTS.length = 0;
    if (RESULTS.profiles) {
      RESULTS.profiles.error = null;
      RESULTS.profiles.data = RESULTS.profiles.data ?? [];
    }
  });

  it('runSecurityScan - success: tests DB connection, inserts a system_stats metric and returns success', async () => {
    const { result } = renderHook(() => useAdminDataActions(), { wrapper });
    const { runSecurityScan } = result.current;

    await act(async () => {
      const response = await runSecurityScan();
      expect(response).toEqual({ success: true });
    });

    expect(mockFrom).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('system_stats');

    expect(RECORDED_INSERTS.length).toBeGreaterThanOrEqual(1);
    const systemInsert = RECORDED_INSERTS.find((r) => r.table === 'system_stats');
    expect(systemInsert).toBeDefined();
    expect(systemInsert?.payload).toEqual(
      expect.objectContaining({
        metric_name: 'security_scan',
        metric_type: 'event'
      })
    );
    const metricValue = (systemInsert?.payload as Record<string, unknown>)?.metric_value;
    expect(typeof metricValue).toBe('string');
    expect(isNaN(Date.parse(String(metricValue)))).toBe(false);
  });

  it('runSecurityScan - error when initial profiles select returns an error', async () => {
    if (RESULTS.profiles) {
      RESULTS.profiles.error = { message: 'simulated-profile-connection-error' };
      RESULTS.profiles.data = null;
    }

    const { result } = renderHook(() => useAdminDataActions(), { wrapper });
    const { runSecurityScan } = result.current;

    await act(async () => {
      await expect(runSecurityScan()).rejects.toMatchObject({ message: 'simulated-profile-connection-error' });
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    const systemInsert = RECORDED_INSERTS.find((r) => r.table === 'system_stats');
    expect(systemInsert).toBeUndefined();
  });

  it('exportDatabase - returns etablissements, taches, contacts and an exportedAt timestamp', async () => {
    const { result } = renderHook(() => useAdminDataActions(), { wrapper });
    const { exportDatabase } = result.current;

    let exported:
      | {
          etablissements: unknown[];
          taches: unknown[];
          contacts: unknown[];
          exportedAt: string;
        }
      | undefined;

    await act(async () => {
      exported = await exportDatabase();
    });

    expect(exported).toBeDefined();
    if (!exported) return;

    expect(exported.etablissements).toEqual(RESULTS.etablissements.data);
    expect(exported.taches).toEqual(RESULTS.taches.data);
    expect(exported.contacts).toEqual(RESULTS.contacts.data);

    expect(typeof exported.exportedAt).toBe('string');
    expect(isNaN(Date.parse(exported.exportedAt))).toBe(false);

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockFrom).toHaveBeenCalledWith('taches');
    expect(mockFrom).toHaveBeenCalledWith('contacts');
  });
});