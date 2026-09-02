import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useTaskPhaseFilter, {
  filterTasksByEstablishmentPhase,
  getAllowedCategoriesForEstablishment,
} from './useTaskPhaseFilter';

const {
  PROSPECT_PHASE,
  PRODUCTION_PHASE,
  CUMULATIVE_MAP,
  getPhaseByStatusMock,
  getCumulativeMock,
  getPhaseByCategoryMock,
} = vi.hoisted(() => {
  const PROSPECT_PHASE = 'prospect';
  const PRODUCTION_PHASE = 'production';

  const CUMULATIVE_MAP: Record<string, string[]> = {
    prospect: ['Prospect'],
    production: ['Prospect', 'Pré-Prod', 'Production'],
  };

  const getPhaseByStatusMock = vi.fn((status: string) => {
    if (status === 'prospect') return PROSPECT_PHASE;
    if (status === 'production') return PRODUCTION_PHASE;
    return undefined;
  });

  const getCumulativeMock = vi.fn((phase: string) => {
    return CUMULATIVE_MAP[phase] ?? [];
  });

  const getPhaseByCategoryMock = vi.fn((categoryName: string) => {
    const normalized = String(categoryName).toLowerCase();
    if (normalized.includes('prod')) return PRODUCTION_PHASE;
    if (normalized.includes('prospect')) return PROSPECT_PHASE;
    return undefined;
  });

  return {
    PROSPECT_PHASE,
    PRODUCTION_PHASE,
    CUMULATIVE_MAP,
    getPhaseByStatusMock,
    getCumulativeMock,
    getPhaseByCategoryMock,
  };
});

vi.mock('@/config/phases', () => ({
  getPhaseByStatus: getPhaseByStatusMock,
  getCumulativeCategoriesUpToPhase: getCumulativeMock,
  getPhaseByCategory: getPhaseByCategoryMock,
}));

describe('useTaskPhaseFilter & helpers', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when tasks is undefined', () => {
    const { result } = renderHook(() => useTaskPhaseFilter(undefined, undefined), { wrapper });
    expect(result.current.filteredTasks).toEqual([]);
  });

  it('returns original tasks when etablissements is empty array', () => {
    const tasks = [{ id: 'a' }, { id: 'b' }];
    const { result } = renderHook(() => useTaskPhaseFilter(tasks, []), { wrapper });
    expect(result.current.filteredTasks).toBe(tasks);
  });

  it('filters out tasks that belong to a FUTURE phase relative to the establishment', () => {
    type T = { id: string; etablissement_id?: string; categories_taches?: { nom?: string } };

    const tasks: T[] = [
      { id: 'g1' },
      { id: 't1', etablissement_id: 'e1', categories_taches: { nom: 'Production' } },
      { id: 't2', etablissement_id: 'e1', categories_taches: { nom: 'Prospect' } },
    ];

    const etablissements = [{ id: 'e1', statut: 'prospect' }];

    const { result } = renderHook(() => useTaskPhaseFilter(tasks, etablissements), { wrapper });

    const ids = result.current.filteredTasks.map(t => t.id);
    expect(ids).toContain('g1');
    expect(ids).toContain('t2');
    expect(ids).not.toContain('t1');

    expect(getPhaseByStatusMock).toHaveBeenCalledWith('prospect');
    expect(getCumulativeMock).toHaveBeenCalledWith(PROSPECT_PHASE);
  });

  it('getTaskPhaseInfo returns correct phase, taskPhase and isInAllowedPhase', () => {
    type T = { id: string; etablissement_id?: string; categories_taches?: { nom?: string } };

    const etablissements = [
      { id: 'e1', statut: 'production' },
      { id: 'e2', statut: 'prospect' },
    ];

    const tasks: T[] = [
      { id: 'tProd', etablissement_id: 'e1', categories_taches: { nom: 'Production' } },
      { id: 'tOld', etablissement_id: 'e1', categories_taches: { nom: 'Prospect' } },
      { id: 'tUnknownCat', etablissement_id: 'e1', categories_taches: { nom: 'Autre' } },
      { id: 'tNoEtab', categories_taches: { nom: 'Production' } },
      { id: 'tUnknownEtab', etablissement_id: 'missing', categories_taches: { nom: 'Production' } },
    ];

    const { result } = renderHook(() => useTaskPhaseFilter(tasks, etablissements), { wrapper });

    const infoProd = result.current.getTaskPhaseInfo(tasks[0]);
    expect(infoProd.phase).toBe(PRODUCTION_PHASE);
    expect(infoProd.taskPhase).toBe(PRODUCTION_PHASE);
    expect(infoProd.isInAllowedPhase).toBe(true);

    const infoOld = result.current.getTaskPhaseInfo(tasks[1]);
    expect(infoOld.phase).toBe(PRODUCTION_PHASE);
    expect(infoOld.taskPhase).toBe(PROSPECT_PHASE);
    expect(infoOld.isInAllowedPhase).toBe(true);

    const infoUnknownCat = result.current.getTaskPhaseInfo(tasks[2]);
    expect(infoUnknownCat.phase).toBe(PRODUCTION_PHASE);
    expect(infoUnknownCat.taskPhase).toBeUndefined();
    expect(infoUnknownCat.isInAllowedPhase).toBe(false);

    const infoNoEtab = result.current.getTaskPhaseInfo(tasks[3]);
    expect(infoNoEtab.phase).toBeNull();
    expect(infoNoEtab.isInAllowedPhase).toBe(true);

    const infoUnknownEtab = result.current.getTaskPhaseInfo(tasks[4]);
    expect(infoUnknownEtab.phase).toBeNull();
    expect(infoUnknownEtab.isInAllowedPhase).toBe(true);

    expect(getPhaseByStatusMock).toHaveBeenCalledWith('production');
    expect(getCumulativeMock).toHaveBeenCalledWith(PRODUCTION_PHASE);
    expect(getPhaseByCategoryMock).toHaveBeenCalled();
  });

  it('filterTasksByPhase (returned helper) filters tasks correctly', () => {
    type T = { id: string; etablissement_id?: string; categories_taches?: { nom?: string } };

    const tasks: T[] = [
      { id: 'g1' },
      { id: 't1', etablissement_id: 'e1', categories_taches: { nom: 'Production' } },
      { id: 't2', etablissement_id: 'e1', categories_taches: { nom: 'Prospect' } },
    ];
    const etablissements = [{ id: 'e1', statut: 'prospect' }];

    const { result } = renderHook(() => useTaskPhaseFilter(tasks, etablissements), { wrapper });

    const filtered = result.current.filterTasksByPhase(tasks);
    const ids = filtered.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(['g1', 't2']));
    expect(ids).not.toContain('t1');
  });

  it('getAllowedCategoriesForEstablishment returns null when etablissement is undefined or when status unknown', () => {
    expect(getAllowedCategoriesForEstablishment(undefined)).toBeNull();

    const unknownEtab = { id: 'x', statut: 'does_not_exist' };
    expect(getAllowedCategoriesForEstablishment(unknownEtab)).toBeNull();

    const prodEtab = { id: 'e1', statut: 'production' };
    const allowed = getAllowedCategoriesForEstablishment(prodEtab);
    expect(Array.isArray(allowed)).toBe(true);
    expect(allowed).toEqual(CUMULATIVE_MAP[PRODUCTION_PHASE]);
  });

  it('filterTasksByEstablishmentPhase standalone function behaves like the hook filter', () => {
    type T = { id: string; etablissement_id?: string; categories_taches?: { nom?: string } };

    const tasks: T[] = [
      { id: 'g1' },
      { id: 't1', etablissement_id: 'e1', categories_taches: { nom: 'Production' } },
      { id: 't2', etablissement_id: 'e1', categories_taches: { nom: 'Prospect' } },
    ];
    const etablissements = [{ id: 'e1', statut: 'prospect' }];

    const standalone = filterTasksByEstablishmentPhase(tasks, etablissements);
    const ids = standalone.map(t => t.id);
    expect(ids).toContain('g1');
    expect(ids).toContain('t2');
    expect(ids).not.toContain('t1');
  });
});