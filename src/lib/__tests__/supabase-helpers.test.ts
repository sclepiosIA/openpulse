import { describe, it, expect } from 'vitest';
import { SUPABASE_VIEWS } from '../supabase-helpers';

describe('supabase-helpers', () => {
  it('SUPABASE_VIEWS : noms en snake_case', () => {
    for (const v of Object.values(SUPABASE_VIEWS)) {
      expect(v).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('SUPABASE_VIEWS : noms uniques', () => {
    const vals = Object.values(SUPABASE_VIEWS);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it('contient les vues critiques attendues', () => {
    const vals = Object.values(SUPABASE_VIEWS);
    expect(vals).toContain('user_email_accounts_safe');
    expect(vals).toContain('previsions_pipeline');
    expect(vals).toContain('profiles_public_secure');
  });
});
