import { describe, it, expect } from 'vitest';
import { rhModule } from '../tutoriel-content/rh';

describe('tutoriel rh', () => {
  it('has correct id', () => expect(rhModule.id).toBe('rh'));
  it('has title', () => expect(rhModule.title).toBe("People / RH"));
  it('has sections', () => expect(rhModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    rhModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    rhModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
