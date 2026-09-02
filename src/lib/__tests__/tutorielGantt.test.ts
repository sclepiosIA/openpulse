import { describe, it, expect } from 'vitest';
import { ganttModule } from '../tutoriel-content/gantt';

describe('tutoriel gantt', () => {
  it('has correct id', () => expect(ganttModule.id).toBe('gantt'));
  it('has title', () => expect(ganttModule.title).toBe("Gantt Global"));
  it('has sections', () => expect(ganttModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    ganttModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    ganttModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
