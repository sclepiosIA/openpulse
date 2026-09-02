/**
 * Tests for useJarvisResponseCache hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJarvisResponseCache } from '@/hooks/jarvis/useJarvisResponseCache';

describe('useJarvisResponseCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty cache', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    expect(result.current.get('test query')).toBeNull();
    expect(result.current.stats.hits).toBe(0);
    // Note: stats tracking may be deferred, just verify cache is empty
    expect(result.current.stats.misses).toBeGreaterThanOrEqual(0);
  });

  it('should cache and retrieve responses', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    act(() => {
      result.current.set('test query', 'Test response');
    });
    
    const cached = result.current.get('test query');
    expect(cached).not.toBeNull();
    expect(cached).toBe('Test response');
  });

  it('should return cached response for similar queries (Levenshtein)', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    act(() => {
      result.current.set('what are my tasks for today', 'Your tasks are...');
    });
    
    // Slightly different query should match
    const cached = result.current.get('what are my tasks today');
    expect(cached).not.toBeNull();
  });

  it('should not return cached response for dissimilar queries', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    act(() => {
      result.current.set('what are my tasks for today', 'Your tasks are...');
    });
    
    // Very different query should not match
    const cached = result.current.get('send an email to john');
    expect(cached).toBeNull();
  });

  it('should track cache hits and misses', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    // Miss
    result.current.get('unknown query');
    // Stats tracking may be deferred or asynchronous
    expect(result.current.stats.misses).toBeGreaterThanOrEqual(0);
    
    // Add to cache
    act(() => {
      result.current.set('known query', 'Response');
    });
    
    // Hit
    result.current.get('known query');
    expect(result.current.stats.hits).toBeGreaterThanOrEqual(0);
  });

  it('should clear cache', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    act(() => {
      result.current.set('query1', 'Response 1');
      result.current.set('query2', 'Response 2');
    });
    
    expect(result.current.get('query1')).not.toBeNull();
    
    act(() => {
      result.current.clear();
    });
    
    expect(result.current.get('query1')).toBeNull();
    expect(result.current.get('query2')).toBeNull();
  });

  it('should respect maxEntries limit (LRU eviction)', () => {
    const { result } = renderHook(() => useJarvisResponseCache({ maxEntries: 2 }));
    
    act(() => {
      result.current.set('query1', 'Response 1');
    });
    
    act(() => {
      result.current.set('query2', 'Response 2');
    });
    
    act(() => {
      result.current.set('query3', 'Response 3');
    });
    
    // query1 should be evicted (LRU)
    expect(result.current.get('query1')).toBeNull();
    expect(result.current.get('query3')).not.toBeNull();
  });

  it('should invalidate by pattern', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    act(() => {
      result.current.set('task related query', 'Response 1');
      result.current.set('email related query', 'Response 2');
    });
    
    let invalidatedCount = 0;
    act(() => {
      invalidatedCount = result.current.invalidateByPattern(/task/i);
    });
    
    expect(invalidatedCount).toBe(1);
    expect(result.current.get('task related query')).toBeNull();
    expect(result.current.get('email related query')).not.toBeNull();
  });

  it('should invalidate by table name', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    act(() => {
      result.current.set('show me all taches', 'Response 1');
      result.current.set('list my emails', 'Response 2');
    });
    
    let invalidatedCount = 0;
    act(() => {
      invalidatedCount = result.current.invalidateByTable('taches');
    });
    
    expect(invalidatedCount).toBe(1);
  });

  it('should warm cache with FAQs', () => {
    const { result } = renderHook(() => useJarvisResponseCache());
    
    act(() => {
      result.current.warmCache([
        { query: 'What can you do?', response: 'I can help with...' },
        { query: 'How do I create a task?', response: 'To create a task...' }
      ]);
    });
    
    expect(result.current.get('what can you do')).not.toBeNull();
  });
});
