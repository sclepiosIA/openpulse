import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CleanupInternalContactsButton() {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  const handleCleanup = async () => {
    setIsRunning(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-internal-contacts');
      
      if (error) throw error;
      
      toast.success(
        `Nettoyage terminé : ${data.contacts_deleted} contacts (domaines), ` +
        `${data.generic_contacts_deleted || 0} contacts (noms génériques), ` +
        `${data.partenaire_contacts_deleted} partenaires (domaines), ` +
        `${data.generic_partenaire_contacts_deleted || 0} partenaires (noms génériques), ` +
        `${(data.pending_contacts_deleted || 0) + (data.pending_generic_deleted || 0)} validations en attente supprimées`
      );
      
      // Invalidate relevant queries instead of full page reload
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['partenaires'] });
    } catch (error: unknown) {
      toast.error(`Erreur lors du nettoyage : ${sanitizeSupabaseError(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isRunning}>
          <Trash2 className="h-4 w-4 mr-2" />
          {isRunning ? "Nettoyage en cours..." : "Nettoyer contacts internes"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nettoyer les contacts internes et génériques</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action va supprimer tous les contacts avec des emails @exploitant.example.org, 
            des domaines génériques (gmail, outlook, yahoo, hotmail, free, orange, etc.) 
            ou des noms génériques (DAF Inconnu, Secrétaire Générale Inconnu, etc.) 
            qui ont été créés par erreur.
            <br /><br />
            <strong>Cette action est irréversible.</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleCleanup} disabled={isRunning}>
            {isRunning ? "Nettoyage..." : "Confirmer le nettoyage"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
