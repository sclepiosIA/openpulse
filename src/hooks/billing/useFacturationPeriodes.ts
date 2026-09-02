import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { addMonths, addDays, subDays, startOfMonth, isBefore, isAfter, format, parseISO } from "date-fns";
import { calculatePeriodicPaymentAmount } from "@/lib/tresorerie/calculateRevenues";
import { toast } from "sonner";
import { useCallback } from "react";

type Etablissement = Database["public"]["Tables"]["etablissements"]["Row"];

export interface FacturationPeriode {
  id: string;
  etablissement_id: string;
  date_debut: string;
  date_fin: string;
  montant_prevu: number;
  montant_percu: number | null;
  statut: string;
  modele_snapshot: Record<string, unknown> | null;
  est_modifie_manuellement: boolean;
  notes: string | null;
  date_facture: string | null;
  date_virement_estimee: string | null;
  type_periode: string;
  created_at: string;
  updated_at: string;
}

const YEARS_AHEAD = 3;

function getPeriodiciteMonths(periodicite: string): number {
  switch (periodicite) {
    case "bimensuel": return 2;
    case "trimestriel": return 3;
    case "quadrimestriel": return 4;
    case "semestriel": return 6;
    case "annuel": return 12;
    case "mensuel":
    default: return 1;
  }
}

function getReferenceDate(etablissement: Etablissement): Date | null {
  if (etablissement.date_go_live) return new Date(etablissement.date_go_live);
  if (etablissement.date_premier_paiement) return new Date(etablissement.date_premier_paiement);
  if (etablissement.date_signature) return new Date(etablissement.date_signature);
  return null;
}

function generateExpectedPeriodes(etablissement: Etablissement, startFromDate?: Date): { date_debut: Date; date_fin: Date; montant_prevu: number; type_periode: string }[] {
  const dateRef = getReferenceDate(etablissement);
  if (!dateRef) return [];

  const periodicite = etablissement.periodicite_paiement || "mensuel";
  const increment = getPeriodiciteMonths(periodicite);
  const limitBaseDate = startFromDate || new Date();
  const limitDate = addMonths(startOfMonth(limitBaseDate), YEARS_AHEAD * 12);

  const periodes: { date_debut: Date; date_fin: Date; montant_prevu: number; type_periode: string }[] = [];

  // Forfait initial (only when not resuming from a specific date)
  if (!startFromDate && etablissement.paiement_initial && etablissement.paiement_initial > 0 && etablissement.date_signature) {
    const dateSignature = new Date(etablissement.date_signature);
    let forfaitDate = startOfMonth(dateSignature);
    while (isBefore(forfaitDate, limitDate)) {
      periodes.push({
        date_debut: forfaitDate,
        date_fin: forfaitDate,
        montant_prevu: Math.round(etablissement.paiement_initial * 100) / 100,
        type_periode: "forfait_initial",
      });
      forfaitDate = addMonths(forfaitDate, 12);
    }
  }

  // Périodes récurrentes — start from startFromDate if provided, else dateRef
  let current = startFromDate || dateRef;
  while (isBefore(current, limitDate)) {
    const montant = calculatePeriodicPaymentAmount(etablissement);
    const fin = subDays(addMonths(current, increment), 1);

    periodes.push({
      date_debut: current,
      date_fin: fin,
      montant_prevu: Math.round(montant * 100) / 100,
      type_periode: "recurrent",
    });

    current = addMonths(current, increment);
  }

  return periodes;
}

function buildModeleSnapshot(etab: Etablissement): Record<string, unknown> {
  return {
    type_offre: etab.type_offre,
    pallier_vise: etab.pallier_vise,
    tarifs_palliers: etab.tarifs_palliers,
    modele_statique_succes: etab.modele_statique_succes,
    periodicite_paiement: etab.periodicite_paiement,
    nombre_passages_urgences_annuel: etab.nombre_passages_urgences_annuel,
    paiement_initial: etab.paiement_initial,
  };
}

export function useFacturationPeriodes(etablissementId: string, etablissement?: Etablissement | null) {
  const queryClient = useQueryClient();
  const queryKey = ["facturation-periodes", etablissementId];

  const { data: periodes, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturation_periodes")
        .select("id, etablissement_id, date_debut, date_fin, montant_prevu, montant_percu, statut, modele_snapshot, est_modifie_manuellement, notes, date_facture, date_virement_estimee, type_periode, created_at, updated_at")
        .eq("etablissement_id", etablissementId)
        .eq("supprime", false)
        .order("date_debut", { ascending: true });

      if (error) throw error;
      return data as unknown as FacturationPeriode[];
    },
    enabled: !!etablissementId,
  });

  const syncPeriodes = useCallback(async () => {
    if (!etablissement) return;

    const expected = generateExpectedPeriodes(etablissement);
    if (expected.length === 0) return;

    const { data: existing } = await supabase
      .from("facturation_periodes")
      .select("id, date_debut, type_periode, est_modifie_manuellement, statut")
      .eq("etablissement_id", etablissementId)
      .eq("supprime", false);

    type ExistingPeriode = {
      id: string;
      date_debut: string;
      type_periode: string | null;
      est_modifie_manuellement: boolean | null;
      statut: string;
    };
    const existingMap = new Map<string, ExistingPeriode>(
      ((existing || []) as ExistingPeriode[]).map((p) => [`${p.date_debut}|${p.type_periode || 'recurrent'}`, p])
    );

    // Build set of expected date_debut keys for obsolete detection
    const expectedKeys = new Set(
      expected.map((p) => `${format(p.date_debut, "yyyy-MM-dd")}|${p.type_periode}`)
    );

    const today = startOfMonth(new Date());
    const snapshot = buildModeleSnapshot(etablissement);
    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: { date_debut: string; type_periode: string; montant_prevu: number; modele_snapshot: unknown }[] = [];

    for (const p of expected) {
      const key = format(p.date_debut, "yyyy-MM-dd");
      const compositeKey = `${key}|${p.type_periode}`;
      const isFuture = isAfter(p.date_debut, today);
      const existingEntry = existingMap.get(compositeKey);

      if (!existingEntry) {
        toInsert.push({
          etablissement_id: etablissementId,
          date_debut: key,
          date_fin: format(p.date_fin, "yyyy-MM-dd"),
          montant_prevu: p.montant_prevu,
          modele_snapshot: (snapshot as never),
          statut: "prevue",
          type_periode: p.type_periode,
          supprime: false,
          est_modifie_manuellement: false,
        });
      } else if (isFuture && !existingEntry.est_modifie_manuellement) {
        toUpdate.push({
          date_debut: key,
          type_periode: p.type_periode,
          montant_prevu: p.montant_prevu,
          modele_snapshot: (snapshot as never),
        });
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("facturation_periodes")
        .upsert(toInsert as never, { onConflict: "etablissement_id,date_debut,type_periode", ignoreDuplicates: true });
      if (error) console.error("Insert periodes error:", error);
    }

    for (const u of toUpdate) {
      await supabase
        .from("facturation_periodes")
        .update({
          montant_prevu: u.montant_prevu,
          modele_snapshot: u.modele_snapshot as never,
        })
        .eq("etablissement_id", etablissementId)
        .eq("date_debut", u.date_debut)
        .eq("type_periode", u.type_periode);
    }

    // Soft-delete obsolete periods (old periodicity vestiges)
    const obsoleteIds = ((existing || []) as ExistingPeriode[])
      .filter((p) => {
        const key = `${p.date_debut}|${p.type_periode || 'recurrent'}`;
        return !expectedKeys.has(key) && p.statut === 'prevue' && !p.est_modifie_manuellement;
      })
      .map((p) => p.id);

    if (obsoleteIds.length > 0) {
      const { error } = await supabase
        .from("facturation_periodes")
        .update({ supprime: true })
        .in("id", obsoleteIds);
      if (error) console.error("Cleanup obsolete periodes error:", error);
    }

    queryClient.invalidateQueries({ queryKey });
  }, [etablissement, etablissementId, queryClient, queryKey]);

  const updatePeriode = useMutation({
    mutationFn: async (params: { id: string; updates: Partial<Pick<FacturationPeriode, "montant_prevu" | "montant_percu" | "statut" | "notes" | "date_debut" | "date_fin" | "date_facture" | "date_virement_estimee">> }) => {
      const normalizeDate = (value: string | null | undefined) => {
        if (!value) return value;
        const parsed = parseISO(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return format(parsed, "yyyy-MM-dd");
      };

      const normalizedUpdates = {
        ...params.updates,
        date_debut: normalizeDate(params.updates.date_debut),
        date_fin: normalizeDate(params.updates.date_fin),
        date_facture: normalizeDate(params.updates.date_facture),
        date_virement_estimee: normalizeDate(params.updates.date_virement_estimee),
      };

      // Nettoyage des lignes soft-deleted qui peuvent bloquer l'édition (conflit unique sur date_debut)
      if (normalizedUpdates.date_debut) {
        const { data: currentPeriode, error: currentPeriodeError } = await supabase
          .from("facturation_periodes")
          .select("etablissement_id, type_periode")
          .eq("id", params.id)
          .maybeSingle();
        if (currentPeriodeError) throw currentPeriodeError;
        if (!currentPeriode) throw new Error("Période introuvable");

        const { error: cleanupError } = await supabase
          .from("facturation_periodes")
          .delete()
          .eq("etablissement_id", currentPeriode.etablissement_id)
          .eq("type_periode", currentPeriode.type_periode || "recurrent")
          .eq("date_debut", normalizedUpdates.date_debut)
          .eq("supprime", true)
          .neq("id", params.id);
        if (cleanupError) throw cleanupError;
      }

      const { error } = await supabase
        .from("facturation_periodes")
        .update({
          ...normalizedUpdates,
          est_modifie_manuellement: true,
          supprime: false,
        } as unknown as Database['public']['Tables']['facturation_periodes']['Update'])
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour"),
  });

  /**
   * Cascade complète : recalcule toutes les périodes "prévue" suivantes
   * en conservant la durée de périodicité de l'établissement.
   */
  const cascadeFromPeriode = useCallback(async (editedPeriodeId: string) => {
    if (!etablissement) return;

    // Récupérer les périodes à jour
    const { data: allPeriodes } = await supabase
      .from("facturation_periodes")
      .select("*")
      .eq("etablissement_id", etablissementId)
      .eq("supprime", false)
      .eq("type_periode", "recurrent")
      .order("date_debut", { ascending: true });

    if (!allPeriodes || allPeriodes.length === 0) return;

    const periodicite = etablissement.periodicite_paiement || "mensuel";
    const increment = getPeriodiciteMonths(periodicite);

    // Trouver l'index de la période éditée
    const editedIdx = allPeriodes.findIndex((p) => p.id === editedPeriodeId);
    if (editedIdx < 0) return;

    const editedPeriode = allPeriodes[editedIdx];
    let updates = 0;

    // Recaler toutes les périodes suivantes qui sont "prévue"
    let prevDateFin = parseISO(editedPeriode.date_fin);

    for (let i = editedIdx + 1; i < allPeriodes.length; i++) {
      const p = allPeriodes[i];
      if (p.statut !== "prevue") break; // Arrêter à la première période verrouillée

      const newDebut = addDays(prevDateFin, 1);
      const newFin = subDays(addMonths(newDebut, increment), 1);
      const newDebutStr = format(newDebut, "yyyy-MM-dd");
      const newFinStr = format(newFin, "yyyy-MM-dd");

      // Nettoyer les tombstones éventuels
      await supabase
        .from("facturation_periodes")
        .delete()
        .eq("etablissement_id", etablissementId)
        .eq("date_debut", newDebutStr)
        .eq("supprime", true)
        .neq("id", p.id);

      const { error } = await supabase
        .from("facturation_periodes")
        .update({
          date_debut: newDebutStr,
          date_fin: newFinStr,
          est_modifie_manuellement: false,
        } as unknown as Database['public']['Tables']['facturation_periodes']['Update'])
        .eq("id", p.id);

      if (error) {
        console.error("Cascade update error:", error);
        break;
      }

      prevDateFin = newFin;
      updates++;
    }

    queryClient.invalidateQueries({ queryKey });
    if (updates > 0) {
      toast.success(`${updates + 1} période(s) recalée(s)`);
    } else {
      toast.success("Période mise à jour");
    }
  }, [etablissement, etablissementId, queryClient, queryKey]);

  const regenererFutures = useCallback(async (groupeEtablissementIds?: string[]) => {
    if (!etablissement) return;

    // If group propagation requested, regenerate for each member
    const targetIds = groupeEtablissementIds && groupeEtablissementIds.length > 0
      ? groupeEtablissementIds
      : [etablissementId];

    for (const targetId of targetIds) {
      await regenererForEtablissement(targetId);
    }

    // Invalidate caches for all targets
    for (const targetId of targetIds) {
      queryClient.invalidateQueries({ queryKey: ["facturation-periodes", targetId] });
    }
    toast.success(
      targetIds.length > 1
        ? `Périodes régénérées pour ${targetIds.length} établissements du groupe`
        : "Périodes prévues régénérées (3 ans max)"
    );
  }, [etablissement, etablissementId, queryClient]);

  const regenererForEtablissement = useCallback(async (targetId: string) => {
    if (!etablissement) return;

    const referenceDate = getReferenceDate(etablissement);
    if (!referenceDate) return;

    // Point de reprise: lendemain de la dernière période non "prévue" (encaissée/facturée/etc.)
    const { data: lastLockedPeriode } = await supabase
      .from("facturation_periodes")
      .select("date_fin")
      .eq("etablissement_id", targetId)
      .eq("supprime", false)
      .neq("statut", "prevue")
      .order("date_fin", { ascending: false })
      .limit(1);

    const startFromDate = lastLockedPeriode?.[0]?.date_fin
      ? addDays(parseISO(lastLockedPeriode[0].date_fin), 1)
      : referenceDate;

    const startKey = format(startFromDate, "yyyy-MM-dd");

    // Écraser tout le "suivant": toutes les périodes prévues + tombstones soft-deleted à partir du point de reprise
    await Promise.all([
      supabase
        .from("facturation_periodes")
        .delete()
        .eq("etablissement_id", targetId)
        .eq("supprime", false)
        .eq("statut", "prevue")
        .gte("date_debut", startKey),
      supabase
        .from("facturation_periodes")
        .delete()
        .eq("etablissement_id", targetId)
        .eq("supprime", true)
        .gte("date_debut", startKey),
    ]);

    // Régénération bornée à 3 ans max depuis le point de reprise
    const expected = generateExpectedPeriodes(etablissement, startFromDate);
    if (expected.length === 0) return;

    const snapshot = buildModeleSnapshot(etablissement);
    const toInsert = expected.map((p) => ({
      etablissement_id: targetId,
      date_debut: format(p.date_debut, "yyyy-MM-dd"),
      date_fin: format(p.date_fin, "yyyy-MM-dd"),
      montant_prevu: p.montant_prevu,
      modele_snapshot: (snapshot as never),
      statut: "prevue",
      type_periode: p.type_periode,
      supprime: false,
      est_modifie_manuellement: false,
    }));

    const { error } = await supabase
      .from("facturation_periodes")
      .upsert(toInsert, { onConflict: "etablissement_id,date_debut,type_periode", ignoreDuplicates: true });
    if (error) throw error;
  }, [etablissement]);

  const deletePeriode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("facturation_periodes")
        .update({ supprime: true, est_modifie_manuellement: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Période supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  return {
    periodes: periodes || [],
    isLoading,
    syncPeriodes,
    updatePeriode,
    deletePeriode,
    regenererFutures,
    cascadeFromPeriode,
  };
}
