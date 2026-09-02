import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeographicFilters } from '../geography/useGeographicFilters';

describe('useGeographicFilters', () => {
  it('initializes with empty filters', () => {
    const { result } = renderHook(() => useGeographicFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.regions).toEqual([]);
    expect(result.current.filters.types).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('updateFilter updates single field', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => { result.current.updateFilter('search', 'Paris'); });
    expect(result.current.filters.search).toBe('Paris');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('updateFilter updates array field', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => { result.current.updateFilter('regions', ['IDF', 'ARA']); });
    expect(result.current.filters.regions).toEqual(['IDF', 'ARA']);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('updateFilter updates range', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => { result.current.updateFilter('licensesRange', [10, 500]); });
    expect(result.current.filters.licensesRange).toEqual([10, 500]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('resetFilters returns to defaults', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => { result.current.updateFilter('search', 'test'); });
    act(() => { result.current.updateFilter('regions', ['IDF']); });
    act(() => { result.current.resetFilters(); });
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.regions).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('hasActiveFilters detects commercialId', () => {
    const { result } = renderHook(() => useGeographicFilters());
    act(() => { result.current.updateFilter('commercialId', 'u1'); });
    expect(result.current.hasActiveFilters).toBe(true);
  });
});
