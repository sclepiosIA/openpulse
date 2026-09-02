/**
 * Helper centralisé pour accéder aux tables `social_*` qui ne sont pas
 * encore exposées dans le type `Database` généré par Supabase.
 *
 * Le cast `as any` est intentionnel et concentré ici : dès que les tables
 * `social_brands`, `social_accounts`, `social_connections`, `social_posts`,
 * `social_comments` apparaîtront dans `Database`, on pourra supprimer ce
 * fichier et réimporter `supabase` directement dans les hooks.
 */
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const socialClient = supabase as any;
