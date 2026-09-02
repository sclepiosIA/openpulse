import { describe, it, expect } from 'vitest';
import { projetsModule } from '../tutoriel-content/projets';

describe('tutoriel projets', () => {
  it('has correct id', () => expect(projetsModule.id).toBe('projets'));
  it('has title', () => expect(projetsModule.title).toBe("Projets & Tâches"));
  it('has sections', () => expect(projetsModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    projetsModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    projetsModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
