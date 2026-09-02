import { useState, useCallback } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  ListTodo,
  RefreshCw,
  Clock,
} from "lucide-react";
import { fetchScannableThreads, processEmailWithAi } from "@/services/email/processEmailWithAi";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

interface ScanStats {
  total: number;
  processed: number;
  tasksCreated: number;
  tasksUpdated: number;
  contactsCreated: number;
  errors: number;
}

type ScanPeriod = "24" | "48" | "72";

export function EmailTaskScanButton() {
  const [scanning, setScanning] = useState(false);
  const [period, setPeriod] = useState<ScanPeriod>("24");
  const [stats, setStats] = useState<ScanStats>({
    total: 0,
    processed: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    contactsCreated: 0,
    errors: 0,
  });
  const [lastScanStats, setLastScanStats] = useState<ScanStats | null>(null);

  const progress = stats.total > 0 ? (stats.processed / stats.total) * 100 : 0;

  const handleScan = useCallback(async () => {
    setScanning(true);
    setStats({
      total: 0,
      processed: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      contactsCreated: 0,
      errors: 0,
    });

    try {
      // Calculer la date de début selon la période
      const hoursAgo = parseInt(period);

      // Récupérer les threads récents liés à un établissement ou partenaire
      let threads;
      try {
        threads = await fetchScannableThreads(hoursAgo);
      } catch (fetchErr) {
        throw new Error((fetchErr as Error).message);
      }

      if (!threads || threads.length === 0) {
        toast.info(`Aucun email à analyser sur les ${hoursAgo}h`);
        setScanning(false);
        return;
      }

      setStats(prev => ({ ...prev, total: threads.length }));
      toast.info(`Analyse de ${threads.length} emails en cours...`);

      let tasksCreated = 0;
      let tasksUpdated = 0;
      let contactsCreated = 0;
      let errors = 0;

      // Traiter les threads par batch de 5 pour éviter la surcharge
      const batchSize = 5;
      for (let i = 0; i < threads.length; i += batchSize) {
        const batch = threads.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (thread) => {
            try {
              try {
                const data = await processEmailWithAi({
                  threadId: thread.id,
                  forceReprocess: true,
                });
                if (data.tasks_created) tasksCreated += data.tasks_created;
                if (data.tasks_updated) tasksUpdated += data.tasks_updated;
                if (data.contacts_created) contactsCreated += data.contacts_created;
              } catch (invokeErr) {
                debug.error(`Erreur traitement ${thread.id}:`, invokeErr);
                errors++;
              }
            } catch (e) {
              debug.error(`Exception thread ${thread.id}:`, e);
              errors++;
            }

            setStats(prev => ({
              ...prev,
              processed: prev.processed + 1,
              tasksCreated,
              tasksUpdated,
              contactsCreated,
              errors,
            }));
          })
        );
      }

      const finalStats: ScanStats = {
        total: threads.length,
        processed: threads.length,
        tasksCreated,
        tasksUpdated,
        contactsCreated,
        errors,
      };

      setLastScanStats(finalStats);
      
      if (tasksCreated > 0 || tasksUpdated > 0) {
        toast.success(
          `Scan terminé : ${tasksCreated} tâche(s) créée(s), ${tasksUpdated} mise(s) à jour`
        );
      } else if (errors === 0) {
        toast.success("Scan terminé : aucune nouvelle tâche détectée");
      } else {
        toast.warning(`Scan terminé avec ${errors} erreur(s)`);
      }
    } catch (error: unknown) {
      debug.error("Erreur de scan:", error);
      toast.error(`Erreur: ${sanitizeSupabaseError(error)}`);
    } finally {
      setScanning(false);
    }
  }, [period]);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListTodo className="h-4 w-4" />
          Scanner les emails récents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sélection de la période */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Période
          </label>
          <ToggleGroup 
            type="single" 
            value={period} 
            onValueChange={(val) => val && setPeriod(val as ScanPeriod)}
            className="justify-start"
            disabled={scanning}
          >
            <ToggleGroupItem value="24" size="sm" className="text-xs">
              24h
            </ToggleGroupItem>
            <ToggleGroupItem value="48" size="sm" className="text-xs">
              48h
            </ToggleGroupItem>
            <ToggleGroupItem value="72" size="sm" className="text-xs">
              72h
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Progression pendant le scan */}
        {scanning && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyse en cours...
              </span>
              <span className="text-muted-foreground">
                {stats.processed}/{stats.total}
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>{stats.tasksCreated} tâche(s) créée(s)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 text-blue-500" />
                <span>{stats.tasksUpdated} mise(s) à jour</span>
              </div>
              {stats.errors > 0 && (
                <div className="flex items-center gap-1.5 col-span-2">
                  <XCircle className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">{stats.errors} erreur(s)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Résultats du dernier scan */}
        {!scanning && lastScanStats && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {lastScanStats.total} analysés
            </Badge>
            {lastScanStats.tasksCreated > 0 && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                +{lastScanStats.tasksCreated} tâches
              </Badge>
            )}
            {lastScanStats.tasksUpdated > 0 && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                {lastScanStats.tasksUpdated} mises à jour
              </Badge>
            )}
            {lastScanStats.errors > 0 && (
              <Badge variant="destructive" className="text-xs">
                {lastScanStats.errors} erreurs
              </Badge>
            )}
          </div>
        )}

        {/* Bouton de scan */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scan en cours...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Extraire les tâches ({period}h)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
