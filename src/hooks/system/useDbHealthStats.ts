import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TableStat {
  table_name: string;
  estimated_rows: number;
  total_size: number;
  total_size_pretty: string;
  data_size_pretty: string;
  index_size_pretty: string;
  seq_scan: number;
  idx_scan: number;
  idx_scan_pct: number;
  n_live_tup: number;
  n_dead_tup: number;
  dead_tup_pct: number;
}

interface HighSeqScanTable {
  table_name: string;
  seq_scan: number;
  idx_scan: number;
  rows: number;
}

export interface DbHealthStats {
  tables: TableStat[];
  total_db_size: string;
  table_count: number;
  high_seq_scan_tables: HighSeqScanTable[] | null;
}

export function useDbHealthStats() {
  return useQuery({
    queryKey: ['db-health-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_db_health_stats');
      if (error) throw error;
      return data as unknown as DbHealthStats;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
