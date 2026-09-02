import { useEffect, useState } from "react";
import { debug } from "@/lib/debug";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useEmailClassificationStats } from "@/hooks/email/useEmailClassificationStats";
import {
  Loader2,
  FileText,
  Wrench,
  Shield,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export function EmailMaintenanceActions() {
  const [emptyEmailsCount, setEmptyEmailsCount] = useState<number>(0);
  const [phantomThreadsCount, setPhantomThreadsCount] = useState<number>(0);
  const [repairProgress, setRepairProgress] = useState<{ current: number; total: number } | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [fixingThreads, setFixingThreads] = useState(false);
  
  const { refetch: refetchStats } = useEmailClassificationStats();

  useEffect(() => {
    loadMaintenanceStats();
  }, []);

  const loadMaintenanceStats = async () => {
    // Compter les emails avec body_html null ou vide ET body_text null ou vide
    const { count: nullCount } = await supabase
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .is('body_html', null)
      .is('body_text', null);
    
    const { count: emptyCount } = await supabase
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('body_html', '')
      .eq('body_text', '');
    
    setEmptyEmailsCount((nullCount || 0) + (emptyCount || 0));

    // Compter les threads fantômes via une requête optimisée
    const { data: threadCounts } = await supabase
      .from('email_threads')
      .select(`
        id,
        message_count,
        messages:email_messages(count)
      `)
      .gt('message_count', 0);

    if (threadCounts) {
      const phantomCount = threadCounts.filter(
        (thread: any) => thread.messages[0]?.count === 0
      ).length;
      setPhantomThreadsCount(phantomCount);
    }
  };

  const handleRepairEmptyEmails = async (testMode = false) => {
    if (emptyEmailsCount === 0 && phantomThreadsCount === 0) {
      toast.info("Aucun email vide à réparer");
      return;
    }

    setRepairing(true);
    setRepairProgress({ current: 0, total: testMode ? Math.min(5, emptyEmailsCount) : emptyEmailsCount });
    
    try {
      // Étape 1: Resynchroniser les emails vides
      const { data, error } = await supabase.functions.invoke('resync-empty-emails', {
        body: { testMode }
      });

      if (error) throw error;

      toast.success(
        `Resynchronisation terminée: ${data.fixed} email(s) réparé(s), ${data.failed} échec(s)`
      );
      
      await loadMaintenanceStats();
      
      // Étape 2: Corriger les compteurs et supprimer les threads orphelins
      if (!testMode) {
        toast.info("Correction des compteurs en cours...");
        const { data: fixData, error: fixError } = await supabase.functions.invoke('fix-thread-counters');
        
        if (fixError) throw fixError;
        
        toast.success(
          `Intégrité vérifiée: ${fixData.summary.threads_fixed} corrigé(s), ${fixData.summary.threads_deleted} supprimé(s)`
        );
        
        refetchStats();
      }
    } catch (error: unknown) {
      debug.error('Error repairing emails:', error);
      toast.error('Erreur lors de la réparation');
    } finally {
      setRepairing(false);
      setRepairProgress(null);
    }
  };

  const handleFixThreadCounters = async () => {
    setFixingThreads(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-thread-counters');

      if (error) throw error;

      const phantomDeleted = data.summary?.phantom_threads_deleted || 0;
      const fixed = data.summary?.threads_fixed || 0;
      const deleted = data.summary?.threads_deleted || 0;
      const totalFixed = phantomDeleted + fixed + deleted;

      if (totalFixed === 0) {
        toast.info('Aucun écart détecté - Tous les compteurs sont corrects');
      } else {
        toast.success(
          `Intégrité vérifiée: ${phantomDeleted} fantômes supprimés, ${fixed} corrigé(s), ${deleted} orphelins supprimés`
        );
      }
      
      refetchStats();
      await loadMaintenanceStats();
    } catch (error: unknown) {
      debug.error('Error fixing thread counters:', error);
      toast.error('Erreur lors de la vérification d\'intégrité');
    } finally {
      setFixingThreads(false);
    }
  };

  const hasIssues = emptyEmailsCount > 0 || phantomThreadsCount > 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
            <Wrench className="h-5 w-5" />
            Actions de maintenance
          </h3>
          <p className="text-sm text-muted-foreground">
            Réparer les emails vides et vérifier l'intégrité de la base de données
          </p>
        </div>

        {/* Stats d'intégrité */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Emails vides
            </p>
            <p className={`text-2xl font-bold ${emptyEmailsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {emptyEmailsCount}
            </p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Threads fantômes
            </p>
            <p className={`text-2xl font-bold ${phantomThreadsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {phantomThreadsCount}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleFixThreadCounters}
            disabled={fixingThreads}
            variant="outline"
            size="sm"
          >
            {fixingThreads ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Vérifier l'intégrité
              </>
            )}
          </Button>
          
          <Button 
            onClick={() => handleRepairEmptyEmails(false)}
            disabled={repairing || !hasIssues}
            variant={hasIssues ? "default" : "outline"}
            size="sm"
          >
            {repairing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resync...
              </>
            ) : (
              <>
                <Wrench className="mr-2 h-4 w-4" />
                Resynchroniser ({emptyEmailsCount + phantomThreadsCount})
              </>
            )}
          </Button>
        </div>

        {/* Repair Progress */}
        {repairProgress && (
          <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-900 dark:text-blue-100 font-medium">Réparation en cours...</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {repairProgress.current}/{repairProgress.total}
              </span>
            </div>
            <Progress value={(repairProgress.current / Math.max(repairProgress.total, 1)) * 100} className="h-2" />
          </div>
        )}

        {/* Info message when no issues */}
        {!hasIssues && (
          <div className="flex items-start gap-2 text-sm bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <Shield className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-green-900 dark:text-green-100">
              <p className="font-medium">Base de données saine</p>
              <p className="text-xs mt-1">
                Aucun problème d'intégrité détecté. Vos emails sont correctement synchronisés.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
