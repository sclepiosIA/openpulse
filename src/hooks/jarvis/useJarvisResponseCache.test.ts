import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useJarvisResponseCache } from './useJarvisResponseCache';

const { mockDebug } = vi.hoisted(() => ({
  mockDebug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: mockDebug,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const SMALL_CONFIG = { maxEntries: 2 };
const NO_PREFETCH_CONFIG = { enablePrefetch: false };

describe('useJarvisResponseCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialise avec des stats vides et la config par défaut', () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    expect(result.current.stats.hits).toBe(0);
    expect(result.current.stats.misses).toBe(0);
    expect(result.current.stats.entries).toBe(0);
    expect(result.current.stats.hitRate).toBe('0%');
    expect(result.current.stats.totalTimeSavedMs).toBe(0);
    expect(result.current.config.maxEntries).toBe(100);
    expect(result.current.config.ttlMs).toBe(30 * 60 * 1000);
    expect(result.current.config.similarityThreshold).toBe(0.85);
    expect(result.current.config.enablePrefetch).toBe(true);
  });

  it('merge la config partielle avec la config par défaut', () => {
    const { result } = renderHook(() => useJarvisResponseCache(SMALL_CONFIG), {
      wrapper: createWrapper(),
    });

    expect(result.current.config.maxEntries).toBe(2);
    expect(result.current.config.ttlMs).toBe(30 * 60 * 1000);
  });

  it('retourne null et incrémente misses pour une requête absente du cache', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    let value: string | null = 'sentinel';
    await act(async () => {
      value = result.current.get('question inconnue');
    });

    expect(value).toBeNull();
    expect(result.current.stats.misses).toBe(1);
    expect(result.current.stats.hits).toBe(0);
  });

  it('set puis get retourne la réponse exacte et incrémente hits', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('Bonjour Jarvis', 'Bonjour, comment puis-je aider ?');
    });

    expect(result.current.stats.entries).toBe(1);

    let value: string | null = null;
    await act(async () => {
      value = result.current.get('Bonjour Jarvis');
    });

    expect(value).toBe('Bonjour, comment puis-je aider ?');
    expect(result.current.stats.hits).toBe(1);
    expect(result.current.stats.misses).toBe(0);
    expect(result.current.stats.hitRate).toBe('100.0%');
  });

  it('normalise les requêtes (casse, espaces) pour le matching', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('Quelle Heure  Est-Il', 'Il est midi');
    });

    let value: string | null = null;
    await act(async () => {
      value = result.current.get('  quelle heure est-il  ');
    });

    expect(value).toBe('Il est midi');
    expect(result.current.stats.hits).toBe(1);
  });

  it('comptabilise le temps économisé via responseTime sur un hit', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('requete lente', 'reponse rapide', 1000);
    });

    await act(async () => {
      result.current.get('requete lente');
    });

    expect(result.current.stats.totalTimeSavedMs).toBe(1000);
    // avg = (1500 + 1000) / 2
    expect(result.current.stats.avgResponseTime).toBe(1250);
  });

  it('clear vide le cache et réinitialise les stats', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('a garder', 'valeur');
      result.current.get('a garder');
    });

    await act(async () => {
      result.current.clear();
    });

    expect(result.current.stats.entries).toBe(0);
    expect(result.current.stats.hits).toBe(0);
    expect(result.current.stats.misses).toBe(0);
    expect(result.current.stats.totalTimeSavedMs).toBe(0);

    let value: string | null = 'sentinel';
    await act(async () => {
      value = result.current.get('a garder');
    });
    expect(value).toBeNull();
  });

  it('applique une éviction LRU quand maxEntries est atteint', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(SMALL_CONFIG), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('premiere entree unique', 'r1');
      result.current.set('deuxieme valeur distincte', 'r2');
      result.current.set('troisieme contenu different', 'r3');
    });

    expect(result.current.stats.entries).toBe(2);

    let evicted: string | null = 'sentinel';
    await act(async () => {
      evicted = result.current.get('premiere entree unique');
    });
    expect(evicted).toBeNull();

    let kept: string | null = null;
    await act(async () => {
      kept = result.current.get('troisieme contenu different');
    });
    expect(kept).toBe('r3');
  });

  it('invalidateByPattern supprime les entrées correspondantes et retourne le compte', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('statistiques des ventes', 'rapport ventes');
      result.current.set('meteo demain', 'soleil');
    });

    let count = 0;
    await act(async () => {
      count = result.current.invalidateByPattern('ventes');
    });

    expect(count).toBe(1);
    expect(result.current.stats.entries).toBe(1);

    let value: string | null = null;
    await act(async () => {
      value = result.current.get('meteo demain');
    });
    expect(value).toBe('soleil');
  });

  it('invalidateByTable supprime les entrées liées à une table (formes singulier/pluriel)', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('liste des clients actifs', 'liste clients');
      result.current.set('meteo du jour', 'pluie');
    });

    let count = 0;
    await act(async () => {
      count = result.current.invalidateByTable('clients');
    });

    expect(count).toBe(1);
    expect(result.current.stats.entries).toBe(1);
  });

  it('warmCache pré-remplit le cache avec des FAQs', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.warmCache([
        { query: 'horaires ouverture magasin', response: '9h-18h' },
        { query: 'politique de retour produits', response: '30 jours' },
      ]);
    });

    expect(result.current.stats.entries).toBe(2);

    let value: string | null = null;
    await act(async () => {
      value = result.current.get('horaires ouverture magasin');
    });
    expect(value).toBe('9h-18h');
  });

  it('prefetch appelle fetchFn pour les requêtes non cachées (max 3) et stocke les réponses', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    const fetchFn = vi.fn(async (q: string) => `reponse pour ${q}`);

    await act(async () => {
      await result.current.prefetch(
        ['question alpha unique', 'question beta distincte', 'question gamma autre', 'question delta surplus'],
        fetchFn
      );
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn).toHaveBeenCalledWith('question alpha unique');
    expect(result.current.stats.entries).toBe(3);

    let value: string | null = null;
    await act(async () => {
      value = result.current.get('question alpha unique');
    });
    expect(value).toBe('reponse pour question alpha unique');
  });

  it('prefetch ne fait rien quand enablePrefetch est false', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(NO_PREFETCH_CONFIG), {
      wrapper: createWrapper(),
    });

    const fetchFn = vi.fn(async () => 'jamais appele');

    await act(async () => {
      await result.current.prefetch(['une question'], fetchFn);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.stats.entries).toBe(0);
  });

  it('prefetch tolère les échecs de fetchFn sans planter et logue un warning', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    });

    await act(async () => {
      await result.current.prefetch(['requete en echec'], fetchFn);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.current.stats.entries).toBe(0);
    expect(mockDebug.warn).toHaveBeenCalled();
  });

  it('getStats expose les requêtes les plus fréquentes triées par hits', async () => {
    const { result } = renderHook(() => useJarvisResponseCache(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.set('requete populaire ici', 'rep1');
      result.current.set('requete rare differente', 'rep2');
    });

    await act(async () => {
      result.current.get('requete populaire ici');
      result.current.get('requete populaire ici');
      result.current.get('requete rare differente');
    });

    const top = result.current.stats.mostFrequentQueries;
    expect(top).toHaveLength(2);
    expect(top[0].query).toBe('requete populaire ici');
    expect(top[0].hits).toBe(2);
    expect(top[1].hits).toBe(1);
    expect(result.current.stats.hits).toBe(3);
  });
});