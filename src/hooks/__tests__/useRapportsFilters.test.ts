import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    getPreference: () => 'dashboard',
    updatePreference: vi.fn(),
  }),
}));

import { useRapportsFilters } from '../analytics/useRapportsFilters';

describe('useRapportsFilters', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useRapportsFilters());
    expect(result.current.periodPreset).toBe('30d');
    expect(result.current.compareWithPrevious).toBe(false);
    expect(result.current.includeProspects).toBe(true);
    expect(result.current.productionOnly).toBe(false);
    expect(result.current.view).toBe('dashboard');
  });

  it('changes period preset', () => {
    const { result } = renderHook(() => useRapportsFilters());
    act(() => result.current.setPeriodPreset('7d'));
    expect(result.current.periodPreset).toBe('7d');
  });

  it('computes dates for different presets', () => {
    const { result } = renderHook(() => useRapportsFilters());

    act(() => result.current.setPeriodPreset('90d'));
    const diffDays = Math.floor(
      (result.current.filters.endDate.getTime() - result.current.filters.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(91);
  });

  it('computes previous period dates', () => {
    const { result } = renderHook(() => useRapportsFilters());
    expect(result.current.filters.previousEndDate.getTime())
      .toBeLessThan(result.current.filters.startDate.getTime());
  });

  it('resets all filters', () => {
    const { result } = renderHook(() => useRapportsFilters());
    act(() => {
      result.current.setPeriodPreset('7d');
      result.current.setIncludeProspects(false);
      result.current.setProductionOnly(true);
      result.current.setSelectedStatuts(['Production']);
    });
    act(() => result.current.resetFilters());
    expect(result.current.periodPreset).toBe('30d');
    expect(result.current.includeProspects).toBe(true);
    expect(result.current.productionOnly).toBe(false);
    expect(result.current.selectedStatuts).toEqual([]);
  });

  it('manages selected etablissements', () => {
    const { result } = renderHook(() => useRapportsFilters());
    act(() => result.current.setSelectedEtablissements(['e1', 'e2']));
    expect(result.current.selectedEtablissements).toEqual(['e1', 'e2']);
  });

  it('manages value bounds', () => {
    const { result } = renderHook(() => useRapportsFilters());
    act(() => {
      result.current.setMinValue(5000);
      result.current.setMaxValue(50000);
    });
    expect(result.current.minValue).toBe(5000);
    expect(result.current.maxValue).toBe(50000);
  });

  it('sets custom date range', () => {
    const { result } = renderHook(() => useRapportsFilters());
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 31);
    act(() => {
      result.current.setPeriodPreset('custom');
      result.current.setCustomStartDate(start);
      result.current.setCustomEndDate(end);
    });
    expect(result.current.filters.startDate).toEqual(start);
    expect(result.current.filters.endDate).toEqual(end);
  });
});
