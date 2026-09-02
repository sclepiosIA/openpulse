import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";

interface FavoriteCommand {
  id: string;
  command: string;
  label: string;
  description: string | null;
  icon: string | null;
  shortcut_key: string | null;
  usage_count: number | null;
  order_index: number | null;
}

export function useJarvisFavoritesMutations() {
  const incrementUsage = async (fav: FavoriteCommand) => {
    await supabase
      .from("jarvis_favorite_commands")
      .update({
        usage_count: (fav.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", fav.id);
  };

  const addFavorite = async (
    userId: string,
    data: { command: string; label: string; icon?: string },
    currentCount: number
  ): Promise<FavoriteCommand | null> => {
    const { data: result, error } = await supabase
      .from("jarvis_favorite_commands")
      .insert({
        user_id: userId,
        command: data.command.trim(),
        label: data.label.trim(),
        icon: data.icon || null,
        order_index: currentCount,
        shortcut_key: currentCount < 9 ? String(currentCount + 1) : null,
      } as never)
      .select()
      .single(); // safe: guaranteed-row

    if (error) {
      if (error.code === "23505") {
        toast.error("Cette commande est déjà dans vos favoris");
      } else {
        toast.error(sanitizeSupabaseError(error));
      }
      return null;
    }

    toast.success("Commande ajoutée aux favoris");
    return result as FavoriteCommand;
  };

  const removeFavorite = async (id: string) => {
    await supabase
      .from("jarvis_favorite_commands")
      .delete()
      .eq("id", id);
    toast.success("Favori supprimé");
  };

  const reorderFavorites = async (newOrder: FavoriteCommand[]) => {
    for (let i = 0; i < newOrder.length; i++) {
      await supabase
        .from("jarvis_favorite_commands")
        .update({
          order_index: i,
          shortcut_key: i < 9 ? String(i + 1) : null,
        })
        .eq("id", newOrder[i].id);
    }
  };

  return { incrementUsage, addFavorite, removeFavorite, reorderFavorites };
}
