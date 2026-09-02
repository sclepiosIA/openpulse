import { describe, it, expect } from 'vitest';
import { priseEnMainModule } from '../tutoriel-content/prise-en-main';

describe('tutoriel prise-en-main', () => {
  it('has correct id', () => expect(priseEnMainModule.id).toBe('prise-en-main'));
  it('has title', () => expect(priseEnMainModule.title).toBe('Prise en main'));
  it('has sections', () => expect(priseEnMainModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    priseEnMainModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has id, title, content', () => {
    priseEnMainModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
