import { describe, it, expect } from 'vitest';
import { rdAgileModule } from '../tutoriel-content/rd-agile';
import { ganttModule } from '../tutoriel-content/gantt';
import { jarvisModule } from '../tutoriel-content/jarvis';

describe('tutoriel rd-agile', () => {
  it('has correct id', () => expect(rdAgileModule.id).toBe('rd-agile'));
  it('has title R&D Agile', () => expect(rdAgileModule.title).toBe('R&D Agile'));
  it('has category operations', () => expect(rdAgileModule.category).toBe('operations'));
  it('has level avance', () => expect(rdAgileModule.level).toBe('avance'));
  it('has sections', () => expect(rdAgileModule.sections.length).toBeGreaterThan(0));
  it('steps have content', () => {
    rdAgileModule.sections.forEach(s => {
      s.steps.forEach(step => {
        expect(step.id).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});

describe('tutoriel gantt', () => {
  it('has correct id', () => expect(ganttModule.id).toBe('gantt'));
  it('has title', () => expect(ganttModule.title).toBe('Gantt Global'));
  it('has category operations', () => expect(ganttModule.category).toBe('operations'));
  it('has level avance', () => expect(ganttModule.level).toBe('avance'));
  it('has sections', () => expect(ganttModule.sections.length).toBeGreaterThan(0));
});

describe('tutoriel jarvis', () => {
  it('has correct id', () => expect(jarvisModule.id).toBe('jarvis'));
  it('has title', () => expect(jarvisModule.title).toContain('JARVIS'));
  it('has category principal', () => expect(jarvisModule.category).toBe('principal'));
  it('has level debutant', () => expect(jarvisModule.level).toBe('debutant'));
  it('has many sections', () => expect(jarvisModule.sections.length).toBeGreaterThan(2));
  it('steps have content', () => {
    jarvisModule.sections.forEach(s => {
      s.steps.forEach(step => {
        expect(step.id).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
