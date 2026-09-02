// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useJarvisContextualSuggestions } from './useJarvisContextualSuggestions';

const {
  PAGE_CONTEXT_READY,
  PAGE_CONTEXT_LOADING,
  PAGE_CONTEXT_NO_ENTITY,
  mockUseJarvisPageContext,
} = vi.hoisted(() => ({
  PAGE_CONTEXT_READY: {
    pageType: 'detail',
    module: 'etablissements',
    primaryEntity: { id: 'etab-1', name: 'Acme Campus' },
    isLoading: false,
  },
  PAGE_CONTEXT_LOADING: {
    pageType: 'list',
    module: 'emails',
    primaryEntity: undefined,
    isLoading: true,
  },
  PAGE_CONTEXT_NO_ENTITY: {
    pageType: 'detail',
    module: 'etablissements',
    primaryEntity: undefined,
    isLoading: false,
  },
  mockUseJarvisPageContext: vi.fn(),
}));

vi.mock('./useJarvisPageContext', () => ({
  useJarvisPageContext: mockUseJarvisPageContext,
}));

function createWrapper(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(MemoryRouter, { initialEntries }, children)
    );
  };
}

describe('useJarvisContextualSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJarvisPageContext.mockReturnValue(PAGE_CONTEXT_READY);
  });

  it('retourne les suggestions contextualisées pour une fiche établissement avec le nom de l’entité', () => {
    const wrapper = createWrapper(['/etablissements/abc-123']);

    const { result } = renderHook(() => useJarvisContextualSuggestions(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.pageType).toBe('detail');
    expect(result.current.module).toBe('etablissements');
    expect(result.current.entityName).toBe('Acme Campus');
    expect(result.current.entityId).toBe('etab-1');

    expect(result.current.suggestions).toHaveLength(5);
    expect(result.current.suggestions[0]).toEqual({
      id: 'resume-etablissement',
      label: 'Résumer cet établissement',
      command: 'Résume l\'établissement "Acme Campus" avec son historique, ses contacts et sa santé client',
      icon: 'summary',
      priority: 1,
      category: 'analyze',
    });
    expect(result.current.suggestions[1]).toEqual({
      id: 'taches-etablissement',
      label: 'Tâches en attente',
      command: 'Liste les tâches en attente pour l\'établissement "Acme Campus"',
      icon: 'task',
      priority: 2,
      category: 'analyze',
    });
    expect(result.current.suggestions[4]).toEqual({
      id: 'creer-tache-etab',
      label: 'Créer une tâche',
      command: 'Crée une tâche de suivi pour "Acme Campus"',
      icon: 'edit',
      priority: 5,
      category: 'create',
    });

    expect(result.current.quickActions).toEqual([
      {
        id: 'quick-briefing',
        label: 'Briefing',
        command: 'Génère mon briefing rapide : tâches urgentes, emails non lus, prochains événements',
        icon: 'summary',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'quick-emails',
        label: 'Emails',
        command: 'Résume mes emails urgents non lus',
        icon: 'email',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'quick-taches',
        label: 'Tâches',
        command: 'Quelles sont mes tâches prioritaires pour aujourd\'hui ?',
        icon: 'task',
        priority: 3,
        category: 'analyze',
      },
    ]);
  });

  it('retourne les suggestions de liste pour /etablissements', () => {
    const wrapper = createWrapper(['/etablissements']);

    const { result } = renderHook(() => useJarvisContextualSuggestions(), { wrapper });

    expect(result.current.suggestions).toHaveLength(3);
    expect(result.current.suggestions.map((s) => s.id)).toEqual([
      'pipeline-overview',
      'prospects-chauds',
      'etablissements-risque',
    ]);
    expect(result.current.suggestions[0]).toEqual({
      id: 'pipeline-overview',
      label: 'Vue d\'ensemble du pipeline',
      command: 'Montre-moi un résumé du pipeline commercial avec les opportunités par statut',
      icon: 'chart',
      priority: 1,
      category: 'analyze',
    });
    expect(result.current.suggestions[2]).toEqual({
      id: 'etablissements-risque',
      label: 'Clients à risque',
      command: 'Identifie les clients à risque de churn avec les signaux d\'alerte',
      icon: 'alert',
      priority: 3,
      category: 'analyze',
    });
  });

  it('retourne les suggestions par défaut quand aucune route ne correspond', () => {
    const wrapper = createWrapper(['/inconnu']);

    const { result } = renderHook(() => useJarvisContextualSuggestions(), { wrapper });

    expect(result.current.suggestions).toEqual([
      {
        id: 'aide-generale',
        label: 'Que puis-je faire ?',
        command: 'Explique-moi ce que tu peux faire pour m\'aider',
        icon: 'summary',
        priority: 1,
        category: 'analyze',
      },
    ]);
  });

  it('propage l’état de chargement du page context pour la page emails', () => {
    mockUseJarvisPageContext.mockReturnValue(PAGE_CONTEXT_LOADING);
    const wrapper = createWrapper(['/emails']);

    const { result } = renderHook(() => useJarvisContextualSuggestions(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.pageType).toBe('list');
    expect(result.current.module).toBe('emails');
    expect(result.current.entityName).toBeUndefined();
    expect(result.current.entityId).toBeUndefined();
    expect(result.current.suggestions).toEqual([
      {
        id: 'emails-urgents',
        label: 'Emails urgents',
        command: 'Résume mes emails urgents non lus avec les actions requises',
        icon: 'email',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'trier-emails',
        label: 'Trier par priorité',
        command: 'Trie mes emails par priorité et catégorie',
        icon: 'summary',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'emails-sans-reponse',
        label: 'Emails sans réponse',
        command: 'Quels emails importants attendent une réponse de ma part ?',
        icon: 'alert',
        priority: 3,
        category: 'analyze',
      },
      {
        id: 'rediger-email',
        label: 'Rédiger un email',
        command: 'Aide-moi à rédiger un email professionnel',
        icon: 'edit',
        priority: 4,
        category: 'create',
      },
    ]);
  });

  it('utilise les commandes fallback sans nom d’entité sur une fiche établissement', () => {
    mockUseJarvisPageContext.mockReturnValue(PAGE_CONTEXT_NO_ENTITY);
    const wrapper = createWrapper(['/etablissements/def-456']);

    const { result } = renderHook(() => useJarvisContextualSuggestions(), { wrapper });

    expect(result.current.entityName).toBeUndefined();
    expect(result.current.entityId).toBeUndefined();
    expect(result.current.suggestions[0].command).toBe(
      'Résume cet établissement avec son historique, ses contacts et sa santé client'
    );
    expect(result.current.suggestions[1].command).toBe(
      'Liste les tâches en attente pour cet établissement'
    );
    expect(result.current.suggestions[2].command).toBe(
      'Montre-moi l\'historique des échanges emails avec cet établissement'
    );
    expect(result.current.suggestions[3].command).toBe(
      'Analyse la santé client de cet établissement et suggère des actions'
    );
  });

  it('retourne les suggestions du dashboard pour la racine', () => {
    const wrapper = createWrapper(['/']);

    const { result } = renderHook(() => useJarvisContextualSuggestions(), { wrapper });

    expect(result.current.suggestions).toHaveLength(4);
    expect(result.current.suggestions.map((s) => s.id)).toEqual([
      'briefing-jour',
      'mes-taches',
      'kpis-globaux',
      'alertes-actives',
    ]);
    expect(result.current.suggestions[0]).toEqual({
      id: 'briefing-jour',
      label: 'Briefing du jour',
      command: 'Génère mon briefing du jour avec les tâches urgentes, emails et événements',
      icon: 'summary',
      priority: 1,
      category: 'analyze',
    });
  });
});