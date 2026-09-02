import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";
import { debug } from "@/lib/debug";

interface CreateUserData {
  email: string;
  prenom: string;
  nom: string;
  role: "direction" | "copil" | "admin" | "commercial" | "chef_projet" | "csm" | "rh";
  password: string;
  fonction?: string;
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      // Appel à l'edge function admin-create-user avec password
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          prenom: data.prenom,
          nom: data.nom,
          role: data.role,
          password: data.password,
        },
      });

      // Si erreur HTTP, on la throw
      if (error) {
        throw error;
      }
      
      // Vérifier si c'est une erreur applicative (success: false)
      if (result && !result.success && result.error) {
        /** Erreur applicative enrichie */
        interface AppError extends Error {
          details?: unknown;
          isApplicationError?: boolean;
        }
        const appError: AppError = new Error(result.error);
        appError.details = result.details;
        appError.isApplicationError = true;
        throw appError;
      }

      // Créer/mettre à jour le profil avec la fonction si spécifiée
      if (result?.user?.id && data.fonction) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ fonction: data.fonction })
          .eq('user_id', result.user.id);

        if (profileError) {
          debug.error("Erreur lors de la mise à jour du profil:", profileError);
        }
      }

      return result;
    },
    onSuccess: (data) => {
      toast.success("Utilisateur créé", {
        description: `${data.user?.email} a été créé. Communiquez-lui son mot de passe initial.`,
      });
      
      // Invalider les queries pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profilesWithRoles'] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}
