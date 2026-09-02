import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression test for axe rule `aria-valid-attr-value` on /emails.
 *
 * Les 4 variantes d'item d'email utilisent role="article", qui n'autorise
 * pas `aria-selected`. La présence de cet attribut faisait remonter axe.
 * On s'assure ici qu'aucune variante ne le remette par erreur.
 */
const files = [
  'EmailListItem.tsx',
  'EmailListItemModern.tsx',
  'EmailListItemMobile.tsx',
  'MobileEmailListItem.tsx',
];

describe('EmailListItem variants ARIA compliance', () => {
  for (const file of files) {
    it(`${file} does not use aria-selected on role="article"`, () => {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect(src).not.toMatch(/aria-selected=/);
      // Sanity: role="article" must still be present (accessibility contract)
      expect(src).toMatch(/role="article"/);
    });
  }
});
