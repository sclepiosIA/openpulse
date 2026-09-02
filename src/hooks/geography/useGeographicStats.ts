import { useMemo } from 'react';
import { useEtablissements } from '../crm/useEtablissements';
import { getAllRegions } from '@/lib/geography';

export interface GeographicStats {
  totalEtablissements: number;
  byRegion: Record<string, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPhase: Record<string, number>;
  topRegions: Array<{ region: string; count: number; byStatus: Record<string, number> }>;
  regionsCount: number;
  averagePerRegion: number;
  totalPassagesUrgences: number;
  conversionRate: number;
  coverageRate: number;
  evolution?: Array<{ date: string; count: number; region: string }>;
}

export function useGeographicStats() {
  const { data: etablissements, isLoading: loading } = useEtablissements();
  const allRegions = getAllRegions();

  const stats = useMemo((): GeographicStats => {
    if (!etablissements || etablissements.length === 0) {
      return {
        totalEtablissements: 0,
        byRegion: {},
        byStatus: {},
        byType: {},
        byPhase: {},
        topRegions: [],
        regionsCount: 0,
        averagePerRegion: 0,
        totalPassagesUrgences: 0,
        conversionRate: 0,
        coverageRate: 0,
      };
    }

    const byRegion: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const regionDetails: Record<string, Record<string, number>> = {};

    let totalPassagesUrgences = 0;
    let prospectsCount = 0;
    let productionCount = 0;

    type EtabGeo = { region?: string | null; statut?: string | null; type?: string | null; nombre_passages_urgences_annuel?: number | null };
    (etablissements as EtabGeo[]).forEach((etab) => {
      // Par région
      const region = etab.region || 'Non définie';
      byRegion[region] = (byRegion[region] || 0) + 1;

      // Par statut
      const statut = etab.statut || 'Non défini';
      byStatus[statut] = (byStatus[statut] || 0) + 1;

      // Par type
      const type = etab.type || 'Non défini';
      byType[type] = (byType[type] || 0) + 1;

      // Par phase
      let phase = 'Prospects';
      if (statut === 'Production') {
        phase = 'Production';
        productionCount++;
      } else if (['Contractuel', 'Conformité', 'Déploiement', 'Formation', 'Go-Live'].includes(statut)) {
        phase = 'Déploiement';
      } else {
        prospectsCount++;
      }
      byPhase[phase] = (byPhase[phase] || 0) + 1;

      // Détails par région et statut
      if (!regionDetails[region]) {
        regionDetails[region] = {};
      }
      regionDetails[region][statut] = (regionDetails[region][statut] || 0) + 1;

      // Totaux
      totalPassagesUrgences += etab.nombre_passages_urgences_annuel || 0;
    });

    // Top régions
    const topRegions = Object.entries(byRegion)
      .map(([region, count]) => ({
        region,
        count,
        byStatus: regionDetails[region] || {},
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const regionsCount = Object.keys(byRegion).length;
    const averagePerRegion = etablissements.length / regionsCount;
    const conversionRate = prospectsCount > 0 ? (productionCount / prospectsCount) * 100 : 0;
    const coverageRate = (regionsCount / allRegions.length) * 100;

    return {
      totalEtablissements: etablissements.length,
      byRegion,
      byStatus,
      byType,
      byPhase,
      topRegions,
      regionsCount,
      averagePerRegion: Math.round(averagePerRegion * 10) / 10,
      totalPassagesUrgences,
      conversionRate: Math.round(conversionRate * 10) / 10,
      coverageRate: Math.round(coverageRate * 10) / 10,
    };
  }, [etablissements, allRegions]);

  return { stats, loading };
}
