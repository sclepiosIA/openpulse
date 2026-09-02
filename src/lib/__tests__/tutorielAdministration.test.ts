import { describe, it, expect } from 'vitest';
import { administrationModule } from '../tutoriel-content/administration';

describe('tutoriel administration', () => {
  it('has correct id', () => expect(administrationModule.id).toBe('administration'));
  it('has title', () => expect(administrationModule.title).toBe("Administration"));
  it('has sections', () => expect(administrationModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    administrationModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    administrationModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
