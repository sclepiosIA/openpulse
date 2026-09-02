/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  EMPTY_RESULTS,
  type SearchPermissions,
  type SearchResult,
  type SearchResults,
} from './useGlobalSearch.types';

const { STABLE_USER, mockFrom, mockNavigate, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  STABLE_USER: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_USER,
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
    success: mockToastSuccess,
    error: mockToastError,
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

describe('useGlobalSearch.types', () => {
  it('exports EMPTY_RESULTS with all expected keys initialized as empty arrays', () => {
    const expectedKeys: Array<keyof SearchResults> = [
      'etablissements',
      'emails',
      'taches',
      'contacts',
      'groupes',
      'events',
      'pulseMessages',
      'pulseConversations',
      'profiles',
      'documents',
      'todos',
      'rdUserStories',
      'rdProjets',
      'supportTickets',
      'partenaires',
      'factures',
      'devis',
      'contrats',
      'kbArticles',
      'customDashboards',
      'workflows',
      'candidates',
      'jobOffers',
      'forumPosts',
      'socialPosts',
      'produits',
      'notesFrais',
      'avoirs',
      'emailTemplates',
      'emailSequences',
      'bookings',
      'bookingPages',
      'contratTemplates',
      'csmPlaybooks',
      'aiAgents',
      'clientSegments',
      'calendars',
      'absences',
      'revenus',
      'depenses',
      'proactiveAlerts',
      'polls',
      'dashboardNotes',
      'candidateEvaluations',
    ];

    expect(Object.keys(EMPTY_RESULTS).sort()).toEqual([...expectedKeys].sort());

    for (const key of expectedKeys) {
      expect(Array.isArray(EMPTY_RESULTS[key])).toBe(true);
      expect(EMPTY_RESULTS[key]).toHaveLength(0);
    }
  });

  it('supports valid SearchResult, SearchResults and SearchPermissions business shapes', () => {
    const result: SearchResult = {
      id: 'r1',
      type: 'etablissement',
      title: 'Acme',
      subtitle: 'Client',
      badge: 'VIP',
      href: '/etablissements/r1',
      linkedEtablissement: {
        id: 'e1',
        nom: 'Acme HQ',
      },
    };

    const results: SearchResults = {
      ...EMPTY_RESULTS,
      etablissements: [result],
      emails: [
        {
          id: 'm1',
          type: 'email',
          title: 'Relance',
          href: '/emails/m1',
        },
      ],
      candidates: [
        {
          id: 'c1',
          type: 'candidate',
          title: 'Jane Doe',
          href: '/candidates/c1',
        },
      ],
    };

    const permissions: SearchPermissions = {
      canViewAllEtablissements: true,
      canViewAllEmails: false,
      canViewSharedEmails: true,
      canViewRHDocuments: true,
      canViewCalendar: true,
      canViewRD: false,
      canViewAllTickets: true,
      viewScope: 'managed',
    };

    expect(results.etablissements[0].type).toBe('etablissement');
    expect(results.etablissements[0].linkedEtablissement).toEqual({
      id: 'e1',
      nom: 'Acme HQ',
    });
    expect(results.emails[0].href).toBe('/emails/m1');
    expect(results.candidates[0].title).toBe('Jane Doe');
    expect(permissions.viewScope).toBe('managed');
    expect(permissions.canViewSharedEmails).toBe(true);
    expect(permissions.canViewRD).toBe(false);
  });

  it('goes through loading then success with a query using EMPTY_RESULTS as stable business data', async () => {
    const stableResults: SearchResults = {
      ...EMPTY_RESULTS,
      etablissements: [
        {
          id: 'et1',
          type: 'etablissement',
          title: 'Beta Corp',
          subtitle: 'Prospect',
          href: '/etablissements/et1',
          linkedEtablissement: {
            id: 'et1',
            nom: 'Beta Corp',
          },
        },
      ],
      emails: [
        {
          id: 'em1',
          type: 'email',
          title: 'Bienvenue',
          href: '/emails/em1',
        },
      ],
      supportTickets: [
        {
          id: 'tk1',
          type: 'support_ticket',
          title: 'Incident',
          badge: 'open',
          href: '/tickets/tk1',
        },
      ],
    };

    function useSearchResultsQuery() {
      return useQuery({
        queryKey: ['search-results-success'],
        queryFn: async (): Promise<SearchResults> => {
          await Promise.resolve();
          return stableResults;
        },
      });
    }

    const { result } = renderHook(() => useSearchResultsQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(stableResults);
    expect(result.current.data?.etablissements[0].title).toBe('Beta Corp');
    expect(result.current.data?.emails[0].type).toBe('email');
    expect(result.current.data?.supportTickets[0].badge).toBe('open');
    expect(result.current.data?.documents).toHaveLength(0);
  });

  it('goes through loading then error when query returns a business error shape', async () => {
    function useSearchResultsErrorQuery() {
      return useQuery({
        queryKey: ['search-results-error'],
        queryFn: async (): Promise<SearchResults> => {
          const response: { data: null; error: { message: string } } = {
            data: null,
            error: { message: 'x' },
          };

          if (response.error) {
            throw new Error(response.error.message);
          }

          return EMPTY_RESULTS;
        },
      });
    }

    const { result } = renderHook(() => useSearchResultsErrorQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
    expect(result.current.data).toBeUndefined();
  });
});