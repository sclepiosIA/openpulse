import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize } from "@/types/documents";
import { useAuth } from "@/components/AuthProvider";

export interface QuotaInfo {
  quota_bytes: number;
  used_bytes: number;
  available_bytes: number;
  usage_percentage: number;
  formatted_quota: string;
  formatted_used: string;
  formatted_available: string;
}

export function useDocumentQuota() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["document-quota"],
    queryFn: async (): Promise<QuotaInfo> => {
      if (!user) throw new Error("Non authentifié");

      // Calcul dynamique depuis la table documents (quota global de l'organisation)
      const { data: docs } = await supabase
        .from("documents")
        .select("file_size_bytes")
        .is("deleted_at", null)
        .eq("is_hard_deleted", false);

      const usedBytes = docs?.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0) || 0;
      const quotaBytes = 5 * 1024 * 1024 * 1024; // 5 GB
      const availableBytes = Math.max(0, quotaBytes - usedBytes);
      const usagePercentage = (usedBytes / quotaBytes) * 100;

      return {
        quota_bytes: quotaBytes,
        used_bytes: usedBytes,
        available_bytes: availableBytes,
        usage_percentage: usagePercentage,
        formatted_quota: formatFileSize(quotaBytes),
        formatted_used: formatFileSize(usedBytes),
        formatted_available: formatFileSize(availableBytes),
      };
    },
    staleTime: 30000, // 30 secondes pour plus de réactivité
  });
}
