/**
 * Utilitaires pour le feedback haptique mobile
 * Fonctionne sur les appareils qui supportent l'API Vibration
 */

/**
 * Déclenche une vibration simple ou pattern
 * @param pattern - Durée en ms ou pattern [vibration, pause, vibration, ...]
 */
export function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Feedback haptique pour succès d'action
 */
export function vibrateSuccess(): void {
  vibrate(50);
}

/**
 * Feedback haptique pour erreur
 */
export function vibrateError(): void {
  vibrate([100, 50, 100]);
}

/**
 * Feedback haptique pour sélection
 */
export function vibrateSelection(): void {
  vibrate(30);
}

/**
 * Feedback haptique pour long press
 */
export function vibrateLongPress(): void {
  vibrate([50, 100, 50]);
}

/**
 * Arrête toute vibration en cours
 */
export function cancelVibrate(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
}
