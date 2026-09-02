import { useCallback } from 'react';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export function useErrorHandler() {
  const handleError = useCallback((error: unknown, context: string) => {
    const safeMessage = sanitizeSupabaseError(error);
    
    debug.error(`[${context}]`, error);
    
    toast.error(safeMessage, {
      description: `Contexte : ${context}`,
    });
  }, []);

  return { handleError };
}
