import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle, History, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from '@/lib/debug';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ManualSyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFullSync, setIsFullSync] = useState(false);
  const [isHistoricalBackfill, setIsHistoricalBackfill] = useState(false);
  const [lastSync, setLastSync] = useState<{
    emailsFetched: number;
    threadsProcessed: number;
    suggestionsGenerated: number;
    timestamp: string;
  } | null>(null);

  const handleSync = async (fullResync: boolean = false) => {
    if (fullResync && !window.confirm(
      "⚠️ SYNCHRONISATION COMPLÈTE\n\n" +
      "Cette opération va récupérer TOUS vos emails historiques.\n" +
      "Cela peut prendre plusieurs minutes.\n\n" +
      "Continuer ?"
    )) {
      return;
    }
    setIsLoading(true);
    setIsFullSync(fullResync);
    
    try {
      // Check for concurrent sync (soft lock)
      const { data: runningSync } = await supabase
        .from("email_sync_logs")
        .select("id")
        .eq("status", "running")
        .gte("execution_start", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (runningSync) {
        toast.info("Une synchronisation est déjà en cours, réessayez dans quelques minutes");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "hourly-email-sync-and-analysis",
        {
          body: { mode: "manual", full_resync: fullResync },
        }
      );

      if (error) throw error;

      setLastSync({
        emailsFetched: data.summary?.emails_fetched || 0,
        threadsProcessed: data.summary?.unprocessed_threads_found || 0,
        suggestionsGenerated: data.summary?.ai_analyses_performed || 0,
        timestamp: new Date().toLocaleString("fr-FR"),
      });

      const summary = data.summary || {};
      const detailedMessage = fullResync 
        ? `✅ Synchronisation complète terminée\n📧 ${summary.emails_fetched || 0} emails traités\n🧵 ${summary.new_threads_created || 0} nouveaux threads\n🔄 ${summary.existing_threads_updated || 0} threads mis à jour`
        : `✅ Synchronisation terminée\n📧 ${summary.emails_fetched || 0} emails traités\n🧵 Threads: ${summary.new_threads_created || 0} nouveaux / ${summary.existing_threads_updated || 0} mis à jour\n🤖 ${summary.ai_analyses_performed || 0} analyses IA`;
      
      toast.success(detailedMessage);
    } catch (error: unknown) {
      debug.error("Sync error:", error);
      const errorMessage = sanitizeSupabaseError(error);
      toast.error(`Erreur lors de la synchronisation : ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsFullSync(false);
    }
  };

  const handleHistoricalBackfill = async () => {
    if (isLoading) {
      toast.error("Une synchronisation est déjà en cours");
      return;
    }

    const confirmed = window.confirm(
      "⚠️ Synchronisation historique complète\n\n" +
      "Cette opération va :\n" +
      "✅ Récupérer TOUS les emails manquants depuis l'origine de votre boîte mail\n" +
      "✅ Ne PAS retélécharger les emails déjà synchronisés\n" +
      "✅ Ne PAS relancer les appels IA sur les emails existants\n" +
      "⏱️ Durée estimée : 5-15 minutes pour plusieurs milliers d'emails\n\n" +
      "Voulez-vous continuer ?"
    );

    if (!confirmed) return;

    setIsLoading(true);
    setIsHistoricalBackfill(true);

    try {
      // Check for concurrent sync (soft lock)
      const { data: runningSync } = await supabase
        .from("email_sync_logs")
        .select("id")
        .eq("status", "running")
        .gte("execution_start", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (runningSync) {
        toast.info("Une synchronisation est déjà en cours, réessayez dans quelques minutes");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "hourly-email-sync-and-analysis",
        {
          body: {
            mode: "manual",
            historical_backfill: true  // Nouveau paramètre
          }
        }
      );

      if (error) throw error;

      setLastSync({
        emailsFetched: data.summary?.emails_fetched || 0,
        threadsProcessed: data.summary?.unprocessed_threads_found || 0,
        suggestionsGenerated: data.summary?.ai_analyses_performed || 0,
        timestamp: new Date().toLocaleString("fr-FR"),
      });

      const summary = data.summary || {};
      const remaining = summary.remaining_estimate || 0;
      
      const detailedMessage = remaining > 0
        ? `✅ Synchronisation historique en cours\n📧 ${summary.emails_fetched || 0} emails récupérés\n🧵 ${summary.new_threads_created || 0} nouveaux threads\n⏳ Environ ${remaining} emails restants\n💡 Relancez pour continuer`
        : `✅ Synchronisation historique terminée !\n📧 ${summary.emails_fetched || 0} emails récupérés\n🧵 ${summary.new_threads_created || 0} nouveaux threads\n🤖 ${summary.ai_analyses_performed || 0} analyses IA`;
      
      toast.success(detailedMessage);
    } catch (error: unknown) {
      debug.error("Historical backfill error:", error);
      const errorMessage = sanitizeSupabaseError(error);
      toast.error(`Erreur lors de la synchronisation historique : ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsHistoricalBackfill(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Synchronisation Manuelle
        </CardTitle>
        <CardDescription>
          Déclencher manuellement la synchronisation et l'analyse IA des emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            onClick={() => handleSync(false)}
            disabled={isLoading}
            variant="default"
            size="lg"
            className="w-full"
          >
            {isLoading && !isFullSync && !isHistoricalBackfill ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sync...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync rapide
              </>
            )}
          </Button>

          <Button
            onClick={() => handleSync(true)}
            disabled={isLoading}
            variant="outline"
            size="lg"
            className="w-full"
          >
            {isLoading && isFullSync ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sync complète...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync complète
              </>
            )}
          </Button>

          <Button
            onClick={handleHistoricalBackfill}
            disabled={isLoading}
            variant="default"
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading && isHistoricalBackfill ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sync historique...
              </>
            ) : (
              <>
                <History className="mr-2 h-4 w-4" />
                Sync historique
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Sync rapide :</strong> Récupère les nouveaux emails depuis la dernière synchronisation</p>
          <p><strong>Sync complète :</strong> Récupère tous les emails de la dernière année</p>
          <p><strong>Sync historique :</strong> Récupère TOUS les emails manquants (intelligent)</p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">Synchronisation historique intelligente</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Récupère uniquement les emails manquants</li>
                <li>Ne retélécharge pas les emails déjà synchronisés</li>
                <li>Ne relance pas les appels IA sur les threads existants</li>
                <li>Peut prendre 5-15 minutes pour plusieurs milliers d'emails</li>
              </ul>
            </div>
          </div>
        </div>

        {lastSync && (
          <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Dernière synchronisation : {lastSync.timestamp}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">Emails</div>
                <div className="font-semibold">{lastSync.emailsFetched}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Threads</div>
                <div className="font-semibold">{lastSync.threadsProcessed}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Suggestions</div>
                <div className="font-semibold">
                  {lastSync.suggestionsGenerated}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-amber-800 dark:text-amber-200">
            <strong>Note :</strong> La synchronisation automatique s'exécute toutes
            les heures. Ce bouton est utile pour tester immédiatement le système.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
