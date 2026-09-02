let _isThirdPartyIframe: boolean | null = null;
let _isApercuTiers: boolean | null = null;

/**
 * Détecte si on est dans un environnement d aperçu tiers (preview ou published)
 */
export function isApercuTiers(): boolean {
  if (_isApercuTiers !== null) return _isApercuTiers;
  
  try {
    const origin = window.location.origin;
    _isApercuTiers = origin.includes('.apercu.example.org') || 
                            origin.includes('.previsualisation.example.org');
    return _isApercuTiers;
  } catch {
    _isApercuTiers = false;
    return false;
  }
}

/**
 * Détecte si l'application s'exécute dans une iframe tierce
 * (contexte où certaines APIs comme localStorage peuvent être bloquées)
 * Note: Les environnement d aperçu tiers sont considérés comme "trusted"
 */
export function isThirdPartyIframe(): boolean {
  if (_isThirdPartyIframe !== null) return _isThirdPartyIframe;
  
  try {
    // Les environnement d aperçu tiers sont toujours "trusted" même en iframe
    if (isApercuTiers()) {
      _isThirdPartyIframe = false;
      return false;
    }
    
    const isInIframe = window.self !== window.top;
    const hasReferrer = Boolean(document.referrer);
    const isSameOrigin = document.referrer.includes(window.location.origin);
    
    const result = isInIframe && hasReferrer && !isSameOrigin;
    _isThirdPartyIframe = result;
    return result;
  } catch {
    _isThirdPartyIframe = true;
    return true;
  }
}
