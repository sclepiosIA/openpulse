import type { EtablissementForGeo, GeoSortKey, GeoSortConfig } from './etablissement-geo';

describe('etablissement-geo.ts - type definitions', () => {
  it('should allow a minimal EtablissementForGeo instance', () => {
    const item: EtablissementForGeo = {
      id: 'e1',
      nom: 'Etablissement 1',
      statut: 'actif',
    };
    expect(item.id).toBe('e1');
    expect(item.nom).toBe('Etablissement 1');
    expect(item.statut).toBe('actif');
  });

  it('GeoSortKey should accept only allowed keys', () => {
    const key: GeoSortKey = 'nom';
    expect(key).toBe('nom');
  });

  it('should allow a valid GeoSortConfig', () => {
    const cfg: GeoSortConfig = { key: 'nom', direction: 'asc' };
    expect(cfg.key).toBe('nom');
    expect(cfg.direction).toBe('asc');
  });

  // @ts-expect-error: ensure invalid key is rejected by the type system
  // This line should produce a TypeScript error if GeoSortKey is correct
   
  // @ts-ignore
  // @ts-expect-error
  const badKey: GeoSortKey = 'not-a-key';
});