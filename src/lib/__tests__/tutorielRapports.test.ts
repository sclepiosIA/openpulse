import { describe, it, expect } from 'vitest';
import { rapportsModule } from '../tutoriel-content/rapports';

describe('tutoriel rapports', () => {
  it('has correct id', () => expect(rapportsModule.id).toBe('rapports'));
  it('has title', () => expect(rapportsModule.title).toBe("Rapports"));
  it('has sections', () => expect(rapportsModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    rapportsModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    rapportsModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
