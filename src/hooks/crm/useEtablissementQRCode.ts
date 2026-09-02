import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

interface EtablissementQRCode {
  id: string;
  nom: string;
  qr_access_token: string | null;
  qr_access_expires_at: string | null;
}

/**
 * Hook pour récupérer le QR code d'un établissement
 */
export function useEtablissementQRCode(etablissementId: string) {
  return useQuery({
    queryKey: ['etablissement-qr-code', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom, qr_access_token, qr_access_expires_at')
        .eq('id', etablissementId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as EtablissementQRCode;
    },
    enabled: !!etablissementId,
  });
}

/**
 * Hook pour générer ou régénérer un token QR code pour un établissement
 */
export function useGenerateEtablissementQRToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (etablissementId: string) => {
      // Appeler la fonction SQL pour générer le token
      const { data, error } = await supabase.rpc('generate_etablissement_qr_token', {
        etablissement_id: etablissementId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, etablissementId) => {
      toast.success("QR Code généré avec succès !");
      queryClient.invalidateQueries({ queryKey: ['etablissement-qr-code', etablissementId] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}

/**
 * Hook pour vérifier la validité d'un token QR et récupérer les infos de l'établissement
 */
export function useVerifyEtablissementQRToken(slug: string, token: string) {
  return useQuery({
    queryKey: ['verify-etablissement-qr', slug, token],
    queryFn: async () => {
      // Récupérer l'établissement par slug
      const { data: etablissement, error: etabError } = await supabase
        .from('etablissements')
        .select('id, nom, ville, qr_access_token, qr_access_expires_at')
        .eq('slug', slug)
        .maybeSingle();

      if (etabError) throw etabError;
      if (!etablissement) {
        throw new Error("Établissement non trouvé");
      }

      const etab = etablissement as unknown as Record<string, unknown> & { qr_access_token?: string; qr_access_expires_at?: string };

      // Vérifier le token
      if (!etab.qr_access_token || etab.qr_access_token !== token) {
        throw new Error("Token QR invalide");
      }

      // Vérifier l'expiration
      if (etab.qr_access_expires_at) {
        const expiresAt = new Date(etab.qr_access_expires_at);
        if (expiresAt < new Date()) {
          throw new Error("Token QR expiré");
        }
      }

      return {
        id: etab.id,
        nom: etab.nom,
        ville: etab.ville,
      };
    },
    enabled: !!slug && !!token,
    retry: false,
  });
}
