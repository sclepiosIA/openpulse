import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export function RegenerateDetailedSummariesButton() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    total: number;
    processed: number;
    errors: number;
  } | null>(null);

  const handleRegenerate = async () => {
    setProcessing(true);
    setProgress(0);
    setStats(null);

    try {
      // Récupérer les threads déjà traités mais sans résumé détaillé
      const { data: threads, error: threadsError } = await supabase
        .from('email_threads')
        .select('id')
        .not('ai_last_processed_at', 'is', null)
        .is('ai_detailed_summary', null)
        .limit(100);

      if (threadsError) throw threadsError;

      if (!threads || threads.length === 0) {
        toast.info("Tous les threads ont déjà un résumé détaillé");
        setProcessing(false);
        return;
      }

      const total = threads.length;
      let processed = 0;
      let errors = 0;

      setStats({ total, processed, errors });

      for (const thread of threads) {
        try {
          const { error: processError } = await supabase.functions.invoke(
            'process-email-with-ai',
            { body: { thread_id: thread.id } }
          );

          if (processError) throw processError;
          processed++;
        } catch (error) {
          debug.error(`Error processing thread ${thread.id}:`, error);
          errors++;
          processed++;
        }

        setProgress((processed / total) * 100);
        setStats({ total, processed, errors });
      }

      toast.success(
        `Régénération terminée : ${processed - errors} résumés mis à jour sur ${total} threads`
      );
    } catch (error: unknown) {
      debug.error('Error during regeneration:', error);
      toast.error(`Erreur : ${sanitizeSupabaseError(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Régénérer les résumés détaillés
        </CardTitle>
        <CardDescription>
          Régénérer les résumés IA pour inclure un résumé détaillé des threads existants
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && processing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression</span>
              <span className="text-muted-foreground">
                {stats.processed}/{stats.total} threads
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{stats.processed - stats.errors}</span> mis à jour
              </div>
              <div>
                <span className="font-medium text-destructive">{stats.errors}</span> erreurs
              </div>
            </div>
          </div>
        )}

        {stats && !processing && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium">Dernière régénération :</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div>Threads traités : <span className="font-medium text-foreground">{stats.processed}</span></div>
              <div>Erreurs : <span className="font-medium text-destructive">{stats.errors}</span></div>
            </div>
          </div>
        )}

        <Button
          onClick={handleRegenerate}
          disabled={processing}
          className="w-full"
          variant="outline"
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Régénération en cours...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Régénérer les résumés manquants
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
