import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { Users } from "lucide-react";
import { debug } from "@/lib/debug";
import { setupTeamMembers } from '@/services/admin/setupTeamMembers';

export function SetupTeamButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const data = await setupTeamMembers();
      debug.log('Team setup result:', data);

      if (data.success) {
        toast.success(
          `✅ Équipe créée avec succès!\n${data.results.length} membres créés/mis à jour`,
          { duration: 5000 }
        );
        data.results.forEach((result) => {
          debug.log(`${result.email}: ${result.status} (profile: ${result.profileId})`);
        });
      }
    } catch (error: unknown) {
      debug.error('Setup error:', error);
      toast.error(sanitizeSupabaseError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSetup}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      <Users className="h-4 w-4 mr-2" />
      {isLoading ? "Création en cours..." : "Créer membres équipe"}
    </Button>
  );
}
