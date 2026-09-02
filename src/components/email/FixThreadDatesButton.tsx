import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { debug } from "@/lib/debug";

export function FixThreadDatesButton() {
  const [isFixing, setIsFixing] = useState(false);

  const handleFixDates = async () => {
    try {
      setIsFixing(true);
      debug.log('🔧 Triggering thread date fix...');
      
      toast.info('🔧 Recalcul des dates en cours...', {
        description: 'Cela peut prendre quelques instants',
        duration: 4000,
      });

      const data = await invokeEdge<{ success: boolean; corrected?: number; skipped?: number; error?: string }>('fix-thread-dates');

      debug.log('✅ Thread dates fixed:', data);

      if (data.success) {
        toast.success(`✅ Dates recalculées avec succès!`, {
          description: `${data.corrected} threads corrigés, ${data.skipped} ignorés`,
          duration: 5000,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: unknown) {
      debug.error('Error fixing thread dates:', error);
      toast.error('❌ Erreur lors du recalcul des dates', {
        description: sanitizeSupabaseError(error),
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h4 className="text-sm font-medium mb-1">Recalculer les dates</h4>
          <p className="text-sm text-muted-foreground">
            Recalcule les dates des threads à partir des messages réels. 
            Utile en cas d'incohérences d'affichage.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFixDates}
          disabled={isFixing}
          className="shrink-0"
        >
          {isFixing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calcul...
            </>
          ) : (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Recalculer
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
