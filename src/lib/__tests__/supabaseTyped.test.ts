import { describe, it, expect } from 'vitest';
import { fromExtended } from '../supabaseTyped';

describe('supabaseTyped', () => {
  describe('fromExtended', () => {
    it('returns a query builder for extended tables', () => {
      const qb = fromExtended('dashboard_layouts');
      expect(qb).toBeDefined();
      expect(typeof qb.select).toBe('function');
    });

    it('has insert method', () => {
      const qb = fromExtended('dashboard_layouts');
      expect(typeof qb.insert).toBe('function');
    });

    it('has update method', () => {
      const qb = fromExtended('dashboard_layouts');
      expect(typeof qb.update).toBe('function');
    });

    it('has delete method', () => {
      const qb = fromExtended('dashboard_layouts');
      expect(typeof qb.delete).toBe('function');
    });
  });
});
