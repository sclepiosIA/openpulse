import { describe, it, expect } from 'vitest';
import { groupesPartenairesModule } from '../tutoriel-content/groupes-partenaires';

describe('tutoriel groupes-partenaires', () => {
  it('has correct id', () => expect(groupesPartenairesModule.id).toBe('groupes-partenaires'));
  it('has title', () => expect(groupesPartenairesModule.title).toBe("Groupes & Partenaires"));
  it('has sections', () => expect(groupesPartenairesModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    groupesPartenairesModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    groupesPartenairesModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
