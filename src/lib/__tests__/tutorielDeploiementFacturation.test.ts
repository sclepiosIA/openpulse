import { describe, it, expect } from 'vitest';
import { deploiementModule } from '../tutoriel-content/deploiement';
import { facturationModule } from '../tutoriel-content/facturation';

describe('tutoriel deploiement', () => {
  it('has correct id', () => expect(deploiementModule.id).toBe('deploiement'));
  it('has title', () => expect(deploiementModule.title).toBe('Déploiement'));
  it('has category operations', () => expect(deploiementModule.category).toBe('operations'));
  it('has sections', () => expect(deploiementModule.sections.length).toBeGreaterThan(0));
  it('all sections have id, title, steps', () => {
    deploiementModule.sections.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.steps.length).toBeGreaterThan(0);
    });
  });
  it('all steps have required fields', () => {
    deploiementModule.sections.forEach(s => {
      s.steps.forEach(step => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});

describe('tutoriel facturation', () => {
  it('has correct id', () => expect(facturationModule.id).toBe('facturation'));
  it('has title', () => expect(facturationModule.title).toBe('Facturation & Devis'));
  it('has category', () => expect(facturationModule.category).toBeTruthy());
  it('has estimatedTime', () => expect(facturationModule.estimatedTime).toBeTruthy());
  it('has level', () => expect(facturationModule.level).toBeTruthy());
  it('has sections', () => expect(facturationModule.sections.length).toBeGreaterThan(0));
  it('all sections have steps', () => {
    facturationModule.sections.forEach(s => {
      expect(s.steps.length).toBeGreaterThan(0);
      s.steps.forEach(step => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
