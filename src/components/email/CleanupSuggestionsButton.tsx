import { useState } from "react";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { invokeEdge } from "@/services/edgeFunctions";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from "@tanstack/react-query";

export function CleanupSuggestionsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCleanup = async () => {
    setIsLoading(true);
    try {
      const data = await invokeEdge<{ message?: string }>('cleanup-all-suggestions');

      toast({
        title: "Nettoyage terminé",
        description: data?.message || "Les suggestions invalides ont été supprimées",
      });

      // Rafraîchir les suggestions
      queryClient.invalidateQueries({ queryKey: ['email-suggestions-pending'] });
      queryClient.invalidateQueries({ queryKey: ['etablissement-email-suggestions'] });
    } catch (error: unknown) {
      debug.error('Erreur lors du nettoyage:', error);
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCleanup}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      Nettoyer suggestions invalides
    </Button>
  );
}
