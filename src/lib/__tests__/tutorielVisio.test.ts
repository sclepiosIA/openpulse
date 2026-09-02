import { describe, it, expect } from 'vitest';
import { visioModule } from '../tutoriel-content/visio';

describe('tutoriel visio', () => {
  it('has correct id', () => expect(visioModule.id).toBe('visio'));
  it('has title', () => expect(visioModule.title).toBe('Visioconférence'));
  it('has description', () => expect(visioModule.description).toBeTruthy());
  it('has category', () => expect(visioModule.category).toBe('principal'));
  it('has estimatedTime', () => expect(visioModule.estimatedTime).toBeTruthy());
  it('has level', () => expect(visioModule.level).toBe('debutant'));
  it('has sections', () => expect(visioModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    visioModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has id, title, content', () => {
    visioModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
