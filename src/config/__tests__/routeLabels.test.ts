import { describe, it, expect } from 'vitest';
import { routeLabels, getRouteLabel } from '../routeLabels';

describe('routeLabels', () => {
  describe('routeLabels map', () => {
    it('/ → Tableau de bord', () => expect(routeLabels['/']).toBe('Tableau de bord'));
    it('/emails → Emails', () => expect(routeLabels['/emails']).toBe('Emails'));
    it('/tresorerie → Trésorerie', () => expect(routeLabels['/tresorerie']).toBe('Trésorerie'));
    it('/rd → R&D', () => expect(routeLabels['/rd']).toBe('R&D'));
    it('/people → People', () => expect(routeLabels['/people']).toBe('People'));
  });

  describe('getRouteLabel', () => {
    it('exact match', () => expect(getRouteLabel('/')).toBe('Tableau de bord'));
    it('/etablissements/:id → dynamic', () => expect(getRouteLabel('/etablissements/abc')).toBe('Détail établissement'));
    it('/groupes/:id → dynamic', () => expect(getRouteLabel('/groupes/abc')).toBe('Détail groupe'));
    it('/partenaires/:id → dynamic', () => expect(getRouteLabel('/partenaires/abc')).toBe('Détail partenaire'));
    it('/contrats/builder/:id → dynamic', () => expect(getRouteLabel('/contrats/builder/abc')).toBe('Contract Builder'));
    it('/contrats/:id → dynamic', () => expect(getRouteLabel('/contrats/abc')).toBe('Détail contrat'));
    it('/forum/post/:id → dynamic', () => expect(getRouteLabel('/forum/post/abc')).toBe('Post forum'));
    it('unknown → Page', () => expect(getRouteLabel('/unknown-route')).toBe('Page'));
  });
});
