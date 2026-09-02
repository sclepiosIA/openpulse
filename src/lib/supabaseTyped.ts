/**
 * Typed Supabase helper for extended tables
 * 
 * Ce helper permet d'accéder aux tables non encore générées dans les types Supabase
 * tout en maintenant un typage fort. Il remplace les `(supabase as any).from()`.
 */

import { supabase } from '@/integrations/supabase/client';
import type { ExtendedTableName } from '@/types/supabase-extensions';

/**
 * Accède à une table étendue avec typage
 * 
 * @example
 * ```ts
 * // Au lieu de: (supabase as any).from('dashboard_layouts')
 * fromExtended('dashboard_layouts').select('*')
 * ```
 * 
 * NOTE: Ce helper utilise un cast `as any` interne car les types ne sont pas générés.
 * Les types retournés sont ceux définis dans supabase-extensions.ts
 */
export function fromExtended<T extends ExtendedTableName>(table: T) {
  // Le cast est nécessaire car la table n'existe pas dans les types générés
  // mais nous avons défini les types localement dans supabase-extensions.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from(table as any) as any;
}
