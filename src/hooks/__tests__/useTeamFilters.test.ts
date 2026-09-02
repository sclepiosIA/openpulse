import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTeamFilters } from '../hr/useTeamFilters';

describe('useTeamFilters', () => {
  it('initializes with defaults', () => {
    const { result } = renderHook(() => useTeamFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.role).toBe('all');
    expect(result.current.filters.status).toBe('all');
    expect(result.current.filters.workload).toBe('all');
    expect(result.current.filters.sortBy).toBe('name');
    expect(result.current.filters.sortOrder).toBe('asc');
  });

  it('updateFilter updates search', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => { result.current.updateFilter('search', 'Jean'); });
    expect(result.current.filters.search).toBe('Jean');
  });

  it('updateFilter updates role', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => { result.current.updateFilter('role', 'admin'); });
    expect(result.current.filters.role).toBe('admin');
  });

  it('updateFilter updates sortBy and sortOrder', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => { result.current.updateFilter('sortBy', 'tasks'); });
    act(() => { result.current.updateFilter('sortOrder', 'desc'); });
    expect(result.current.filters.sortBy).toBe('tasks');
    expect(result.current.filters.sortOrder).toBe('desc');
  });

  it('resetFilters restores defaults', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => { result.current.updateFilter('search', 'test'); });
    act(() => { result.current.updateFilter('role', 'csm'); });
    act(() => { result.current.resetFilters(); });
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.role).toBe('all');
  });
});
