import { describe, it, expect } from 'vitest';
import { emailsModule } from '../tutoriel-content/emails';

describe('tutoriel emails', () => {
  it('has correct id', () => expect(emailsModule.id).toBe('emails'));
  it('has title', () => expect(emailsModule.title).toBe("Emails"));
  it('has sections', () => expect(emailsModule.sections.length).toBeGreaterThan(0));
  it('each section has id, title, steps', () => {
    emailsModule.sections.forEach((section: any) => {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
    });
  });
  it('each step has required fields', () => {
    emailsModule.sections.forEach((section: any) => {
      section.steps.forEach((step: any) => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
