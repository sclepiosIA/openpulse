import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeographicFilters } from '../geography/useGeographicFilters';

describe('useGeographicFilters', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useGeographicFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.regions).toEqual([]);
    expect(result.current.filters.types).toEqual([]);
    expect(result.current.filters.phases).toEqual([]);
    expect(result.current.filters.dpis).toEqual([]);
    expect(result.current.filters.licensesRange).toEqual([0, 1000]);
    expect(result.current.filters.passagesRange).toEqual([0, 500000]);
  });

  it('hasActiveFilters is false initially', () => {
    const { result } = renderHook(() => useGeographicFilters());
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('updateFilter updates search', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => result.current.updateFilter('search', 'Paris'));
    expect(result.current.filters.search).toBe('Paris');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('updateFilter updates regions', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => result.current.updateFilter('regions', ['Île-de-France']));
    expect(result.current.filters.regions).toEqual(['Île-de-France']);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('updateFilter updates licensesRange', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => result.current.updateFilter('licensesRange', [10, 500]));
    expect(result.current.filters.licensesRange).toEqual([10, 500]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('resetFilters restores defaults', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => result.current.updateFilter('search', 'test'));
    act(() => result.current.updateFilter('regions', ['PACA']));
    act(() => result.current.resetFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.regions).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('hasActiveFilters detects passagesRange changes', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => result.current.updateFilter('passagesRange', [100, 500000]));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters detects commercialId', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => result.current.updateFilter('commercialId', 'user-1'));
    expect(result.current.hasActiveFilters).toBe(true);
  });
});
