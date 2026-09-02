import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useEmailFilters } from '../email/useEmailFilters';

describe('useEmailFilters', () => {
  it('initializes with default filters', () => {
    const { result } = renderHook(() => useEmailFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.category).toBeNull();
    expect(result.current.filters.unreadOnly).toBe(false);
    expect(result.current.filters.mailbox).toBe('inbox');
  });

  it('updates single filter', () => {
    const { result } = renderHook(() => useEmailFilters());
    act(() => {
      result.current.updateFilter('search', 'test query');
    });
    expect(result.current.filters.search).toBe('test query');
  });

  it('updates category filter', () => {
    const { result } = renderHook(() => useEmailFilters());
    act(() => {
      result.current.updateFilter('category', 'Commercial');
    });
    expect(result.current.filters.category).toBe('Commercial');
  });

  it('updates unreadOnly filter', () => {
    const { result } = renderHook(() => useEmailFilters());
    act(() => {
      result.current.updateFilter('unreadOnly', true);
    });
    expect(result.current.filters.unreadOnly).toBe(true);
  });

  it('updates mailbox filter', () => {
    const { result } = renderHook(() => useEmailFilters());
    act(() => {
      result.current.updateFilter('mailbox', 'sent');
    });
    expect(result.current.filters.mailbox).toBe('sent');
  });

  it('resets all filters', () => {
    const { result } = renderHook(() => useEmailFilters());
    act(() => {
      result.current.updateFilter('search', 'test');
      result.current.updateFilter('category', 'Support');
      result.current.updateFilter('unreadOnly', true);
    });
    act(() => {
      result.current.resetFilters();
    });
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.category).toBeNull();
    expect(result.current.filters.unreadOnly).toBe(false);
  });

  it('preserves other filters when updating one', () => {
    const { result } = renderHook(() => useEmailFilters());
    act(() => {
      result.current.updateFilter('search', 'test');
    });
    act(() => {
      result.current.updateFilter('category', 'Support');
    });
    expect(result.current.filters.search).toBe('test');
    expect(result.current.filters.category).toBe('Support');
  });
});
