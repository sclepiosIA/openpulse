import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTresoreriePrevisionnel } from "@/hooks/tresorerie/useTresoreriePrevisionnel";
import { queryPresets } from "@/lib/queryPresets";

export interface CAExercice {
  annee: number;
  caComptable: number;
  caPercu: number;
}

export interface TresorerieKPIs {
  cashburnMoyen6MoisPasses: number;
  cashburnMoyenProjete6Mois: number;
  cashburnSalairesUniquement: number;
  facturesEnAttente: { count: number; montant: number };
  caParExercice: CAExercice[];
  fondsPropreActuels: number;
  projectionFinAnnee: number;
  prochainTrouTresorerie: { mois: string; solde: number } | null;
  pipelineNiveaux: {
    label: string;
    count: number;
    montantMensuel: number;
    montantAnnuel: number;
    probabilite: number;
  }[];
  isLoading: boolean;
  refetch: () => void;
}

const PIPELINE_LEVELS = [
  { label: "Production", min: 1.0, max: 1.0 },
  { label: "Contractuel", min: 0.80, max: 0.99 },
  { label: "Négociation", min: 0.55, max: 0.79 },
  { label: "Étude émise", min: 0.30, max: 0.54 },
  { label: "Prospection", min: 0.01, max: 0.29 },
];

export function useTresorerieKPIs(): TresorerieKPIs {
  const { previsions, etablissementsPrevisions, isLoading: prevLoading, refetch: prevRefetch } =
    useTresoreriePrevisionnel();

  const now = new Date();
  const currentYear = now.getFullYear();

  // RPC agrégée serveur (audit perf §9 P3 — remplace 4×.limit(5000)).
  const aggregatesQuery = useQuery({
    queryKey: ["kpi-tresorerie-aggregates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_tresorerie_kpis_aggregates");
      if (error) throw error;
      return (data || {}) as {
        depensesReelles6m?: number;
        depensesProjetees6m?: number;
        facturesEnAttenteCount?: number;
        facturesEnAttenteMontant?: number;
        caParExercice?: CAExercice[];
      };
    },
    ...queryPresets.standard,
  });

  const kpis = useMemo((): Omit<TresorerieKPIs, "isLoading" | "refetch"> => {
    const agg = aggregatesQuery.data || {};
    const cashburnMoyen6MoisPasses = (Number(agg.depensesReelles6m) || 0) / 6;
    const cashburnMoyenProjete6Mois = (Number(agg.depensesProjetees6m) || 0) / 6;

    const prev6 = previsions.slice(0, 6);
    const cashburnSalairesUniquement =
      prev6.length > 0
        ? prev6.reduce((sum, p) => sum + p.depensesSalaires, 0) / prev6.length
        : 0;

    const facturesEnAttente = {
      count: Number(agg.facturesEnAttenteCount) || 0,
      montant: Number(agg.facturesEnAttenteMontant) || 0,
    };

    const caParExercice: CAExercice[] = (agg.caParExercice || []).map((r) => ({
      annee: Number(r.annee),
      caComptable: Number(r.caComptable) || 0,
      caPercu: Number(r.caPercu) || 0,
    }));

    const fondsPropreActuels = previsions.length > 0 ? previsions[0].soldePrevu - previsions[0].fluxTresorerie : 0;
    const decemberKey = `${currentYear}-12`;
    const prevDecembre = previsions.find((p) => p.mois === decemberKey);
    const projectionFinAnnee = prevDecembre?.soldePrevu ?? previsions[previsions.length - 1]?.soldePrevu ?? 0;

    const trou = previsions.find((p) => p.soldePrevu < 0);
    const prochainTrouTresorerie = trou ? { mois: trou.moisLabel, solde: trou.soldePrevu } : null;

    const pipelineNiveaux = PIPELINE_LEVELS.map((level) => {
      const etabs = etablissementsPrevisions.filter(
        (e) => e.probabilite >= level.min && e.probabilite <= level.max
      );
      const montantMensuel = etabs.reduce((sum, e) => sum + e.revenuMensuelEstime, 0);
      return {
        label: level.label,
        count: etabs.length,
        montantMensuel,
        montantAnnuel: montantMensuel * 12,
        probabilite: level.min,
      };
    }).filter((n) => n.count > 0);

    return {
      cashburnMoyen6MoisPasses,
      cashburnMoyenProjete6Mois,
      cashburnSalairesUniquement,
      facturesEnAttente,
      caParExercice,
      fondsPropreActuels,
      projectionFinAnnee,
      prochainTrouTresorerie,
      pipelineNiveaux,
    };
  }, [previsions, etablissementsPrevisions, aggregatesQuery.data, currentYear]);

  return {
    ...kpis,
    isLoading: prevLoading || aggregatesQuery.isLoading,
    refetch: () => {
      prevRefetch();
      aggregatesQuery.refetch();
    },
  };
}

