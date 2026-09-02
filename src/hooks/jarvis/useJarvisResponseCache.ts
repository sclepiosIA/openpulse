/**
 * useJarvisResponseCache - Cache LRU intelligent pour les réponses Jarvis
 * 
 * V2: Optimisations de performance + métriques détaillées
 * - Cache LRU avec TTL et éviction automatique
 * - Similarité sémantique via Levenshtein optimisé
 * - Préfetching des requêtes fréquentes
 * - Statistiques d'utilisation détaillées
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { debug } from '@/lib/debug';

interface CacheEntry {
  query: string;
  response: string;
  timestamp: number;
  hitCount: number;
  lastHitAt: number;
  responseTime?: number; // ms saved by cache hit
}

interface CacheConfig {
  maxEntries: number;
  ttlMs: number;
  similarityThreshold: number;
  enablePrefetch: boolean;
  cleanupIntervalMs: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: string;
  totalTimeSavedMs: number;
  avgResponseTime: number;
  mostFrequentQueries: Array<{ query: string; hits: number }>;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 100,
  ttlMs: 30 * 60 * 1000, // 30 minutes
  similarityThreshold: 0.85,
  enablePrefetch: true,
  cleanupIntervalMs: 60000, // 1 minute
};

// Optimized Levenshtein with early termination
function levenshteinOptimized(a: string, b: string, maxDistance: number): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  // Early termination if length difference exceeds max distance
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    let minInRow = Infinity;
    
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
      minInRow = Math.min(minInRow, matrix[i][j]);
    }
    
    // Early termination if all values in row exceed max distance
    if (minInRow > maxDistance) return maxDistance + 1;
  }
  
  return matrix[b.length][a.length];
}

// Fast string similarity with early termination
function stringSimilarity(a: string, b: string, threshold: number): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1.0;
  
  // Quick check for exact match
  if (a === b) return 1.0;
  
  // Quick check for containment
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  
  // Calculate max allowed distance based on threshold
  const maxDistance = Math.floor(longer.length * (1 - threshold));
  
  // Optimized Levenshtein with early termination
  const editDistance = levenshteinOptimized(a, b, maxDistance);
  
  if (editDistance > maxDistance) return 0; // Below threshold
  
  return (longer.length - editDistance) / longer.length;
}

// Normalize query for better matching
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]+$/g, ''); // Remove trailing punctuation
}

export function useJarvisResponseCache(config: Partial<CacheConfig> = {}) {
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [stats, setStats] = useState({ 
    hits: 0, 
    misses: 0, 
    entries: 0,
    totalTimeSavedMs: 0 
  });
  
  // Track average response time for estimation
  const avgResponseTimeRef = useRef(1500); // Default estimate: 1.5s

  // Cleanup expired entries
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let removed = 0;
      
      cacheRef.current.forEach((entry, key) => {
        if (now - entry.timestamp > finalConfig.ttlMs) {
          cacheRef.current.delete(key);
          removed++;
        }
      });
      
      if (removed > 0) {
        debug.log(`[JarvisCache] Cleaned ${removed} expired entries`);
        setStats(prev => ({ ...prev, entries: cacheRef.current.size }));
      }
    }, finalConfig.cleanupIntervalMs);

    return () => clearInterval(interval);
  }, [finalConfig.ttlMs, finalConfig.cleanupIntervalMs]);

  // Find similar query in cache with optimized search
  const findSimilar = useCallback((query: string): CacheEntry | null => {
    const normalizedQuery = normalizeQuery(query);
    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    // First, check for exact match (fastest)
    const exactMatch = cacheRef.current.get(normalizedQuery);
    if (exactMatch) {
      return exactMatch;
    }

    // Then check for similar queries
    cacheRef.current.forEach((entry) => {
      const normalizedEntryQuery = normalizeQuery(entry.query);
      const similarity = stringSimilarity(
        normalizedQuery, 
        normalizedEntryQuery, 
        finalConfig.similarityThreshold
      );
      
      if (similarity >= finalConfig.similarityThreshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    });

    return bestMatch;
  }, [finalConfig.similarityThreshold]);

  // Get from cache
  const get = useCallback((query: string): string | null => {
    const cached = findSimilar(query);
    
    if (cached) {
      const now = Date.now();
      
      // Update hit count and timestamps
      cached.hitCount++;
      cached.lastHitAt = now;
      cached.timestamp = now; // Refresh TTL on hit
      
      const timeSaved = cached.responseTime || avgResponseTimeRef.current;
      
      setStats(prev => ({ 
        ...prev, 
        hits: prev.hits + 1,
        totalTimeSavedMs: prev.totalTimeSavedMs + timeSaved 
      }));
      
      debug.log(`[JarvisCache] HIT for "${query.slice(0, 30)}..." (saved ~${timeSaved}ms)`);
      return cached.response;
    }
    
    setStats(prev => ({ ...prev, misses: prev.misses + 1 }));
    return null;
  }, [findSimilar]);

  // Set in cache with LRU eviction
  const set = useCallback((query: string, response: string, responseTimeMs?: number) => {
    const normalizedQuery = normalizeQuery(query);
    const now = Date.now();
    
    // Update average response time
    if (responseTimeMs) {
      avgResponseTimeRef.current = (avgResponseTimeRef.current + responseTimeMs) / 2;
    }
    
    // LRU eviction if at capacity
    if (cacheRef.current.size >= finalConfig.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      let lowestHitCount = Infinity;
      
      // Find LRU entry (combination of last access time and hit count)
      cacheRef.current.forEach((entry, key) => {
        const score = entry.lastHitAt + (entry.hitCount * 60000); // Each hit adds 1 minute of "age"
        if (score < oldestTime || (score === oldestTime && entry.hitCount < lowestHitCount)) {
          oldestTime = score;
          lowestHitCount = entry.hitCount;
          oldestKey = key;
        }
      });
      
      if (oldestKey) {
        cacheRef.current.delete(oldestKey);
        debug.log(`[JarvisCache] Evicted LRU entry`);
      }
    }

    cacheRef.current.set(normalizedQuery, {
      query,
      response,
      timestamp: now,
      hitCount: 0,
      lastHitAt: now,
      responseTime: responseTimeMs,
    });

    setStats(prev => ({ ...prev, entries: cacheRef.current.size }));
    debug.log(`[JarvisCache] SET "${query.slice(0, 30)}..." (${cacheRef.current.size} entries)`);
  }, [finalConfig.maxEntries]);

  // Clear cache
  const clear = useCallback(() => {
    cacheRef.current.clear();
    setStats({ hits: 0, misses: 0, entries: 0, totalTimeSavedMs: 0 });
    debug.log('[JarvisCache] Cleared');
  }, []);

  // Invalidate cache entries by pattern (V10.0)
  const invalidateByPattern = useCallback((pattern: string | RegExp): number => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    let count = 0;

    cacheRef.current.forEach((entry, key) => {
      if (regex.test(entry.query) || regex.test(key)) {
        cacheRef.current.delete(key);
        count++;
      }
    });

    if (count > 0) {
      setStats(prev => ({ ...prev, entries: cacheRef.current.size }));
      debug.log(`[JarvisCache] Invalidated ${count} entries matching pattern`);
    }

    return count;
  }, []);

  // Invalidate cache entries related to a table/entity (V10.0)
  const invalidateByTable = useCallback((table: string): number => {
    const keywords = [
      table, 
      table.replace(/_/g, ' '), 
      table.replace(/s$/, ''), // Singular form
      table.replace(/es$/, ''), // Another singular form
    ];
    let count = 0;

    cacheRef.current.forEach((entry, key) => {
      const queryLower = entry.query.toLowerCase();
      const hasMatch = keywords.some(kw => queryLower.includes(kw.toLowerCase()));
      
      if (hasMatch) {
        cacheRef.current.delete(key);
        count++;
      }
    });

    if (count > 0) {
      setStats(prev => ({ ...prev, entries: cacheRef.current.size }));
      debug.log(`[JarvisCache] Invalidated ${count} entries for table: ${table}`);
    }

    return count;
  }, []);

  // Prefetch common queries (call this with predicted queries)
  const prefetch = useCallback(async (
    queries: string[], 
    fetchFn: (query: string) => Promise<string>
  ) => {
    if (!finalConfig.enablePrefetch) return;
    
    const uncachedQueries = queries.filter(q => !findSimilar(q));
    
    for (const query of uncachedQueries.slice(0, 3)) { // Max 3 prefetches
      try {
        const startTime = Date.now();
        const response = await fetchFn(query);
        const responseTime = Date.now() - startTime;
        set(query, response, responseTime);
      } catch (e) {
        debug.warn(`[JarvisCache] Prefetch failed for "${query.slice(0, 20)}..."`);
      }
    }
  }, [finalConfig.enablePrefetch, findSimilar, set]);

  // Get detailed cache stats
  const getStats = useCallback((): CacheStats => {
    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 
      ? (stats.hits / totalRequests * 100).toFixed(1)
      : '0';
    
    // Get most frequent queries
    const entries = Array.from(cacheRef.current.values());
    const mostFrequent = entries
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 5)
      .map(e => ({ query: e.query.slice(0, 50), hits: e.hitCount }));
    
    return {
      hits: stats.hits,
      misses: stats.misses,
      entries: stats.entries,
      hitRate: `${hitRate}%`,
      totalTimeSavedMs: stats.totalTimeSavedMs,
      avgResponseTime: avgResponseTimeRef.current,
      mostFrequentQueries: mostFrequent,
    };
  }, [stats]);

  // Warm cache with frequently asked questions
  const warmCache = useCallback((faqs: Array<{ query: string; response: string }>) => {
    for (const faq of faqs) {
      set(faq.query, faq.response, 0);
    }
    debug.log(`[JarvisCache] Warmed with ${faqs.length} FAQs`);
  }, [set]);

  return {
    get,
    set,
    clear,
    prefetch,
    warmCache,
    invalidateByPattern,
    invalidateByTable,
    stats: getStats(),
    config: finalConfig,
  };
}
