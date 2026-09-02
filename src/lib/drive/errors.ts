/**
 * Messages d'erreur user-friendly pour Gestion Drive (backend Azure).
 *
 * Toute erreur issue de `driveClient` (DriveApiError) ou des uploads Blob
 * est traduite en français actionnable avant affichage dans /documents.
 * Les erreurs métier déjà localisées (ex. « Fichier trop volumineux… »)
 * sont propagées telles quelles.
 */
import { DriveApiError } from './types';

export const DRIVE_GENERIC_ERROR =
  'Une erreur inattendue est survenue côté Gestion Drive.';

/**
 * Traduit une erreur Drive en message lisible par l'utilisateur final.
 * Ne renvoie jamais de stack/endpoint brut.
 */
export function driveErrorMessage(error: unknown, fallback = DRIVE_GENERIC_ERROR): string {
  if (error instanceof DriveApiError) {
    if (error.status === null) {
      if (error.message.includes('VITE_DRIVE_API_URL')) {
        return "L'API Gestion Drive n'est pas configurée sur cet environnement.";
      }
      return 'Gestion Drive est injoignable. Vérifiez votre connexion puis réessayez.';
    }
    switch (error.status) {
      case 401:
        return 'Votre session a expiré. Reconnectez-vous pour accéder à Gestion Drive.';
      case 403:
        return "Vous n'avez pas les droits nécessaires pour cette action.";
      case 404:
        return 'Élément introuvable dans Gestion Drive (peut-être supprimé ou déplacé).';
      case 409:
        return 'Conflit : cet élément a été modifié entre-temps. Actualisez puis réessayez.';
      case 413:
        return 'Fichier trop volumineux pour Gestion Drive.';
      case 422:
        return 'Requête invalide : vérifiez les informations saisies.';
      case 429:
        return 'Trop de requêtes vers Gestion Drive. Patientez quelques secondes.';
      default:
        if (error.status >= 500) {
          return 'Le service Gestion Drive rencontre un incident. Réessayez dans quelques instants.';
        }
        return `Erreur Gestion Drive (HTTP ${error.status}).`;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
