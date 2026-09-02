import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from "@/lib/debug";

interface ClassificationResult {
  matched: number;
  suggested: number;
  hors: number;
  interne: number;
  total: number;
  remaining?: number;
  completed?: boolean;
  timedOut?: boolean;
}

export interface ClassificationParams {
  batchSize?: number;
  processAll?: boolean;
  onProgress?: (progress: { 
    current: number; 
    total: number; 
    matched: number; 
    suggested: number;
    elapsed?: number;
  }) => void;
}

export function useManualEmailClassification() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (params: ClassificationParams = {}): Promise<ClassificationResult> => {
      const { processAll = false, batchSize = 100, onProgress } = params;
      if (!processAll) {
        // Mode rapide: un seul pass
        const { data, error } = await supabase.functions.invoke('auto-match-emails', {
          body: { batchSize }
        });

        if (error) throw error;

        return {
          matched: data.matched || 0,
          suggested: data.suggested || 0,
          hors: data.hors || 0,
          interne: data.interne || 0,
          total: data.processed || 0,
          remaining: data.remaining || 0,
          completed: data.completed || false
        };
      }

      // Mode complet: itération jusqu'à la fin
      let totalMatched = 0, totalSuggested = 0, totalHors = 0, totalInterne = 0, totalProcessed = 0;
      let pass = 0;
      const maxPasses = 100; // Augmenté de 20 à 100 (permet 10 000 emails)
      const MAX_DURATION_MS = 5 * 60 * 1000; // Timeout de sécurité: 5 minutes
      const startTime = Date.now();
      let completed = false;

      debug.log('🚀 Début classification complète (max 10 000 emails, timeout 5min)');

      while (pass < maxPasses && !completed) {
        // Vérifier le timeout de sécurité
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_DURATION_MS) {
          debug.log('⏱️ Timeout de sécurité atteint (5 min) - arrêt de la classification');
          break;
        }

        pass++;
        const elapsedSec = Math.round(elapsed / 1000);
        debug.log(`📦 Pass ${pass}/${maxPasses} (${elapsedSec}s écoulées)`);

        try {
          const { data, error } = await supabase.functions.invoke('auto-match-emails', {
            body: { batchSize }
          });

          if (error) {
            debug.error(`❌ Erreur pass ${pass}:`, error);
            throw error;
          }

          totalMatched += data.matched || 0;
          totalSuggested += data.suggested || 0;
          totalHors += data.hors || 0;
          totalInterne += data.interne || 0;
          totalProcessed += data.processed || 0;
          completed = data.completed || false;

          const remaining = data.remaining || 0;
          debug.log(`✅ Pass ${pass}: +${data.processed} traités (${remaining} restants)`);

          // Appeler onProgress si fourni avec temps écoulé
          if (onProgress) {
            const currentElapsed = Math.round((Date.now() - startTime) / 1000);
            onProgress({
              current: totalProcessed,
              total: totalProcessed + remaining,
              matched: totalMatched,
              suggested: totalSuggested,
              elapsed: currentElapsed,
            });
          }

          if (completed || remaining === 0) {
            debug.log('🎉 Classification complète terminée');
            break;
          }

          // Attendre 400ms entre les passes pour laisser la DB se stabiliser
          await new Promise(resolve => setTimeout(resolve, 400));

        } catch (passError) {
          debug.error(`❌ Erreur critique pass ${pass}:`, passError);
          throw passError;
        }
      }

      debug.log(`🎯 Résumé final (${pass} passes): Traités: ${totalProcessed}, Attribués: ${totalMatched}, Suggestions: ${totalSuggested}, Hors: ${totalHors}, Interne: ${totalInterne}`);

      return {
        matched: totalMatched,
        suggested: totalSuggested,
        hors: totalHors,
        interne: totalInterne,
        total: totalProcessed,
        completed
      };
    },
    onSuccess: (data) => {
      // Message détaillé et consolidé
      const parts = [];
      
      if (data.matched > 0) {
        parts.push(`✅ ${data.matched} email${data.matched > 1 ? 's' : ''} attribué${data.matched > 1 ? 's' : ''}`);
      }
      if (data.suggested > 0) {
        parts.push(`💡 ${data.suggested} suggestion${data.suggested > 1 ? 's' : ''} créée${data.suggested > 1 ? 's' : ''}`);
      }
      if (data.hors > 0) {
        parts.push(`🏠 ${data.hors} hors établissement`);
      }
      if (data.interne > 0) {
        parts.push(`🏢 ${data.interne} interne${data.interne > 1 ? 's' : ''}`);
      }

      const message = data.completed 
        ? `🎉 Classification complète terminée !\n${parts.join(' • ')}`
        : `Classification effectuée (${data.total} traité${data.total > 1 ? 's' : ''})\n${parts.join(' • ')}`;
      
      // Toast avec action si des suggestions existent
      if (data.suggested > 0) {
        toast.success(message, {
          duration: 8000,
          action: {
            label: 'Voir les suggestions',
            onClick: () => {
              navigate('/emails?tab=suggestions');
            },
          },
        });
      } else {
        toast.success(message, {
          duration: 5000,
        });
      }
      
      // Invalider toutes les queries pertinentes
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-classification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['email-suggestions-pending'] });
      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['unclassified-domains'] });
    },
    onError: (error: Error) => {
      debug.error('❌ Erreur classification:', error);
      toast.error(sanitizeSupabaseError(error), {
        duration: 6000,
      });
    },
  });
}
