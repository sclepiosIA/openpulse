import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';

type EditorAction = 'improve' | 'reformulate' | 'translate' | 'shorten' | 'expand';

interface EditorResult {
  result: string;
  action: EditorAction;
  original: string;
}

export function usePulseAIEditor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processContent = useCallback(async (
    content: string,
    action: EditorAction,
    targetLanguage?: string
  ): Promise<string | null> => {
    if (!content.trim()) return null;
    
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('pulse-ai-editor', {
        body: {
          content,
          action,
          target_language: targetLanguage,
        },
      });

      if (error) throw error;

      const result = data as EditorResult;
      return result.result;
    } catch (error: unknown) {
      debug.error('AI Editor error:', error);
      toast({
        title: 'Erreur IA',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const improve = useCallback((content: string) => processContent(content, 'improve'), [processContent]);
  const reformulate = useCallback((content: string) => processContent(content, 'reformulate'), [processContent]);
  const translate = useCallback((content: string, lang = 'anglais') => processContent(content, 'translate', lang), [processContent]);
  const shorten = useCallback((content: string) => processContent(content, 'shorten'), [processContent]);
  const expand = useCallback((content: string) => processContent(content, 'expand'), [processContent]);

  return {
    isProcessing,
    improve,
    reformulate,
    translate,
    shorten,
    expand,
  };
}
