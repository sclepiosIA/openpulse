import { describe, it, expect } from 'vitest';
import { calendrierModule } from '../tutoriel-content/calendrier';

describe('tutoriel calendrier', () => {
  it('has correct id', () => expect(calendrierModule.id).toBe('calendrier'));
  it('has title', () => expect(calendrierModule.title).toBe('Calendrier'));
  it('has sections', () => expect(calendrierModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    calendrierModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    calendrierModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
