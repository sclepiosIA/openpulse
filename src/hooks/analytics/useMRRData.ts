import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseBrowser';
import { useAuth } from '@/components/AuthProvider';
import { useMemo } from 'react';
import { format, subMonths, endOfMonth, differenceInMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FacturationPeriode {
  id: string;
  etablissement_id: string;
  date_debut: string;
  date_fin: string;
  montant_prevu: number;
  montant_percu: number | null;
  statut: string;
  type_periode: string;
}

interface EtabMinimal {
  id: string;
  nom: string;
  statut: string;
  type_offre: string | null;
  periodicite_paiement: string | null;
}

export interface MRRMonthData {
  month: string; // 'YYYY-MM'
  label: string; // 'Jan 2026'
  mrr: number;
  clientCount: number;
}

export interface MRRClientData {
  id: string;
  nom: string;
  type_offre: string | null;
  mrr: number;
}

export interface MRRBreakdown {
  type: string;
  mrr: number;
  count: number;
}

const ACTIVE_STATUTS = ['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live', 'Production'] as const;

/**
 * Calcule le MRR mensuel à partir d'une période de facturation.
 * Divise le montant par le nombre de mois couverts.
 */
function periodToMonthlyRate(periode: FacturationPeriode): number {
  const start = new Date(periode.date_debut);
  const end = new Date(periode.date_fin);
  const months = Math.max(1, differenceInMonths(end, start) + 1);
  return periode.montant_prevu / months;
}

/**
 * Vérifie si une période couvre un mois donné (YYYY-MM).
 */
function periodCoversMonth(periode: FacturationPeriode, yearMonth: string): boolean {
  const [y, m] = yearMonth.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const pStart = new Date(periode.date_debut);
  const pEnd = new Date(periode.date_fin);
  return pStart <= monthEnd && pEnd >= monthStart;
}

export function useMRRData() {
  const { loading: authLoading, user } = useAuth();
  const enabled = !authLoading && !!user;

  // Fetch recurrent billing periods (non-deleted)
  const { data: periodes, isLoading: loadingPeriodes } = useQuery({
    queryKey: ['mrr-facturation-periodes'],
    queryFn: async (): Promise<FacturationPeriode[]> => {
      const { data, error } = await supabase
        .from('facturation_periodes')
        .select('id, etablissement_id, date_debut, date_fin, montant_prevu, montant_percu, statut, type_periode')
        .eq('supprime', false)
        .eq('type_periode', 'recurrent');
      if (error) throw error;
      return (data || []) as FacturationPeriode[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch active etablissements
  const { data: etablissements, isLoading: loadingEtabs } = useQuery({
    queryKey: ['mrr-etablissements'],
    queryFn: async (): Promise<EtabMinimal[]> => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom, statut, type_offre, periodicite_paiement')
        .in('statut', ACTIVE_STATUTS);
      if (error) throw error;
      return (data || []) as EtabMinimal[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingPeriodes || loadingEtabs;

  // Build active etab map
  const etabMap = useMemo(() => {
    if (!etablissements) return new Map<string, EtabMinimal>();
    return new Map(etablissements.map(e => [e.id, e]));
  }, [etablissements]);

  // Only periods for active clients
  const activePeriodes = useMemo(() => {
    if (!periodes) return [];
    return periodes.filter(p => etabMap.has(p.etablissement_id));
  }, [periodes, etabMap]);

  // Current MRR
  const now = new Date();
  const currentMonth = format(now, 'yyyy-MM');

  const currentMRR = useMemo(() => {
    let total = 0;
    const seen = new Set<string>();
    for (const p of activePeriodes) {
      if (periodCoversMonth(p, currentMonth)) {
        const key = p.etablissement_id;
        if (!seen.has(key)) {
          seen.add(key);
          total += periodToMonthlyRate(p);
        }
      }
    }
    return total;
  }, [activePeriodes, currentMonth]);

  // Previous month MRR
  const prevMonth = format(subMonths(now, 1), 'yyyy-MM');
  const previousMRR = useMemo(() => {
    let total = 0;
    const seen = new Set<string>();
    for (const p of activePeriodes) {
      if (periodCoversMonth(p, prevMonth)) {
        const key = p.etablissement_id;
        if (!seen.has(key)) {
          seen.add(key);
          total += periodToMonthlyRate(p);
        }
      }
    }
    return total;
  }, [activePeriodes, prevMonth]);

  // MRR variation
  const mrrVariation = previousMRR > 0
    ? ((currentMRR - previousMRR) / previousMRR) * 100
    : currentMRR > 0 ? 100 : 0;

  // ARR
  const arr = currentMRR * 12;

  // Paying clients count
  const payingClients = useMemo(() => {
    const seen = new Set<string>();
    for (const p of activePeriodes) {
      if (periodCoversMonth(p, currentMonth)) {
        seen.add(p.etablissement_id);
      }
    }
    return seen.size;
  }, [activePeriodes, currentMonth]);

  // 12-month MRR history
  const monthlyHistory = useMemo((): MRRMonthData[] => {
    const months: MRRMonthData[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(now, i);
      const ym = format(date, 'yyyy-MM');
      const label = format(date, 'MMM yyyy', { locale: fr });
      let mrr = 0;
      const clients = new Set<string>();
      for (const p of activePeriodes) {
        if (periodCoversMonth(p, ym) && !clients.has(p.etablissement_id)) {
          clients.add(p.etablissement_id);
          mrr += periodToMonthlyRate(p);
        }
      }
      months.push({ month: ym, label, mrr, clientCount: clients.size });
    }
    return months;
  }, [activePeriodes]);

  // Top clients by MRR
  const topClients = useMemo((): MRRClientData[] => {
    const clientMRR = new Map<string, number>();
    for (const p of activePeriodes) {
      if (periodCoversMonth(p, currentMonth)) {
        const existing = clientMRR.get(p.etablissement_id) || 0;
        if (existing === 0) {
          clientMRR.set(p.etablissement_id, periodToMonthlyRate(p));
        }
      }
    }
    return Array.from(clientMRR.entries())
      .map(([id, mrr]) => {
        const etab = etabMap.get(id);
        return {
          id,
          nom: etab?.nom || 'Inconnu',
          type_offre: etab?.type_offre || null,
          mrr,
        };
      })
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);
  }, [activePeriodes, currentMonth, etabMap]);

  // Breakdown by type_offre
  const breakdown = useMemo((): MRRBreakdown[] => {
    const map = new Map<string, { mrr: number; clients: Set<string> }>();
    for (const p of activePeriodes) {
      if (periodCoversMonth(p, currentMonth)) {
        const etab = etabMap.get(p.etablissement_id);
        const type = etab?.type_offre || 'Autre';
        if (!map.has(type)) map.set(type, { mrr: 0, clients: new Set() });
        const entry = map.get(type)!;
        if (!entry.clients.has(p.etablissement_id)) {
          entry.clients.add(p.etablissement_id);
          entry.mrr += periodToMonthlyRate(p);
        }
      }
    }
    return Array.from(map.entries()).map(([type, data]) => ({
      type,
      mrr: data.mrr,
      count: data.clients.size,
    }));
  }, [activePeriodes, currentMonth, etabMap]);

  return {
    currentMRR,
    previousMRR,
    mrrVariation,
    arr,
    payingClients,
    monthlyHistory,
    topClients,
    breakdown,
    isLoading,
  };
}
