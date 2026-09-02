/* @vitest-environment jsdom */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisContextualActions } from './useJarvisContextualActions';

const {
  locationState,
  paramsState,
  focusState,
} = vi.hoisted(() => ({
  locationState: { pathname: '/' },
  paramsState: {} as Record<string, string | undefined>,
  focusState: {
    focusContext: {
      etablissement_id: undefined as string | undefined,
      etablissement_name: undefined as string | undefined,
    },
    hasFocus: false,
  },
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useParams: () => paramsState,
}));

vi.mock('./useJarvisFocus', () => ({
  useJarvisFocus: () => focusState,
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

describe('useJarvisContextualActions', () => {
  beforeEach(() => {
    locationState.pathname = '/';
    Object.keys(paramsState).forEach((key) => delete paramsState[key]);
    focusState.focusContext.etablissement_id = undefined;
    focusState.focusContext.etablissement_name = undefined;
    focusState.hasFocus = false;
  });

  it('retourne le contexte général avec seulement les actions globales sur une route inconnue', () => {
    locationState.pathname = '/inconnue';

    const { result } = renderHook(() => useJarvisContextualActions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextLabel).toBe('Général');
    expect(result.current.hasContext).toBe(false);
    expect(result.current.quickActions).toHaveLength(3);
    expect(result.current.quickActions.map((a) => a.id)).toEqual([
      'daily_summary',
      'urgent_tasks',
      'unread_emails',
    ]);
    expect(result.current.quickActions.map((a) => a.priority)).toEqual([1, 2, 3]);
  });

  it('retourne les actions métier de /etablissements fusionnées aux globales, triées et limitées à 6', () => {
    locationState.pathname = '/etablissements';

    const { result } = renderHook(() => useJarvisContextualActions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextLabel).toBe('CRM');
    expect(result.current.hasContext).toBe(true);
    expect(result.current.quickActions).toHaveLength(6);
    expect(result.current.quickActions.map((a) => a.id)).toEqual([
      'pipeline_status',
      'daily_summary',
      'cold_prospects',
      'urgent_tasks',
      'hot_prospects',
      'unread_emails',
    ]);
    expect(result.current.quickActions.find((a) => a.id === 'create_prospect')).toBeUndefined();
    expect(result.current.quickActions[0].label).toBe('État du pipeline');
    expect(result.current.quickActions[0].category).toBe('analysis');
  });

  it('détecte la route dynamique /etablissements/:id et utilise les actions dédiées', () => {
    locationState.pathname = '/etablissements/42';
    paramsState.id = '42';

    const { result } = renderHook(() => useJarvisContextualActions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextLabel).toBe('CRM');
    expect(result.current.hasContext).toBe(true);
    expect(result.current.quickActions).toHaveLength(6);
    expect(result.current.quickActions.map((a) => a.id)).toEqual([
      'etab_summary',
      'daily_summary',
      'etab_tasks',
      'urgent_tasks',
      'etab_emails',
      'unread_emails',
    ]);
    expect(result.current.quickActions.find((a) => a.id === 'schedule_meeting')).toBeUndefined();
    expect(result.current.quickActions[0].prompt).toContain('résumé complet de cet établissement');
  });

  it('ajoute une action de focus prioritaire quand un établissement est en focus avec nom tronqué', () => {
    locationState.pathname = '/emails';
    focusState.hasFocus = true;
    focusState.focusContext.etablissement_id = 'etab-1';
    focusState.focusContext.etablissement_name = 'Etablissement Très Long Nom';
    const expectedName = 'Etablissement T';

    const { result } = renderHook(() => useJarvisContextualActions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextLabel).toBe('Messagerie');
    expect(result.current.hasContext).toBe(true);
    expect(result.current.quickActions).toHaveLength(6);
    expect(result.current.quickActions[0].id).toBe('focus_etab');
    expect(result.current.quickActions[0].priority).toBe(0);
    expect(result.current.quickActions[0].label).toBe(`Focus: ${expectedName}...`);
    expect(result.current.quickActions[0].prompt).toContain('Etablissement Très Long Nom');
    expect(result.current.quickActions.map((a) => a.id)).toEqual([
      'focus_etab',
      'inbox_summary',
      'daily_summary',
      'urgent_replies',
      'urgent_tasks',
      'draft_response',
    ]);
    expect(result.current.quickActions.find((a) => a.id === 'unread_emails')).toBeUndefined();
  });

  it('marque hasContext à true avec un focus même sans actions de route', () => {
    locationState.pathname = '/autre';
    focusState.hasFocus = true;
    focusState.focusContext.etablissement_id = 'etab-2';
    focusState.focusContext.etablissement_name = 'Clinique A';

    const { result } = renderHook(() => useJarvisContextualActions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.contextLabel).toBe('Général');
    expect(result.current.hasContext).toBe(true);
    expect(result.current.quickActions.map((a) => a.id)).toEqual([
      'focus_etab',
      'daily_summary',
      'urgent_tasks',
      'unread_emails',
    ]);
    expect(result.current.quickActions[0].label).toBe('Focus: Clinique A');
  });
});