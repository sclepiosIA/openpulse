import { describe, it, expect } from 'vitest';
import { analyseGeographiqueModule } from '../tutoriel-content/analyse-geographique';

describe('tutoriel analyse-geographique', () => {
  it('has correct id', () => expect(analyseGeographiqueModule.id).toBe('analyse-geographique'));
  it('has title', () => expect(analyseGeographiqueModule.title).toBe("Analyse géographique"));
  it('has sections', () => expect(analyseGeographiqueModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    analyseGeographiqueModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    analyseGeographiqueModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
