import { describe, it, expect } from 'vitest';
import {
  tutorielModules,
  getModuleById,
  getModulesByCategory,
  searchModules,
} from '../tutoriel-content/index';

describe('tutoriel-content index', () => {
  // Deux modules de tutoriel documentaient des ecrans retires : la base de
  // connaissances et la formation client.
  it('has 24+ modules', () => {
    expect(tutorielModules.length).toBeGreaterThanOrEqual(24);
  });

  it('all modules have unique ids', () => {
    const ids = tutorielModules.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all modules have required fields', () => {
    tutorielModules.forEach(m => {
      expect(m.id).toBeTruthy();
      expect(m.title).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(m.estimatedTime).toBeTruthy();
      expect(m.level).toBeTruthy();
      expect(m.sections.length).toBeGreaterThan(0);
    });
  });

  describe('getModuleById', () => {
    it('finds existing module', () => {
      const m = getModuleById('jarvis');
      expect(m).toBeDefined();
      expect(m?.title).toContain('JARVIS');
    });

    it('returns undefined for unknown', () => {
      expect(getModuleById('nonexistent')).toBeUndefined();
    });
  });

  describe('getModulesByCategory', () => {
    it('returns principal modules', () => {
      const modules = getModulesByCategory('principal');
      expect(modules.length).toBeGreaterThan(0);
      modules.forEach(m => expect(m.category).toBe('principal'));
    });

    it('returns operations modules', () => {
      const modules = getModulesByCategory('operations');
      expect(modules.length).toBeGreaterThan(0);
    });

    it('returns empty for unknown category', () => {
      expect(getModulesByCategory('nonexistent')).toEqual([]);
    });
  });

  describe('searchModules', () => {
    it('finds by title', () => {
      const results = searchModules('JARVIS');
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds by description', () => {
      const results = searchModules('assistant');
      expect(results.length).toBeGreaterThan(0);
    });

    it('case insensitive', () => {
      const results = searchModules('jarvis');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for no match', () => {
      expect(searchModules('xyznonexistent123')).toEqual([]);
    });

    it('searches in step content', () => {
      const results = searchModules('sprint');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
