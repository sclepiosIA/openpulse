import { describe, it, expect } from 'vitest';
import { facturationModule } from '../tutoriel-content/facturation';

describe('tutoriel facturation', () => {
  it('has correct id', () => expect(facturationModule.id).toBe('facturation'));
  it('has title', () => expect(facturationModule.title).toBe("Facturation & Devis"));
  it('has sections', () => expect(facturationModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    facturationModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    facturationModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
