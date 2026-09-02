import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRapportsFilters } from '../analytics/useRapportsFilters';

const preferenceMocks = vi.hoisted(() => ({
  getPreference: vi.fn((_key: string, fallback: unknown) => fallback),
  updatePreference: vi.fn(),
}));

vi.mock('../profile/useUserPreferences', () => ({
  useUserPreferences: () => preferenceMocks,
}));

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

describe('useRapportsFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00.000Z'));
    preferenceMocks.getPreference.mockClear();
    preferenceMocks.updatePreference.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialise la vue persistée et la période 30 jours', () => {
    preferenceMocks.getPreference.mockReturnValueOnce('charts');

    const { result } = renderHook(() => useRapportsFilters());

    expect(result.current.view).toBe('charts');
    expect(result.current.periodPreset).toBe('30d');
    expect(isoDay(result.current.filters.endDate)).toBe('2026-06-07');
    expect(isoDay(result.current.filters.startDate)).toBe('2026-05-08');
    expect(isoDay(result.current.filters.previousEndDate)).toBe('2026-05-07');
    expect(isoDay(result.current.filters.previousStartDate)).toBe('2026-04-07');
  });

  it('met à jour la période, les filtres et réinitialise aux valeurs par défaut', () => {
    const { result } = renderHook(() => useRapportsFilters());

    act(() => {
      result.current.setPeriodPreset('7d');
      result.current.setSelectedEtablissements(['eta-1']);
      result.current.setSelectedResponsables(['user-1']);
      result.current.setMinValue(1000);
      result.current.setMaxPassages(50_000);
      result.current.setIncludeProspects(false);
      result.current.setProductionOnly(true);
    });

    expect(isoDay(result.current.filters.startDate)).toBe('2026-05-31');
    expect(result.current.filters.selectedEtablissements).toEqual(['eta-1']);
    expect(result.current.filters.selectedResponsables).toEqual(['user-1']);
    expect(result.current.filters.minValue).toBe(1000);
    expect(result.current.filters.maxPassages).toBe(50_000);
    expect(result.current.filters.includeProspects).toBe(false);
    expect(result.current.filters.productionOnly).toBe(true);

    act(() => result.current.resetFilters());

    expect(result.current.periodPreset).toBe('30d');
    expect(result.current.filters.selectedEtablissements).toEqual([]);
    expect(result.current.filters.selectedResponsables).toEqual([]);
    expect(result.current.filters.minValue).toBe(0);
    expect(result.current.filters.maxPassages).toBe(200_000);
    expect(result.current.filters.includeProspects).toBe(true);
    expect(result.current.filters.productionOnly).toBe(false);
  });

  it('persiste le changement de vue rapport', () => {
    const { result } = renderHook(() => useRapportsFilters());

    act(() => result.current.setView('comparative'));

    expect(result.current.view).toBe('comparative');
    expect(preferenceMocks.updatePreference).toHaveBeenCalledWith('rapports_view', 'comparative');
  });
});