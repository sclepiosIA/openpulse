import { describe, it, expect } from 'vitest';
import { productionModule } from '../tutoriel-content/production';

describe('tutoriel production', () => {
  it('has correct id', () => expect(productionModule.id).toBe('production'));
  it('has title', () => expect(productionModule.title).toBe("Production"));
  it('has sections', () => expect(productionModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    productionModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    productionModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
