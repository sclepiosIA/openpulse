/**
 * Tests driveErrorMessage — traduction des erreurs Drive en messages
 * français actionnables (jamais de stack/endpoint brut).
 */
import { driveErrorMessage, DRIVE_GENERIC_ERROR } from './errors';
import { DriveApiError } from './types';

describe('driveErrorMessage', () => {
  it('API non configurée → message de configuration', () => {
    const error = new DriveApiError(
      "VITE_DRIVE_API_URL n'est pas configurée : API Gestion Drive indisponible.",
      '/api/drive/spaces',
    );
    expect(driveErrorMessage(error)).toMatch(/n'est pas configurée/i);
  });

  it('erreur réseau (status null) → message de connexion', () => {
    const error = new DriveApiError('Appel Drive API impossible (offline)', '/api/drive/tree');
    expect(driveErrorMessage(error)).toMatch(/injoignable/i);
  });

  it.each([
    [401, /session a expiré/i],
    [403, /droits nécessaires/i],
    [404, /introuvable/i],
    [409, /conflit/i],
    [413, /trop volumineux/i],
    [422, /invalide/i],
    [429, /trop de requêtes/i],
    [500, /incident/i],
    [503, /incident/i],
  ])('HTTP %i → message dédié', (status, expected) => {
    const error = new DriveApiError(`Drive API → HTTP ${status}`, '/api/drive/spaces', status);
    expect(driveErrorMessage(error)).toMatch(expected);
  });

  it('HTTP 4xx inconnu → message générique avec status', () => {
    const error = new DriveApiError('Drive API → HTTP 418', '/api/drive/spaces', 418);
    expect(driveErrorMessage(error)).toContain('418');
  });

  it('Error standard → message propagé tel quel', () => {
    expect(driveErrorMessage(new Error('Fichier trop volumineux (max 200 Mo).'))).toBe(
      'Fichier trop volumineux (max 200 Mo).',
    );
  });

  it('Error vide / inconnu → fallback', () => {
    expect(driveErrorMessage(new Error('   '))).toBe(DRIVE_GENERIC_ERROR);
    expect(driveErrorMessage(null)).toBe(DRIVE_GENERIC_ERROR);
    expect(driveErrorMessage('boom')).toBe(DRIVE_GENERIC_ERROR);
    expect(driveErrorMessage(undefined, 'Custom')).toBe('Custom');
  });
});
