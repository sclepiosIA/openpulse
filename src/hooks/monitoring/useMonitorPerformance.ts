import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SlowRoute {
  route: string;
  samples: number;
  p75: number;
  p95: number;
  avg_value: number;
}

export interface UserWithErrors {
  user_id: string;
  user_email: string | null;
  error_count: number;
  last_error_at: string;
  distinct_types: number;
}

export function useTopSlowRoutes(hours = 24, metric: "LCP" | "INP" | "CLS" | "FCP" | "TTFB" = "LCP") {
  return useQuery({
    queryKey: ["monitor", "slow-routes", hours, metric],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_slow_routes", {
        p_hours: hours,
        p_metric: metric,
        p_limit: 10,
      });
      if (error) throw error;
      return (data ?? []) as SlowRoute[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTopUsersWithErrors(days = 7) {
  return useQuery({
    queryKey: ["monitor", "users-errors", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_users_with_errors", {
        p_days: days,
        p_limit: 10,
      });
      if (error) throw error;
      return (data ?? []) as UserWithErrors[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
