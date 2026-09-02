import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { Users, Loader2 } from "lucide-react";

export function CompleteTeamMappingsButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleCompleteMappings = async () => {
    try {
      setIsLoading(true);
      toast.info("Mise à jour des mappings d'équipe en cours...");

      const { data, error } = await supabase.functions.invoke('complete-team-email-mappings', {
        body: {},
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Mappings d'équipe complétés : ${data.success_count}/${data.total} emails configurés`
        );
        
        // Déclencher la reclassification automatique après avoir complété les mappings
        toast.info("Reclassification des emails en cours...");
        const { data: reclassData, error: reclassError } = await supabase.functions.invoke('auto-match-emails', {
          body: { limit: 100, force_reprocess: false },
        });

        if (reclassError) {
          toast.warning("Mappings créés mais erreur lors de la reclassification");
        } else {
          toast.success(
            `Reclassification terminée : ${reclassData.matched} emails associés, ${reclassData.suggested} suggestions`
          );
        }
      } else {
        toast.error(
          `Erreurs lors de la mise à jour : ${data.error_count}/${data.total} ont échoué`
        );
      }
    } catch (error: unknown) {
      debug.error('Error completing team mappings:', error);
      toast.error(`Erreur : ${sanitizeSupabaseError(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCompleteMappings}
      disabled={isLoading}
      variant="outline"
      className="w-full sm:w-auto"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Mise à jour...
        </>
      ) : (
        <>
          <Users className="mr-2 h-4 w-4" />
          Compléter mappings équipe
        </>
      )}
    </Button>
  );
}
