import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const {
  setThreads,
  setExistingMappings,
  setSpecificMappings,
  setThreadsError,
  setMappingsError,
  setSpecificError,
  mockFrom,
  isGenericDomainMock,
  isInternalDomainMock,
  extractEmailDomainMock
} = vi.hoisted(() => {
  let THREADS_GET: unknown[] = [];
  let EXISTING_MAPPINGS_GET: unknown[] = [];
  let SPECIFIC_MAPPINGS_GET: unknown[] = [];
  let THREADS_ERROR: unknown = null;
  let MAPPINGS_ERROR: unknown = null;
  let SPECIFIC_ERROR: unknown = null;

  const setThreads = (arr: unknown[]) => {
    THREADS_GET = arr;
    THREADS_ERROR = null;
  };
  const setExistingMappings = (arr: unknown[]) => {
    EXISTING_MAPPINGS_GET = arr;
    MAPPINGS_ERROR = null;
  };
  const setSpecificMappings = (arr: unknown[]) => {
    SPECIFIC_MAPPINGS_GET = arr;
    SPECIFIC_ERROR = null;
  };
  const setThreadsError = (err: unknown) => {
    THREADS_ERROR = err;
  };
  const setMappingsError = (err: unknown) => {
    MAPPINGS_ERROR = err;
  };
  const setSpecificError = (err: unknown) => {
    SPECIFIC_ERROR = err;
  };

  const mockFrom = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'is',
      'eq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
      'single',
      'maybeSingle',
      'catch'
    ];
    for (const m of chainMethods) {
      (builder as Record<string, unknown>)[m] = () => builder;
    }
    (builder as Record<string, unknown>)['then'] = (onFulfilled?: unknown, onRejected?: unknown) => {
      let response: unknown;
      if (table === 'email_threads') {
        response = { data: THREADS_GET, error: THREADS_ERROR };
      } else if (table === 'email_domain_mappings') {
        response = { data: EXISTING_MAPPINGS_GET, error: MAPPINGS_ERROR };
      } else if (table === 'email_specific_mappings') {
        response = { data: SPECIFIC_MAPPINGS_GET, error: SPECIFIC_ERROR };
      } else {
        response = { data: null, error: null };
      }
      // onFulfilled/onRejected are unknown; cast to functions for .then
      return Promise.resolve(response).then(onFulfilled as any, onRejected as any);
    };
    return builder;
  });

  const isGenericDomainMock = vi.fn((d?: string) => {
    if (!d) return false;
    const generic = ['gmail.com', 'yahoo.com', 'hotmail.com'];
    return generic.includes(d.toLowerCase());
  });

  const isInternalDomainMock = vi.fn((d?: string) => {
    if (!d) return false;
    const internals = ['marque.local', 'internal.local'];
    return internals.includes(d.toLowerCase());
  });

  const extractEmailDomainMock = vi.fn((email?: string) => {
    if (!email || typeof email !== 'string') return '';
    const parts = email.split('@');
    return parts[1] ? parts[1].toLowerCase() : '';
  });

  return {
    setThreads,
    setExistingMappings,
    setSpecificMappings,
    setThreadsError,
    setMappingsError,
    setSpecificError,
    mockFrom,
    isGenericDomainMock,
    isInternalDomainMock,
    extractEmailDomainMock
  };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));
vi.mock('@/lib/emailUtils', () => ({ isGenericDomain: isGenericDomainMock }));
vi.mock('@/lib/internalEmailConfig', () => ({
  isInternalDomain: isInternalDomainMock,
  extractEmailDomain: extractEmailDomainMock
}));

import { useUnclassifiedDomains } from './useUnclassifiedDomains';

describe('useUnclassifiedDomains', () => {
  afterEach(() => {
    setThreads([]);
    setExistingMappings([]);
    setSpecificMappings([]);
    setThreadsError(null);
    setMappingsError(null);
    setSpecificError(null);
    vi.clearAllMocks();
  });

  it('initially isLoading then returns domains grouped and sorted by emailCount', async () => {
    const t1 = {
      id: 't1',
      subject: 'Hello t1',
      last_message_date: '2023-01-01',
      email_messages: [
        { from_address: 'alice@external.com', to_addresses: undefined }
      ]
    };
    const t3 = {
      id: 't3',
      subject: 'Follow up t3',
      last_message_date: '2023-01-03',
      email_messages: [
        { from_address: 'dan@external.com', to_addresses: undefined }
      ]
    };
    const t2 = {
      id: 't2',
      subject: 'Internal message',
      last_message_date: '2023-01-02',
      email_messages: [
        {
          from_address: 'sender@marque.local',
          to_addresses: [
            'bob@company.org',
            { email: 'carol@company.org' }
          ]
        }
      ]
    };
    const t4 = {
      id: 't4',
      subject: 'Personal',
      last_message_date: '2023-01-04',
      email_messages: [
        { from_address: 'ann@gmail.com', to_addresses: undefined }
      ]
    };

    setThreads([t1, t2, t3, t4]);
    setExistingMappings([
      { domain: 'ignored.com', is_excluded: true, etablissement_id: null, groupe_id: null, partenaire_id: null, prevent_auto: false }
    ]);
    setSpecificMappings([{ email_address: 'someone@special.com' }]);

    const createWrapper = () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
      return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);
    };

    const { result } = renderHook(() => useUnclassifiedDomains(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(Array.isArray(data)).toBe(true);

    // Expect two domains: external.com and company.org
    const domains = (data as unknown[]).map((d) => (d as { domain: string }).domain);
    expect(domains.includes('external.com')).toBe(true);
    expect(domains.includes('company.org')).toBe(true);
    expect(domains.length).toBe(2);

    const external = (data as unknown[]).find(d => (d as { domain: string }).domain === 'external.com') as unknown as { domain: string; emailCount: number; threadCount: number; exampleThreads: { id: string; from_address: string }[] } | undefined;
    const company = (data as unknown[]).find(d => (d as { domain: string }).domain === 'company.org') as unknown as { domain: string; emailCount: number; threadCount: number; exampleThreads: { id: string; from_address: string }[] } | undefined;

    expect(external).toBeDefined();
    expect(company).toBeDefined();

    expect(external.emailCount).toBe(2);
    expect(external.threadCount).toBe(2);
    const extExampleIds = external.exampleThreads.map(t => t.id).sort();
    expect(extExampleIds).toEqual(['t1', 't3']);

    expect(company.emailCount).toBe(2);
    expect(company.threadCount).toBe(1);
    expect(company.exampleThreads.length).toBeGreaterThanOrEqual(1);
    // First example from company should have from_address equal to the first recipient string
    expect(company.exampleThreads[0].from_address).toBe('bob@company.org');

    // Sorting: first element should have emailCount >= second
    expect((data as { emailCount: number }[])[0].emailCount).toBeGreaterThanOrEqual((data as { emailCount: number }[])[1].emailCount);

    // Ensure generic domain gmail.com was ignored
    expect((data as { domain: string }[]).some(d => d.domain === 'gmail.com')).toBe(false);
  });

  it('propagates errors from supabase when email_threads query fails', async () => {
    setThreadsError({ message: 'threads failed' });

    const createWrapper = () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
      return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);
    };

    const { result } = renderHook(() => useUnclassifiedDomains(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const err = result.current.error;
    expect(err).not.toBeNull();
    // The error should contain the message we set
    expect((err as { message?: string }).message).toBe('threads failed');
  });
});