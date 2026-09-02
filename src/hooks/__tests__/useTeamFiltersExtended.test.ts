import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTeamFilters } from '../hr/useTeamFilters';

describe('useTeamFilters extended', () => {
  it('updates status filter', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('status', 'actif'));
    expect(result.current.filters.status).toBe('actif');
  });

  it('updates status to inactif', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('status', 'inactif'));
    expect(result.current.filters.status).toBe('inactif');
  });

  it('updates workload filter', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('workload', 'high'));
    expect(result.current.filters.workload).toBe('high');
  });

  it('updates role to commercial', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('role', 'commercial'));
    expect(result.current.filters.role).toBe('commercial');
  });

  it('updates role to chef_projet', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('role', 'chef_projet'));
    expect(result.current.filters.role).toBe('chef_projet');
  });

  it('updates role to manager', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('role', 'manager'));
    expect(result.current.filters.role).toBe('manager');
  });

  it('updates sortBy to completion', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('sortBy', 'completion'));
    expect(result.current.filters.sortBy).toBe('completion');
  });

  it('updates sortBy to lastActivity', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('sortBy', 'lastActivity'));
    expect(result.current.filters.sortBy).toBe('lastActivity');
  });

  it('multiple updates preserve other filters', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('search', 'test'));
    act(() => result.current.updateFilter('role', 'csm'));
    act(() => result.current.updateFilter('workload', 'medium'));
    expect(result.current.filters.search).toBe('test');
    expect(result.current.filters.role).toBe('csm');
    expect(result.current.filters.workload).toBe('medium');
    expect(result.current.filters.status).toBe('all'); // unchanged
  });

  it('resetFilters clears all to defaults', () => {
    const { result } = renderHook(() => useTeamFilters());
    act(() => result.current.updateFilter('search', 'abc'));
    act(() => result.current.updateFilter('role', 'admin'));
    act(() => result.current.updateFilter('status', 'inactif'));
    act(() => result.current.updateFilter('workload', 'high'));
    act(() => result.current.updateFilter('sortBy', 'tasks'));
    act(() => result.current.updateFilter('sortOrder', 'desc'));
    act(() => result.current.resetFilters());
    expect(result.current.filters).toEqual({
      search: '',
      role: 'all',
      status: 'all',
      workload: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });
});
