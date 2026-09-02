import { describe, it, expect } from 'vitest';
import { supportModule } from '../tutoriel-content/support';

describe('tutoriel support', () => {
  it('has correct id', () => expect(supportModule.id).toBe('support'));
  it('has title', () => expect(supportModule.title).toBe('Gestion du Support'));
  it('has category operations', () => expect(supportModule.category).toBe('operations'));
  it('has level intermediaire', () => expect(supportModule.level).toBe('intermediaire'));
  it('has sections', () => expect(supportModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    supportModule.sections.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has id, title, content', () => {
    supportModule.sections.forEach(s => {
      s.steps.forEach(step => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
