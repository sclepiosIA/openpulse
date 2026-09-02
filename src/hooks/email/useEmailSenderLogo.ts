import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import marqueLogo from "@/assets/marque/logo.png";
import { isMarqueEmail } from "@/lib/internalEmailConfig";

export interface EmailSenderLogoResult {
  type: 'internal' | 'etablissement' | 'groupe' | 'clearbit' | 'initials';
  logoUrl: string | null;
  entityName?: string;
}

export function useEmailSenderLogo(email?: string) {
  return useQuery<EmailSenderLogoResult | null>({
    queryKey: ['email-sender-logo', email],
    queryFn: async () => {
      if (!email) return null;
      
      // 1. Vérifier si c'est un membre interne OpenPulse
      if (isMarqueEmail(email)) {
        return { type: 'internal', logoUrl: marqueLogo };
      }
      
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) return null;
      
      // 2. Chercher le mapping du domaine dans email_domain_mappings
      const { data: mapping } = await supabase
        .from('email_domain_mappings')
        .select(`
          etablissement_id,
          groupe_id,
          etablissement:etablissements(id, nom, logo_url),
          groupe:groupes_etablissements(id, nom, logo_url)
        `)
        .eq('domain', domain)
        .eq('is_excluded', false)
        .maybeSingle();
      
      // Si établissement avec logo
      if (mapping?.etablissement?.logo_url) {
        return { 
          type: 'etablissement', 
          logoUrl: mapping.etablissement.logo_url, 
          entityName: mapping.etablissement.nom 
        };
      }
      
      // Si groupe
      if (mapping?.groupe) {
        // Si le groupe a un logo, l'utiliser
        if (mapping.groupe.logo_url) {
          return { 
            type: 'groupe', 
            logoUrl: mapping.groupe.logo_url, 
            entityName: mapping.groupe.nom 
          };
        }
        
        // Sinon chercher un établissement membre avec logo (fallback)
        const { data: member } = await supabase
          .from('etablissements_groupes')
          .select('etablissement:etablissements(id, nom, logo_url)')
          .eq('groupe_id', mapping.groupe.id)
          .not('etablissement.logo_url', 'is', null)
          .limit(1)
          .maybeSingle();
        
        if (member?.etablissement?.logo_url) {
          return { 
            type: 'groupe', 
            logoUrl: member.etablissement.logo_url, 
            entityName: mapping.groupe.nom 
          };
        }
      }
      
      // 3. Pas de mapping trouvé - retourne null pour fallback Clearbit/initiales
      return null;
    },
    staleTime: 30 * 60 * 1000, // Cache 30 minutes
    gcTime: 60 * 60 * 1000,    // Garde en cache 1 heure
    enabled: !!email,
  });
}
