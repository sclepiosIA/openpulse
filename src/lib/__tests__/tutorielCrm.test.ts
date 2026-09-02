import { describe, it, expect } from 'vitest';
import { crmModule } from '../tutoriel-content/crm';

describe('tutoriel crm', () => {
  it('has correct id', () => expect(crmModule.id).toBe('crm'));
  it('has title', () => expect(crmModule.title).toBe("CRM & Établissements"));
  it('has sections', () => expect(crmModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    crmModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    crmModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
