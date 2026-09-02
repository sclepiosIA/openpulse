import { renderHook, act } from '@testing-library/react';
import { useVisioDetection, detectVisioLink } from './useVisioDetection';
import type { VisioProvider } from './useVisioDetection';

describe('useVisioDetection', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    document.title = 'Page par défaut';
  });

  it('retourne un état vide quand l’URL ne correspond à aucune visio', () => {
    const { result } = renderHook(() => useVisioDetection());

    expect(result.current.activeVisioType).toBeNull();
    expect(result.current.visioUrl).toBeNull();
    expect(result.current.visioTitle).toBeNull();
    expect(result.current.roomCode).toBeNull();
  });

  it('détecte une visio OpenPulse Meet depuis l’URL courante', () => {
    window.history.pushState({}, '', '/visio/room-42');
    document.title = 'Salle de visio';

    const { result } = renderHook(() => useVisioDetection());

    expect(result.current.activeVisioType).toBe('marque_meet');
    expect(result.current.visioUrl).toBe(window.location.href);
    expect(result.current.visioUrl).toContain('/visio/room-42');
    expect(result.current.visioTitle).toBe('Salle de visio');
    expect(result.current.roomCode).toBe('room-42');
  });

  it('met à jour la détection lors d’un événement popstate', () => {
    const { result } = renderHook(() => useVisioDetection());

    expect(result.current.activeVisioType).toBeNull();

    act(() => {
      window.history.pushState({}, '', '/visio/abc-XYZ-9');
      document.title = 'Nouvelle salle';
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.activeVisioType).toBe('marque_meet');
    expect(result.current.roomCode).toBe('abc-XYZ-9');
    expect(result.current.visioTitle).toBe('Nouvelle salle');
  });

  it('réinitialise l’état quand on quitte la visio (popstate vers une URL neutre)', () => {
    window.history.pushState({}, '', '/visio/room-1');
    const { result } = renderHook(() => useVisioDetection());

    expect(result.current.activeVisioType).toBe('marque_meet');

    act(() => {
      window.history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.activeVisioType).toBeNull();
    expect(result.current.visioUrl).toBeNull();
    expect(result.current.roomCode).toBeNull();
  });

  it('détecte la navigation SPA via MutationObserver (mutation du body)', async () => {
    const { result } = renderHook(() => useVisioDetection());

    expect(result.current.activeVisioType).toBeNull();

    await act(async () => {
      window.history.pushState({}, '', '/visio/spa-room');
      const div = document.createElement('div');
      document.body.appendChild(div);
      // Laisser le MutationObserver se déclencher (microtask)
      await Promise.resolve();
    });

    expect(result.current.activeVisioType).toBe('marque_meet');
    expect(result.current.roomCode).toBe('spa-room');
  });

  it('nettoie le listener popstate au démontage', () => {
    const { result, unmount } = renderHook(() => useVisioDetection());

    expect(result.current.activeVisioType).toBeNull();
    unmount();

    // Après démontage, le popstate ne doit plus provoquer d’erreur ni de mise à jour
    window.history.pushState({}, '', '/visio/after-unmount');
    expect(() => window.dispatchEvent(new PopStateEvent('popstate'))).not.toThrow();
  });
});

describe('detectVisioLink', () => {
  it('détecte un lien OpenPulse Meet avec son roomCode', () => {
    const res = detectVisioLink('Rejoins-moi sur /visio/ma-salle-123 stp');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('marque_meet');
    expect(res?.url).toBe('/visio/ma-salle-123');
    expect(res?.roomCode).toBe('ma-salle-123');
  });

  it('détecte un lien Google Meet avec le code formaté xxx-xxxx-xxx', () => {
    const res = detectVisioLink('Lien : https://meet.google.com/abc-defg-hij merci');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('google_meet');
    expect(res?.url).toBe('https://meet.google.com/abc-defg-hij');
    expect(res?.roomCode).toBe('abc-defg-hij');
  });

  it('détecte un lien Teams meetup-join sans roomCode', () => {
    const res = detectVisioLink(
      'Réunion : https://teams.microsoft.com/l/meetup-join/19%3ameeting_x ici'
    );
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('teams');
    expect(res?.url).toBe('https://teams.microsoft.com/l/meetup-join/19%3ameeting_x');
    expect(res?.roomCode).toBeUndefined();
  });

  it('détecte un lien Zoom avec son identifiant numérique', () => {
    const res = detectVisioLink('Zoom : https://us02.zoom.us/j/123456789?pwd=ok fin');
    expect(res).not.toBeNull();
    expect(res?.provider).toBe('zoom');
    expect(res?.url).toBe('https://us02.zoom.us/j/123456789?pwd=ok');
    expect(res?.roomCode).toBe('123456789');
  });

  it.each<[string, string]>([
    ['texte sans lien', 'Bonjour, comment ça va ?'],
    ['google meet au mauvais format', 'https://meet.google.com/abcd'],
    ['zoom sans /j/', 'https://zoom.us/about'],
    ['chaîne vide', ''],
  ])('retourne null pour %s', (_label, text) => {
    expect(detectVisioLink(text)).toBeNull();
  });

  it('priorise OpenPulse Meet quand plusieurs liens sont présents', () => {
    const res = detectVisioLink(
      '/visio/prioritaire et aussi https://meet.google.com/abc-defg-hij'
    );
    expect(res?.provider).toBe('marque_meet');
    expect(res?.roomCode).toBe('prioritaire');
  });

  it('expose un type de provider cohérent', () => {
    const providers: VisioProvider[] = ['marque_meet', 'google_meet', 'teams', 'zoom', 'other'];
    const res = detectVisioLink('/visio/typed');
    expect(res).not.toBeNull();
    if (res) {
      expect(providers).toContain(res.provider);
    }
  });
});