import { describe, it, expect } from 'vitest';
import { documentsModule } from '../tutoriel-content/documents';

describe('tutoriel documents', () => {
  it('has correct id', () => expect(documentsModule.id).toBe('documents'));
  it('has title', () => expect(documentsModule.title).toBe("Gestion Documentaire"));
  it('has sections', () => expect(documentsModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    documentsModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    documentsModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
