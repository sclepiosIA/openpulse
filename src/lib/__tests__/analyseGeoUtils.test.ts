import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PHASE_LABELS_FR,
  ETABLISSEMENT_TYPES,
  DPI_OPTIONS,
  getPhaseFromStatut,
  formatDateFr,
  formatCurrency,
  DEFAULT_GEO_FILTERS,
  loadGeoFilters,
  saveGeoFilters,
} from '@/lib/analyseGeoUtils';
import {
  FALLBACK_TYPES_ETABLISSEMENT,
  FALLBACK_DPI,
} from '@/config/referenceDataDefaults';

describe('getPhaseFromStatut (via getGeoPhaseFromStatus)', () => {
  it('maps statuts to correct phases', () => {
    expect(getPhaseFromStatut('Contractuel')).toBe('deploiement');
    expect(getPhaseFromStatut('Prospect')).toBe('prospects');
    expect(getPhaseFromStatut('Déploiement')).toBe('deploiement');
    expect(getPhaseFromStatut('Formation')).toBe('deploiement');
    expect(getPhaseFromStatut('Production')).toBe('production');
  });
});

describe('getPhaseFromStatut', () => {
  it('returns correct phase for known statuts', () => {
    expect(getPhaseFromStatut('Contractuel')).toBe('deploiement');
    expect(getPhaseFromStatut('Prospect')).toBe('prospects');
    expect(getPhaseFromStatut('Production')).toBe('production');
  });

  it('defaults to prospects for unknown statut', () => {
    expect(getPhaseFromStatut('Unknown')).toBe('prospects');
    expect(getPhaseFromStatut('')).toBe('prospects');
  });
});

describe('formatDateFr', () => {
  it('formats valid dates to French format', () => {
    const result = formatDateFr('2024-03-15');
    expect(result).toBe('15/03/2024');
  });

  it('formats Date objects', () => {
    const result = formatDateFr(new Date('2024-12-25'));
    expect(result).toBe('25/12/2024');
  });

  it('returns N/A for null/undefined', () => {
    expect(formatDateFr(null)).toBe('N/A');
    expect(formatDateFr(undefined)).toBe('N/A');
  });
});

describe('formatCurrency', () => {
  it('formats numbers as EUR currency', () => {
    const result = formatCurrency(50000);
    // French locale EUR format
    expect(result).toContain('50');
    expect(result).toContain('€');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('returns N/A for null/undefined', () => {
    expect(formatCurrency(null)).toBe('N/A');
    expect(formatCurrency(undefined)).toBe('N/A');
  });
});

// Ces deux constantes sont des réexports obsolètes des référentiels de repli.
// Elles étaient éprouvées sur leurs valeurs hospitalières françaises, ce qui
// revenait à exiger que le produit reste celui d'un seul métier. Ce qui est
// éprouvé maintenant, c'est qu'elles suivent bien le secteur configuré — dont
// le défaut est neutre.
describe('ETABLISSEMENT_TYPES', () => {
  it('suit le secteur configuré, neutre par défaut', () => {
    expect(ETABLISSEMENT_TYPES).toEqual(FALLBACK_TYPES_ETABLISSEMENT);
    expect(ETABLISSEMENT_TYPES.length).toBeGreaterThan(0);
    for (const sectoriel of ['CH', 'CHU', 'ESPIC', 'HIA']) {
      expect(ETABLISSEMENT_TYPES).not.toContain(sectoriel);
    }
  });
});

describe('DPI_OPTIONS', () => {
  it('suit le secteur configuré, sans éditeurs hospitaliers par défaut', () => {
    expect(DPI_OPTIONS).toEqual(FALLBACK_DPI);
    expect(DPI_OPTIONS.length).toBeGreaterThan(0);
    for (const editeur of ['Easily', 'Maincare', 'Sillage']) {
      expect(DPI_OPTIONS).not.toContain(editeur);
    }
  });
});

describe('PHASE_LABELS_FR', () => {
  it('has French labels for all phases', () => {
    expect(PHASE_LABELS_FR['all']).toBe('Tous');
    expect(PHASE_LABELS_FR['prospects']).toBe('Prospects');
    expect(PHASE_LABELS_FR['deploiement']).toBe('Déploiement');
    expect(PHASE_LABELS_FR['production']).toBe('Production');
  });
});

describe('DEFAULT_GEO_FILTERS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_GEO_FILTERS.search).toBe('');
    expect(DEFAULT_GEO_FILTERS.regions).toEqual([]);
    expect(DEFAULT_GEO_FILTERS.types).toEqual([]);
    expect(DEFAULT_GEO_FILTERS.phases).toEqual([]);
    expect(DEFAULT_GEO_FILTERS.dpis).toEqual([]);
    expect(DEFAULT_GEO_FILTERS.commercialId).toBeUndefined();
  });
});

describe('loadGeoFilters / saveGeoFilters', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing saved', () => {
    const filters = loadGeoFilters();
    expect(filters).toEqual(DEFAULT_GEO_FILTERS);
  });

  it('saves and loads filters', () => {
    const custom = { ...DEFAULT_GEO_FILTERS, search: 'CHU', regions: ['ARA'] };
    saveGeoFilters(custom);

    const loaded = loadGeoFilters();
    expect(loaded.search).toBe('CHU');
    expect(loaded.regions).toEqual(['ARA']);
  });

  it('merges saved with defaults for missing keys', () => {
    localStorage.setItem('geo-filters', JSON.stringify({ search: 'test' }));
    const loaded = loadGeoFilters();
    expect(loaded.search).toBe('test');
    expect(loaded.regions).toEqual([]);
    expect(loaded.types).toEqual([]);
  });

  it('returns defaults on invalid JSON', () => {
    localStorage.setItem('geo-filters', 'not-json');
    const loaded = loadGeoFilters();
    expect(loaded).toEqual(DEFAULT_GEO_FILTERS);
  });
});
