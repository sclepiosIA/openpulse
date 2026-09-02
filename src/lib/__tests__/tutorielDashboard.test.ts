import { describe, it, expect } from 'vitest';
import { dashboardModule } from '../tutoriel-content/dashboard';

describe('tutoriel dashboard', () => {
  it('has correct id', () => expect(dashboardModule.id).toBe('dashboard'));
  it('has title', () => expect(dashboardModule.title).toBe("Tableau de bord"));
  it('has sections', () => expect(dashboardModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    dashboardModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    dashboardModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
