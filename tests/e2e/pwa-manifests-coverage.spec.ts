import { test, expect } from '@playwright/test';

/**
 * Vérifie que les manifests PWA spécialisés (calendar, mail, pulse, todos,
 * jarvis) répondent et exposent les champs attendus.
 */

const MANIFESTS = [
  '/manifest.webmanifest',
  '/manifest-calendar.json',
  '/manifest-mail.json',
  '/manifest-pulse.json',
  '/manifest-todos.json',
  '/manifest-jarvis.json',
];

test.describe('PWA manifests', () => {
  for (const path of MANIFESTS) {
    test(`${path} valide`, async ({ request }) => {
      const resp = await request.get(path);
      expect(resp.status()).toBeLessThan(400);
      const json = await resp.json();
      expect(json.name || json.short_name, `${path} sans name`).toBeTruthy();
      expect(Array.isArray(json.icons) && json.icons.length > 0, `${path} sans icons`).toBe(true);
    });
  }
});
