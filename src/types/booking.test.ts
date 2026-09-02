import { VIDEO_PROVIDERS } from './booking';

describe('booking module - VIDEO_PROVIDERS', () => {
  it('should export an array with 7 providers in the expected order', () => {
    const expectedValues = ['jitsi', 'meet', 'marque', 'nextcloud', 'teams', 'zoom', 'none'];
    const actualValues = VIDEO_PROVIDERS.map(p => p.value);
    expect(actualValues).toEqual(expectedValues);
  });

  it('should have correct labels for each provider', () => {
    const map = new Map(VIDEO_PROVIDERS.map(p => [p.value, p.label]));
    expect(map.get('jitsi')).toBe('Jitsi Meet (instantané)');
    expect(map.get('meet')).toBe('Google Meet');
    expect(map.get('marque')).toBe('OpenPulse Meet');
    expect(map.get('nextcloud')).toBe('Nextcloud Talk');
    expect(map.get('teams')).toBe('Microsoft Teams');
    expect(map.get('zoom')).toBe('Zoom');
    expect(map.get('none')).toBe('Aucune visio (lien manuel)');
  });

  it('should not have duplicate provider values and all labels must be non-empty strings', () => {
    const values = VIDEO_PROVIDERS.map(p => p.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);

    for (const p of VIDEO_PROVIDERS) {
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it('should only contain allowed provider values', () => {
    const allowed = new Set(['jitsi', 'meet', 'marque', 'nextcloud', 'teams', 'zoom', 'none']);
    for (const p of VIDEO_PROVIDERS) {
      expect(allowed.has(p.value)).toBe(true);
    }
  });

  it('should expose objects with optional icon and required value/label', () => {
    for (const p of VIDEO_PROVIDERS) {
      expect(typeof p.value).toBe('string');
      expect(typeof p.label).toBe('string');
      if ('icon' in p && p.icon !== undefined) {
        expect(typeof p.icon).toBe('string');
      }
    }
  });

  it('should have "jitsi" as the first provider and "none" as the last', () => {
    expect(VIDEO_PROVIDERS[0]?.value).toBe('jitsi');
    expect(VIDEO_PROVIDERS[VIDEO_PROVIDERS.length - 1]?.value).toBe('none');
  });
});