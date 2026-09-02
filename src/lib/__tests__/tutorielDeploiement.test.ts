import { describe, it, expect } from 'vitest';
import { deploiementModule } from '../tutoriel-content/deploiement';

describe('tutoriel deploiement', () => {
  it('has correct id', () => expect(deploiementModule.id).toBe('deploiement'));
  it('has title', () => expect(deploiementModule.title).toBe("Déploiement"));
  it('has sections', () => expect(deploiementModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    deploiementModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    deploiementModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
