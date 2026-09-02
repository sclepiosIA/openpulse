import { describe, it, expect } from 'vitest';
import { tresorerieModule } from '../tutoriel-content/tresorerie';

describe('tutoriel tresorerie', () => {
  it('has correct id', () => expect(tresorerieModule.id).toBe('tresorerie'));
  it('has title', () => expect(tresorerieModule.title).toBe("Trésorerie"));
  it('has sections', () => expect(tresorerieModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    tresorerieModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    tresorerieModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
