import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export function ManualEmailAnalysisTrigger() {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    total: number;
    processed: number;
    contactsCreated: number;
    errors: number;
  } | null>(null);

  const handleManualAnalysis = async () => {
    setAnalyzing(true);
    setProgress(0);
    setStats(null);

    try {
      // 1. Récupérer les threads non traités
      const { data: threads, error: threadsError } = await supabase
        .from('email_threads')
        .select('id, subject, etablissement_id, partenaire_id, groupe_id')
        .is('ai_last_processed_at', null)
        .limit(50);

      if (threadsError) throw threadsError;

      if (!threads || threads.length === 0) {
        toast.info("Aucun email à traiter");
        setAnalyzing(false);
        return;
      }

      const total = threads.length;
      let processed = 0;
      let contactsCreated = 0;
      let errors = 0;

      setStats({ total, processed, contactsCreated, errors });

      // 2. Traiter chaque thread
      for (const thread of threads) {
        try {
          // Appel à process-email-with-ai
          const { data: processData, error: processError } = await supabase.functions.invoke(
            'process-email-with-ai',
            {
              body: { thread_id: thread.id }
            }
          );

          if (processError) throw processError;

          // Compter les contacts créés
          if (processData?.contacts_created) {
            contactsCreated += processData.contacts_created;
          }

          processed++;
          setProgress((processed / total) * 100);
          setStats({ total, processed, contactsCreated, errors });

        } catch (error) {
          debug.error(`Error processing thread ${thread.id}:`, error);
          errors++;
          processed++;
          setProgress((processed / total) * 100);
          setStats({ total, processed, contactsCreated, errors });
        }
      }

      toast.success(
        `Analyse terminée : ${contactsCreated} contact${contactsCreated > 1 ? 's' : ''} créé${contactsCreated > 1 ? 's' : ''} sur ${processed} emails traités`
      );

    } catch (error: unknown) {
      debug.error('Error during manual analysis:', error);
      toast.error(`Erreur lors de l'analyse : ${sanitizeSupabaseError(error)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Analyse IA manuelle
        </CardTitle>
        <CardDescription>
          Traiter les emails non analysés pour extraire automatiquement les contacts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && analyzing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression</span>
              <span className="text-muted-foreground">
                {stats.processed}/{stats.total} emails
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{stats.contactsCreated}</span> contacts créés
              </div>
              <div>
                <span className="font-medium text-foreground">{stats.processed}</span> traités
              </div>
              <div>
                <span className="font-medium text-destructive">{stats.errors}</span> erreurs
              </div>
            </div>
          </div>
        )}

        {stats && !analyzing && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium">Dernière analyse :</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div>Emails traités : <span className="font-medium text-foreground">{stats.processed}</span></div>
              <div>Contacts créés : <span className="font-medium text-foreground">{stats.contactsCreated}</span></div>
            </div>
          </div>
        )}

        <Button
          onClick={handleManualAnalysis}
          disabled={analyzing}
          className="w-full"
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Analyser les emails non traités
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
