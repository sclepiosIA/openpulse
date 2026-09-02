import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";

export interface EtablissementPublic {
  id: string;
  nom: string;
  slug: string;
  ville: string;
  qr_access_token: string | null;
  qr_access_expires_at: string | null;
}

export function useEtablissementBySlug(slug: string) {
  return useQuery({
    queryKey: ['etablissement-by-slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements_public')
        .select('id, nom, slug, ville, qr_access_token, qr_access_expires_at')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Établissement non trouvé');
      
      const result = data as unknown as Record<string, unknown>;
      return {
        id: result.id,
        nom: result.nom,
        slug: result.slug,
        ville: result.ville,
        qr_access_token: result.qr_access_token,
        qr_access_expires_at: result.qr_access_expires_at,
      } as EtablissementPublic;
    },
    enabled: !!slug,
  });
}
