import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ForecastKpis {
  pipeline_raw: number;
  pipeline_weighted: number;
  current_quarter: number;
  next_quarter: number;
  won_total: number;
  target_total: number;
  current_quarter_target: number;
}

export interface ForecastPreviousPeriod {
  pipeline_raw: number;
  pipeline_weighted: number;
  won_total: number;
}

export interface ForecastQuarterRow {
  quarter: string;
  raw: number;
  weighted: number;
  won: number;
  target: number;
  count: number;
}

export interface ForecastCommercialRow {
  user_id: string | null;
  display_name: string;
  raw: number;
  weighted: number;
  won: number;
  deals_count: number;
}

export interface ForecastPhaseRow {
  statut: string;
  label?: string;
  phase_group?: string;
  probability: number;
  raw: number;
  weighted: number;
  count: number;
}

export interface ForecastPhaseGroup {
  phase_group: string;
  raw: number;
  weighted: number;
  count: number;
}

export interface ForecastTopDeal {
  id: string;
  nom: string;
  statut: string;
  probability: number;
  deal_value: number;
  weighted_value: number;
  closing_date: string;
}

export type ForecastRiskDeal = ForecastTopDeal;

export interface SalesForecast {
  range: { start: string; end: string };
  previous_range?: { start: string; end: string };
  kpis: ForecastKpis;
  previous_period?: ForecastPreviousPeriod;
  by_quarter: ForecastQuarterRow[];
  by_commercial: ForecastCommercialRow[];
  by_phase: ForecastPhaseRow[];
  by_phase_group?: ForecastPhaseGroup[];
  top_deals: ForecastTopDeal[];
  hot_deals?: ForecastRiskDeal[];
  at_risk_deals?: ForecastRiskDeal[];
}

export type ForecastRange = 'current_quarter' | 'next_quarter' | 'year' | 'rolling_12';

function computeRange(range: ForecastRange): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const qStartMonth = Math.floor(m / 3) * 3;
  const fmt = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  switch (range) {
    case 'current_quarter': {
      const start = new Date(y, qStartMonth, 1);
      const end = new Date(y, qStartMonth + 3, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'next_quarter': {
      const start = new Date(y, qStartMonth + 3, 1);
      const end = new Date(y, qStartMonth + 6, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'rolling_12': {
      const start = new Date(y, m - 6, 1);
      const end = new Date(y, m + 6, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'year':
    default: {
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
  }
}

export function useSalesForecast(range: ForecastRange = 'year') {
  const { start, end } = computeRange(range);

  return useQuery({
    queryKey: ['sales-forecast', range, start, end],
    queryFn: async (): Promise<SalesForecast> => {
      const { data, error } = await supabase.rpc('get_sales_forecast', {
        p_start: start,
        p_end: end,
      });
      if (error) throw error;
      return data as unknown as SalesForecast;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
