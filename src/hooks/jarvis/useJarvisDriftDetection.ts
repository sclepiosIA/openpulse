/**
 * useJarvisDriftDetection - Détection de drift entre contenu généré et contenu final
 * 
 * Permet à Jarvis d'apprendre passivement quand l'utilisateur modifie
 * significativement le contenu qu'il a généré (emails, tâches, réponses).
 * 
 * Ce feedback implicite améliore la qualité des générations futures.
 */

import { useCallback, useRef } from 'react';
import { debug } from '@/lib/debug';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';

interface GeneratedContent {
  id: string;
  type: 'email' | 'task' | 'response' | 'contract' | 'document';
  originalContent: string;
  generatedAt: number;
  metadata?: Record<string, unknown>;
}

interface DriftResult {
  driftPercentage: number;
  isSignificant: boolean;
  feedbackRecorded: boolean;
}

// Calcul de distance de Levenshtein optimisé
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  // Optimisation pour chaînes vides
  if (m === 0) return n;
  if (n === 0) return m;
  
  // Utiliser une seule rangée pour économiser la mémoire
  let prevRow = Array.from({ length: n + 1 }, (_, i) => i);
  let currRow = new Array(n + 1);
  
  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    
    [prevRow, currRow] = [currRow, prevRow];
  }
  
  return prevRow[n];
}

// Calcul du pourcentage de drift
function calculateDrift(original: string, final: string): number {
  const longerLength = Math.max(original.length, final.length);
  if (longerLength === 0) return 0;
  
  const distance = levenshteinDistance(original, final);
  return distance / longerLength;
}

// Normalisation du texte pour comparaison équitable
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]+/g, '');
}

export function useJarvisDriftDetection() {
  const { user } = useAuth();
  const pendingTrackingRef = useRef<Map<string, GeneratedContent>>(new Map());

  /**
   * Enregistre un contenu généré par Jarvis pour tracking ultérieur
   */
  const trackGeneratedContent = useCallback((
    id: string,
    type: GeneratedContent['type'],
    content: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!user?.id) return;

    pendingTrackingRef.current.set(id, {
      id,
      type,
      originalContent: content,
      generatedAt: Date.now(),
      metadata,
    });

    debug.log(`[DriftDetection] Tracking content: ${id} (${type})`);

    // Auto-cleanup après 10 minutes (l'utilisateur a probablement abandonné)
    setTimeout(() => {
      if (pendingTrackingRef.current.has(id)) {
        pendingTrackingRef.current.delete(id);
        debug.log(`[DriftDetection] Auto-cleaned expired tracking: ${id}`);
      }
    }, 10 * 60 * 1000);
  }, [user?.id]);

  /**
   * Enregistre le contenu final après modification par l'utilisateur
   */
  const recordFinalContent = useCallback(async (
    id: string,
    finalContent: string
  ): Promise<DriftResult> => {
    const tracked = pendingTrackingRef.current.get(id);
    
    if (!tracked || !user?.id) {
      return {
        driftPercentage: 0,
        isSignificant: false,
        feedbackRecorded: false,
      };
    }

    // Calculer le drift
    const normalizedOriginal = normalizeText(tracked.originalContent);
    const normalizedFinal = normalizeText(finalContent);
    const drift = calculateDrift(normalizedOriginal, normalizedFinal);
    const driftPercentage = Math.round(drift * 100);
    
    // Seuil de significance: 20%
    const isSignificant = drift > 0.2;

    debug.log(`[DriftDetection] Content ${id}: drift=${driftPercentage}%, significant=${isSignificant}`);

    // Enregistrer le feedback si le drift est significatif
    let feedbackRecorded = false;
    
    if (isSignificant) {
      try {
        // Déterminer le score de feedback basé sur le drift
        // Plus le drift est élevé, plus le score est bas (suggestion moins bonne)
        let feedbackScore: number;
        if (drift > 0.7) {
          feedbackScore = 1; // Très mauvais - complètement réécrit
        } else if (drift > 0.5) {
          feedbackScore = 2; // Mauvais - modification majeure
        } else if (drift > 0.3) {
          feedbackScore = 3; // Moyen - modification notable
        } else {
          feedbackScore = 4; // OK - modification mineure mais significative
        }

        const { error } = await supabase
          .from('jarvis_learning_data')
          .insert({
            user_id: user.id,
            action_type: `${tracked.type}_correction`,
            accepted: true, // L'utilisateur a quand même utilisé le contenu
            feedback_score: feedbackScore,
            metadata: {
              original_length: tracked.originalContent.length,
              final_length: finalContent.length,
              drift_percentage: driftPercentage,
              generation_to_validation_ms: Date.now() - tracked.generatedAt,
              content_type: tracked.type,
              ...tracked.metadata,
            },
          } as never);

        if (error) {
          debug.error('[DriftDetection] Failed to record feedback:', error);
        } else {
          feedbackRecorded = true;
          debug.log(`[DriftDetection] Feedback recorded: score=${feedbackScore}`);
        }
      } catch (error) {
        debug.error('[DriftDetection] Error recording feedback:', error);
      }
    }

    // Nettoyer le tracking
    pendingTrackingRef.current.delete(id);

    return {
      driftPercentage,
      isSignificant,
      feedbackRecorded,
    };
  }, [user?.id]);

  /**
   * Annule le tracking d'un contenu (ex: utilisateur a annulé l'action)
   */
  const cancelTracking = useCallback((id: string) => {
    if (pendingTrackingRef.current.has(id)) {
      pendingTrackingRef.current.delete(id);
      debug.log(`[DriftDetection] Tracking cancelled: ${id}`);
    }
  }, []);

  /**
   * Vérifie si un contenu est en cours de tracking
   */
  const isTracking = useCallback((id: string): boolean => {
    return pendingTrackingRef.current.has(id);
  }, []);

  /**
   * Obtient le nombre de contenus actuellement trackés
   */
  const getTrackingCount = useCallback((): number => {
    return pendingTrackingRef.current.size;
  }, []);

  return {
    trackGeneratedContent,
    recordFinalContent,
    cancelTracking,
    isTracking,
    getTrackingCount,
  };
}

export default useJarvisDriftDetection;
