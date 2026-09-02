import { describe, it, expect } from 'vitest';
import { dpoConfigExemple, dpoConfigs } from '../dpo-content';

describe('dpo-content (RGPD config)', () => {
  it('exports a Martinique config with a stable slug', () => {
    expect(dpoConfigExemple.slug).toBe('exemple');
    expect(dpoConfigExemple.etablissement).toContain('exemple');
  });

  it('registers Martinique in the configs registry by slug', () => {
    expect(dpoConfigs.exemple).toBe(dpoConfigExemple);
  });

  it('has all required top-level sections populated', () => {
    expect(dpoConfigExemple.stats.length).toBeGreaterThan(0);
    expect(dpoConfigExemple.engagements.length).toBeGreaterThan(0);
    expect(dpoConfigExemple.hebergement.length).toBeGreaterThan(0);
    expect(dpoConfigExemple.securite.length).toBeGreaterThan(0);
    expect(dpoConfigExemple.traitements.length).toBeGreaterThan(0);
    expect(dpoConfigExemple.droits.length).toBeGreaterThan(0);
    expect(dpoConfigExemple.faq.length).toBeGreaterThan(0);
  });

  it('provides a valid DPO contact (email shape + DPO name)', () => {
    expect(dpoConfigExemple.contactDpo.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    expect(dpoConfigExemple.contactDpo.name.toLowerCase()).toContain('dpo');
  });

  it('declares legal basis for each traitement', () => {
    for (const t of dpoConfigExemple.traitements) {
      expect(t.finalite.length).toBeGreaterThan(0);
      expect(t.baseLegale.length).toBeGreaterThan(0);
      expect(t.conservation.length).toBeGreaterThan(0);
    }
  });

  it('lists all main RGPD individual rights (access, rectification, erasure, restriction, opposition)', () => {
    const titles = dpoConfigExemple.droits.map((d) => d.title.toLowerCase()).join(' | ');
    expect(titles).toContain("accès");
    expect(titles).toContain('rectification');
    expect(titles).toContain('effacement');
    expect(titles).toContain('limitation');
    expect(titles).toContain('opposition');
  });

  it('every FAQ entry has both a question and an answer', () => {
    for (const f of dpoConfigExemple.faq) {
      expect(f.question.endsWith('?')).toBe(true);
      expect(f.answer.length).toBeGreaterThan(20);
    }
  });

  it('every stats entry has a label, value and icon', () => {
    for (const s of dpoConfigExemple.stats) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.value.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });
});
