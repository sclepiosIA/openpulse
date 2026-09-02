import { describe, it, expect } from 'vitest';
import { recrutementModule } from '../tutoriel-content/recrutement';

describe('tutoriel recrutement', () => {
  it('has correct id', () => expect(recrutementModule.id).toBe('recrutement'));
  it('has title', () => expect(recrutementModule.title).toBe("Recrutement"));
  it('has sections', () => expect(recrutementModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    recrutementModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    recrutementModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
