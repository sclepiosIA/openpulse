import { useState, useMemo } from 'react';

export interface GeographicFilters {
  search: string;
  regions: string[];
  types: string[];
  phases: string[];
  dpis: string[];
  licensesRange: [number, number];
  passagesRange: [number, number];
  commercialId?: string;
  chefProjetId?: string;
  csmId?: string;
}

export function useGeographicFilters() {
  const [filters, setFilters] = useState<GeographicFilters>({
    search: '',
    regions: [],
    types: [],
    phases: [],
    dpis: [],
    licensesRange: [0, 1000],
    passagesRange: [0, 500000],
  });

  const updateFilter = <K extends keyof GeographicFilters>(
    key: K,
    value: GeographicFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      regions: [],
      types: [],
      phases: [],
      dpis: [],
      licensesRange: [0, 1000],
      passagesRange: [0, 500000],
    });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.regions.length > 0 ||
      filters.types.length > 0 ||
      filters.phases.length > 0 ||
      filters.dpis.length > 0 ||
      filters.licensesRange[0] > 0 ||
      filters.licensesRange[1] < 1000 ||
      filters.passagesRange[0] > 0 ||
      filters.passagesRange[1] < 500000 ||
      filters.commercialId !== undefined ||
      filters.chefProjetId !== undefined ||
      filters.csmId !== undefined
    );
  }, [filters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  };
}
