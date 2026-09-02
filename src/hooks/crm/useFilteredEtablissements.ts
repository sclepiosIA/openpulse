import { useMemo } from "react";
import type { SortField, SortDirection } from "@/components/etablissement/SortMenu";

interface UserProfileLite {
  id: string;
  role: string;
}

// Minimal shape we rely on for filter+sort. Extra fields are preserved via generic T.
interface EtabLike {
  id: string;
  nom: string;
  ville: string;
  region: string;
  statut: string;
  type?: string | null;
  dpi?: string | null;
  commercial_id?: string | null;
  chef_projet_id?: string | null;
  csm_id?: string | null;
  progression?: number | null;
  date_signature?: string | null;
  date_previsionnelle_signature?: string | null;
  created_at: string;
}

interface Params<T extends EtabLike> {
  source: T[] | undefined;
  debouncedSearchTerm: string;
  showOnlyMine: boolean;
  userProfile?: UserProfileLite | null;
  statutFilter: string | null;
  typeFilter: string | null;
  dpiFilter: string | null;
  regionFilter: string | null;
  commercialFilter: string | null;
  chefProjetFilter: string | null;
  csmFilter: string | null;
  signatureYearFilter: string | null;
  smartFilter: string | null;
  sortField: SortField;
  sortDirection: SortDirection;
}

export function useFilteredEtablissements<T extends EtabLike>({
  source,
  debouncedSearchTerm,
  showOnlyMine,
  userProfile,
  statutFilter,
  typeFilter,
  dpiFilter,
  regionFilter,
  commercialFilter,
  chefProjetFilter,
  csmFilter,
  signatureYearFilter,
  smartFilter,
  sortField,
  sortDirection,
}: Params<T>): T[] {
  return useMemo(() => {
    let list: T[] = source ? [...source] : [];

    if (debouncedSearchTerm) {
      const s = debouncedSearchTerm.toLowerCase();
      list = list.filter(e =>
        e.nom.toLowerCase().includes(s) ||
        e.ville.toLowerCase().includes(s) ||
        e.region.toLowerCase().includes(s) ||
        e.statut.toLowerCase().includes(s)
      );
    }

    if (showOnlyMine && userProfile) {
      list = list.filter(e => {
        switch (userProfile.role) {
          case 'commercial': return e.commercial_id === userProfile.id;
          case 'chef_projet': return e.chef_projet_id === userProfile.id;
          case 'csm': return e.csm_id === userProfile.id;
          default: return true;
        }
      });
    }

    if (statutFilter) {
      const statutList = statutFilter.split(',').map(s => s.trim());
      list = list.filter(e => statutList.includes(e.statut));
    }
    if (typeFilter) list = list.filter(e => e.type === typeFilter);
    if (dpiFilter) {
      const dpiList = dpiFilter.split(',').map(s => s.trim());
      list = list.filter(e => !!e.dpi && dpiList.includes(e.dpi));
    }
    if (regionFilter) list = list.filter(e => e.region === regionFilter);
    if (commercialFilter) list = list.filter(e => e.commercial_id === commercialFilter);
    if (chefProjetFilter) list = list.filter(e => e.chef_projet_id === chefProjetFilter);
    if (csmFilter) list = list.filter(e => e.csm_id === csmFilter);

    if (signatureYearFilter) {
      list = list.filter(e => {
        if (!e.date_previsionnelle_signature) return false;
        return new Date(e.date_previsionnelle_signature).getFullYear().toString() === signatureYearFilter;
      });
    }

    if (smartFilter === 'urgents') {
      list = list.filter(e => e.statut === 'Bloqué' || (e.progression || 0) < 30);
    } else if (smartFilter === 'echeances') {
      list = list.filter(e => {
        if (!e.date_previsionnelle_signature) return false;
        const days = (new Date(e.date_previsionnelle_signature).getTime() - Date.now()) / 86400000;
        return days > 0 && days <= 30;
      });
    } else if (smartFilter === 'nouveaux') {
      list = list.filter(e => {
        const days = (Date.now() - new Date(e.created_at).getTime()) / 86400000;
        return days <= 7;
      });
    }

    list.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;
      switch (sortField) {
        case 'nom': aValue = a.nom.toLowerCase(); bValue = b.nom.toLowerCase(); break;
        case 'date_creation': aValue = new Date(a.created_at).getTime(); bValue = new Date(b.created_at).getTime(); break;
        case 'progression': aValue = a.progression || 0; bValue = b.progression || 0; break;
        case 'date_signature':
          aValue = a.date_signature ? new Date(a.date_signature).getTime() : 0;
          bValue = b.date_signature ? new Date(b.date_signature).getTime() : 0;
          break;
        case 'ville': aValue = a.ville.toLowerCase(); bValue = b.ville.toLowerCase(); break;
        default: return 0;
      }
      if (aValue === bValue) return 0;
      return sortDirection === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });

    return list;
  }, [
    source, debouncedSearchTerm, showOnlyMine, userProfile,
    statutFilter, typeFilter, dpiFilter, regionFilter,
    commercialFilter, chefProjetFilter, csmFilter, signatureYearFilter,
    smartFilter, sortField, sortDirection,
  ]);
}
