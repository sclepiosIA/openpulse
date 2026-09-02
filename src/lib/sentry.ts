import { monitoring } from './monitoring'

export function initSentry() {
  // La logique d'initialisation est maintenant dans monitoring.ts
  // pour centraliser tous les services de monitoring
  monitoring.init()
}