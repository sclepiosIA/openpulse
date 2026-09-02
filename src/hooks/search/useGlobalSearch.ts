/**
 * Recherche globale — orchestrateur.
 *
 * DEBT-02 (session 72) : ce fichier ne contient plus que la composition.
 * Les 45 requêtes `useQuery` sont réparties dans `./parts/` :
 *   - useCoreSearch      (10 entités centrales)
 *   - useOpsSearch       (5 entités opérationnelles)
 *   - useBusinessSearch  (13 entités métier)
 *   - useAdminSearch     (10 entités admin/config)
 *   - useFinanceSearch   (7 entités finance/RH)
 */
import { useMemo } from "react";
import { useDebounce } from "@/hooks/shared/useDebounce";
import {
  type SearchResult,
  type SearchResults,
  type SearchPermissions,
  EMPTY_RESULTS,
} from "./useGlobalSearch.types";
import { useCoreSearch } from "./parts/useCoreSearch";
import { useOpsSearch } from "./parts/useOpsSearch";
import { useBusinessSearch } from "./parts/useBusinessSearch";
import { useAdminSearch } from "./parts/useAdminSearch";
import { useFinanceSearch } from "./parts/useFinanceSearch";

export type { SearchResult, SearchPermissions };

export function useGlobalSearch(
  searchQuery: string,
  enabled: boolean = true,
  permissions?: SearchPermissions,
) {
  const debouncedSearch = useDebounce(searchQuery, 300);
  const shouldSearch = enabled && debouncedSearch.length >= 2;

  const core = useCoreSearch(debouncedSearch, shouldSearch, permissions);
  const ops = useOpsSearch(debouncedSearch, shouldSearch, permissions);
  const business = useBusinessSearch(debouncedSearch, shouldSearch);
  const admin = useAdminSearch(debouncedSearch, shouldSearch, permissions);
  const finance = useFinanceSearch(debouncedSearch, shouldSearch);

  const isLoading =
    core.isLoading || ops.isLoading || business.isLoading ||
    admin.isLoading || finance.isLoading;

  const results: SearchResults = useMemo(() => {
    if (!shouldSearch) return EMPTY_RESULTS;
    return {
      ...core.slice,
      ...ops.slice,
      ...business.slice,
      ...admin.slice,
      ...finance.slice,
    };
  }, [shouldSearch, core.slice, ops.slice, business.slice, admin.slice, finance.slice]);

  return {
    results,
    isLoading: shouldSearch && isLoading,
  };
}
