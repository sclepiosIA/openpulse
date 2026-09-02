import { describe, it, expect } from 'vitest';
import { contratsModule } from '../tutoriel-content/contrats';

describe('tutoriel contrats', () => {
  it('has correct id', () => expect(contratsModule.id).toBe('contrats'));
  it('has title', () => expect(contratsModule.title).toBe('Gestion des Contrats'));
  it('has description', () => expect(contratsModule.description).toBeTruthy());
  it('has category', () => expect(contratsModule.category).toBe('operations'));
  it('has estimatedTime', () => expect(contratsModule.estimatedTime).toBeTruthy());
  it('has level', () => expect(contratsModule.level).toBe('intermediaire'));
  it('has sections', () => expect(contratsModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    contratsModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has id, title, content', () => {
    contratsModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
