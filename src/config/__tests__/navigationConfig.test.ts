import { describe, it, expect } from 'vitest';
import { navigationSections } from '../navigationConfig';

describe('navigationConfig', () => {
  it('has multiple sections', () => expect(navigationSections.length).toBeGreaterThan(3));

  it('first section is Général', () => expect(navigationSections[0].section).toBe('Général'));

  it('Général includes Dashboard at /', () => {
    const general = navigationSections[0];
    const dashboard = general.items.find(i => i.path === '/');
    expect(dashboard).toBeDefined();
    expect(dashboard?.exactMatch).toBe(true);
  });

  it('has CRM section with établissements', () => {
    const crm = navigationSections.find(s => s.section === 'CRM');
    expect(crm).toBeDefined();
    expect(crm?.items.some(i => i.path === '/etablissements')).toBe(true);
  });

  it('all items have label, path, icon', () => {
    navigationSections.forEach(section => {
      section.items.forEach(item => {
        expect(item.label).toBeTruthy();
        expect(item.path).toBeTruthy();
        expect(item.icon).toBeDefined();
      });
    });
  });

  it('emails item has badgeKey', () => {
    const emailItem = navigationSections
      .flatMap(s => s.items)
      .find(i => i.path === '/emails');
    expect(emailItem?.badgeKey).toBe('emailsUnread');
  });

  it('no duplicate paths', () => {
    const paths = navigationSections.flatMap(s => s.items.map(i => i.path));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
