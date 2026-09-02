import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from '@/lib/debug';
import type { NextcloudFile } from "./useNextcloudStorage";

export function useNextcloudFiles(folderPath: string = "/") {
  return useQuery({
    queryKey: ["nextcloud-files", folderPath],
    queryFn: async (): Promise<NextcloudFile[]> => {
      const { data, error } = await supabase.functions.invoke("nextcloud-files", {
        body: { action: "list", path: folderPath },
      });

      if (error) {
        debug.error("Erreur liste Nextcloud:", error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Trier: dossiers d'abord, puis par nom
      const files = (data as NextcloudFile[]) || [];
      return files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, "fr");
      });
    },
    staleTime: 30000, // 30 secondes
    retry: 1,
  });
}

// Hook pour vérifier si Nextcloud est configuré et accessible
export function useNextcloudStatus() {
  return useQuery({
    queryKey: ["nextcloud-status"],
    queryFn: async (): Promise<{ configured: boolean; connected: boolean; error?: string }> => {
      try {
        const { data, error } = await supabase.functions.invoke("nextcloud-files", {
          body: { action: "list", path: "/" },
        });

        if (error) {
          return { configured: false, connected: false, error: error.message };
        }

        if (data?.error) {
          if (data.error.includes("Configuration Nextcloud manquante")) {
            return { configured: false, connected: false, error: data.error };
          }
          return { configured: true, connected: false, error: data.error };
        }

        return { configured: true, connected: true };
      } catch (err) {
        return { configured: false, connected: false, error: String(err) };
      }
    },
    staleTime: 60000, // 1 minute
    retry: false,
  });
}
