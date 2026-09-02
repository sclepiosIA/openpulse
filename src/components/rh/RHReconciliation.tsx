import { debug } from "@/lib/debug";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { invokeEdge } from "@/services/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";

export function RHReconciliation() {
  const { data: ecarts, isLoading, refetch } = useQuery({
    queryKey: ['rh-tresorerie-reconciliation'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_rh_tresorerie_reconciliation');
      if (error) throw error;
      const r = (data || {}) as any;
      return {
        totalSalaires: r.totalSalaires || 0,
        totalDepenses: r.totalDepenses || 0,
        salairesNonSynchro: { length: r.salairesNonSynchro || 0 } as { length: number },
        depensesOrphelines: { length: r.depensesOrphelines || 0 } as { length: number },
        isSync: !!r.isSync,
      };
    }
  });

  const syncData = async () => {
    toast.info("Synchronisation en cours...");
    
    try {
      // Déclencher la synchronisation via l'Edge Function admin
      const data = await invokeEdge<any>('generate-recurring-expenses', { force: true });
    const error = null;
      
      if (error) throw error;
      
      toast.success(`Synchronisation réussie: ${data?.depenses_created || 0} dépenses créées`);
      refetch();
    } catch (error: unknown) {
      toast.error(sanitizeSupabaseError(error));
      debug.error('Sync error:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {ecarts?.isSync ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          )}
          Réconciliation RH ↔ Trésorerie
        </CardTitle>
        <CardDescription>
          Synchronisation entre les salaires RH et les dépenses de trésorerie
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Vérification en cours...</p>
        ) : ecarts?.isSync ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Les données sont synchronisées</span>
          </div>
        ) : (
          <div className="space-y-3">
            {ecarts && ecarts.salairesNonSynchro.length > 0 && (
              <div className="text-sm">
                <p className="text-orange-600 font-medium">
                  {ecarts.salairesNonSynchro.length} salaire(s) non synchronisé(s) avec la trésorerie
                </p>
              </div>
            )}
            {ecarts && ecarts.depensesOrphelines.length > 0 && (
              <div className="text-sm">
                <p className="text-orange-600 font-medium">
                  {ecarts.depensesOrphelines.length} dépense(s) orpheline(s) dans la trésorerie
                </p>
              </div>
            )}
            <Button onClick={syncData} className="w-full flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Synchroniser maintenant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
