import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAttendeeSearch } from './useAttendeeSearch';

const { ROWS, FLAGS, mockFrom } = vi.hoisted(() => {
  const ROWS = {
    profiles: [
      { id: 'p1', email: 'alice@example.com', prenom: 'Alice', nom: 'Smith', actif: true, fonction: 'Engineer' },
    ],
    contacts: [
      { id: 'c1', email: 'contact@example.com', prenom: 'Bob', nom: 'Jones', etablissement_id: 'e1', groupe_id: 'g1', fonction: 'Mgr' },
    ],
    etablissements: [{ id: 'e1', nom: 'Etab1' }],
    groupes_etablissements: [{ id: 'g1', nom: 'Group1' }],
  };

  const FLAGS = { throwError: false };

  const mockFrom = (table: string) => {
    const state = { table };
    const builder: any = {
      select() { return builder; },
      eq() { return builder; },
      or() { return builder; },
      limit() { return builder; },
      not() { return builder; },
      in() { return builder; },
      order() { return builder; },
      insert() { return builder; },
      update() { return builder; },
      delete() { return builder; },
      single() { return builder; },
      maybeSingle() { return builder; },
      then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason?: unknown) => unknown) {
        if (FLAGS.throwError) {
          const err = new Error('x');
          if (onRejected) {
            try {
              return Promise.resolve(onRejected(err));
            } catch (e) {
              return Promise.reject(e);
            }
          }
          return Promise.reject(err);
        }
        let data: unknown[] = [];
        switch (state.table) {
          case 'profiles':
            data = ROWS.profiles;
            break;
          case 'contacts':
            data = ROWS.contacts;
            break;
          case 'etablissements':
            data = ROWS.etablissements;
            break;
          case 'groupes_etablissements':
            data = ROWS.groupes_etablissements;
            break;
          default:
            data = [];
        }
        const payload = { data };
        if (onFulfilled) {
          try {
            return Promise.resolve(onFulfilled(payload));
          } catch (e) {
            if (onRejected) return Promise.resolve(onRejected(e));
            return Promise.reject(e);
          }
        }
        return Promise.resolve(payload);
      },
      catch(onRejected?: (reason?: unknown) => unknown) {
        if (FLAGS.throwError) {
          return Promise.resolve(onRejected?.(new Error('x')));
        }
        return builder;
      },
    };
    return builder;
  };

  return { ROWS, FLAGS, mockFrom };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: (val: unknown) => (typeof val === 'string' ? val.trim() : ''),
  buildIlikeOrFilter: (fields: string[], sanitized: string) => `ilike(${fields.join(',')},${sanitized})`,
}));

afterEach(() => {
  FLAGS.throwError = false;
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAttendeeSearch', () => {
  it('loads and returns results (loading → success)', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAttendeeSearch('Al'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const data = result.current.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data?.length).toBeGreaterThanOrEqual(2);

    const profileItem = data?.find((d) => d.type === 'profile');
    expect(profileItem?.email).toBe('alice@example.com');
    expect(profileItem?.displayName).toBe('Alice Smith');
    expect(profileItem?.userId).toBe('p1');
    expect(profileItem?.fonction).toBe('Engineer');

    const contactItem = data?.find((d) => d.type === 'contact');
    expect(contactItem?.email).toBe('contact@example.com');
    expect(contactItem?.displayName).toBe('Bob Jones');
    expect(contactItem?.etablissement).toBe('Etab1');
    expect(contactItem?.groupe).toBe('Group1');
    expect(contactItem?.fonction).toBe('Mgr');
  });

  it('handles error state when the query fails', async () => {
    FLAGS.throwError = true;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAttendeeSearch('Al'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    const err = result.current.error as unknown as { message?: string };
    expect(err?.message).toBe('x');
  });
});