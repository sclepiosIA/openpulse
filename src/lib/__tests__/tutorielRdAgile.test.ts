import { describe, it, expect } from 'vitest';
import { rdAgileModule } from '../tutoriel-content/rd-agile';

describe('tutoriel rd-agile', () => {
  it('has correct id', () => expect(rdAgileModule.id).toBe('rd-agile'));
  it('has title', () => expect(rdAgileModule.title).toBe("R&D Agile"));
  it('has sections', () => expect(rdAgileModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    rdAgileModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    rdAgileModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
