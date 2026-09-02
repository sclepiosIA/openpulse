import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { subMonths, startOfMonth, format, parseISO, isAfter } from "date-fns";
import { keepPreviousData } from "@tanstack/react-query";

export interface FacturationPeriodeWithEtab {
  id: string;
  etablissement_id: string;
  date_debut: string;
  date_fin: string;
  montant_prevu: number;
  montant_percu: number | null;
  statut: string;
  date_facture: string | null;
  date_virement_estimee: string | null;
  type_periode: string;
  notes: string | null;
  etablissement: { id: string; nom: string; client_facturation: string | null } | null;
}

const STATUT_LABELS: Record<string, string> = {
  prevue: "Prévue",
  facturee: "Facturée",
  encaissee: "Encaissée",
  en_retard: "En retard",
  annulee: "Annulée",
};

export function useAllFacturationPeriodes() {
  const cutoffDate = useMemo(() => {
    const d = subMonths(new Date(), 12);
    return format(startOfMonth(d), "yyyy-MM-dd");
  }, []);

  const { data: rawPeriodes = [], isLoading: isLoadingPeriodes } = useQuery({
    queryKey: ["all-facturation-periodes", cutoffDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturation_periodes")
        .select(
          "id, etablissement_id, date_debut, date_fin, montant_prevu, montant_percu, statut, date_facture, date_virement_estimee, type_periode, notes, etablissement:etablissements(id, nom, client_facturation)"
        )
        .eq("supprime", false)
        .gte("date_debut", cutoffDate)
        .order("date_debut", { ascending: false })
        .limit(2000);

      if (error) throw error;
      return (data ?? []) as unknown as FacturationPeriodeWithEtab[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: groupesMembres = [], isLoading: isLoadingGroupes } = useQuery({
    queryKey: ["etablissements-groupes-actifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etablissements_groupes")
        .select("etablissement_id, groupe_id")
        .is("date_sortie", null);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const isLoading = isLoadingPeriodes || isLoadingGroupes;

  // Dédupliquer les périodes pour les établissements en facturation groupe
  const periodes = useMemo(() => {
    if (groupesMembres.length === 0) return rawPeriodes;

    const etabToGroupe = new Map<string, string>();
    for (const gm of groupesMembres) {
      etabToGroupe.set(gm.etablissement_id, gm.groupe_id);
    }

    const seen = new Set<string>();
    return rawPeriodes.filter((p) => {
      if (p.etablissement?.client_facturation !== 'groupe') return true;

      const groupeId = etabToGroupe.get(p.etablissement_id);
      if (!groupeId) return true;

      const key = `${groupeId}|${p.date_debut}|${p.type_periode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawPeriodes, groupesMembres]);

  const computed = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const now = new Date();

    const periodesAnnee = periodes.filter(
      (p) => new Date(p.date_debut).getFullYear() === currentYear
    );

    const totalPrevuAnnuel = periodesAnnee.reduce(
      (s, p) => s + (p.montant_prevu || 0),
      0
    );

    const totalEncaisse = periodes
      .filter((p) => p.statut === "encaissee")
      .reduce((s, p) => s + (p.montant_percu ?? p.montant_prevu ?? 0), 0);

    const totalFacture = periodes
      .filter((p) => p.statut === "facturee")
      .reduce((s, p) => s + (p.montant_prevu || 0), 0);

    const periodesRetard = periodes.filter((p) => p.statut === "en_retard");
    const totalEnRetard = periodesRetard.reduce(
      (s, p) => s + (p.montant_prevu || 0),
      0
    );

    // Helper: top 5 établissements par montant
    const buildTop5 = (
      source: FacturationPeriodeWithEtab[],
      getMontant: (p: FacturationPeriodeWithEtab) => number
    ) =>
      Object.values(
        source.reduce((acc, p) => {
          const nom = p.etablissement?.nom || "Inconnu";
          if (!acc[nom]) acc[nom] = { nom, montant: 0, count: 0 };
          acc[nom].montant += getMontant(p);
          acc[nom].count += 1;
          return acc;
        }, {} as Record<string, { nom: string; montant: number; count: number }>)
      )
        .sort((a, b) => b.montant - a.montant)
        .slice(0, 5);

    const detailPrevu = buildTop5(periodesAnnee, (p) => p.montant_prevu || 0);
    const detailEncaisse = buildTop5(
      periodes.filter((p) => p.statut === "encaissee"),
      (p) => p.montant_percu ?? p.montant_prevu ?? 0
    );
    const detailFacture = buildTop5(
      periodes.filter((p) => p.statut === "facturee"),
      (p) => p.montant_prevu || 0
    );
    const detailEnRetard = buildTop5(periodesRetard, (p) => p.montant_prevu || 0);

    // Compteurs par statut
    const parStatut: Record<string, number> = {};
    periodes.forEach((p) => {
      parStatut[p.statut] = (parStatut[p.statut] || 0) + 1;
    });

    // Prochains virements attendus (date_virement_estimee future)
    const prochainsVirements = periodes
      .filter(
        (p) =>
          p.date_virement_estimee &&
          isAfter(parseISO(p.date_virement_estimee), now) &&
          p.statut !== "encaissee" &&
          p.statut !== "annulee"
      )
      .sort(
        (a, b) =>
          new Date(a.date_virement_estimee!).getTime() -
          new Date(b.date_virement_estimee!).getTime()
      )
      .slice(0, 10);

    // Tous les paiements attendus de l'année (non encaissés, non annulés)
    const paiementsAttendusAnnee = periodesAnnee
      .filter((p) => p.statut !== "encaissee" && p.statut !== "annulee")
      .sort((a, b) => a.date_debut.localeCompare(b.date_debut));

    // Évolution mensuelle sur 12 mois
    const evolution = Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), 11 - i);
      const moisKey = format(date, "yyyy-MM");
      const moisLabel = format(date, "MMM yy");

      const periodesMonth = periodes.filter(
        (p) => format(parseISO(p.date_debut), "yyyy-MM") === moisKey
      );

      const prevu = periodesMonth.reduce(
        (s, p) => s + (p.montant_prevu || 0),
        0
      );
      const encaisse = periodesMonth
        .filter((p) => p.statut === "encaissee")
        .reduce((s, p) => s + (p.montant_percu ?? p.montant_prevu ?? 0), 0);

      return { mois: moisLabel, prevu, encaisse };
    });

    // Pie chart data
    const statutPieData = Object.entries(parStatut).map(([statut, count]) => ({
      name: STATUT_LABELS[statut] || statut,
      value: count,
      statut,
    }));

    return {
      totalPrevuAnnuel,
      totalEncaisse,
      totalFacture,
      totalEnRetard,
      nbEnRetard: periodesRetard.length,
      nbPrevu: periodesAnnee.length,
      nbEncaisse: periodes.filter((p) => p.statut === "encaissee").length,
      nbFacture: periodes.filter((p) => p.statut === "facturee").length,
      parStatut,
      prochainsVirements,
      paiementsAttendusAnnee,
      periodesEnRetard: periodesRetard,
      evolution,
      statutPieData,
      currentYear,
      detailPrevu,
      detailEncaisse,
      detailFacture,
      detailEnRetard,
      tauxEncaissement:
        totalPrevuAnnuel > 0
          ? Math.round((totalEncaisse / totalPrevuAnnuel) * 100)
          : 0,
    };
  }, [periodes]);

  return {
    periodes,
    isLoading,
    ...computed,
  };
}
