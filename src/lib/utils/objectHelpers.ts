/**
 * Removes all keys with undefined values from an object
 * Also removes empty strings for UUID fields to prevent PostgreSQL errors
 * This is useful when preparing data for Supabase to avoid PostgreSQL errors with empty optional fields
 */
export function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const uuidFields = [
    'commercial_id', 
    'chef_projet_id', 
    'csm_id', 
    'responsable_id', 
    'etablissement_id', 
    'groupe_id', 
    'partenaire_id', 
    'responsable_marque_id'
  ];
  
  return Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => {
      if (value === undefined) return false;
      // Remove empty strings for UUID fields to prevent PostgreSQL "invalid uuid" errors
      if (uuidFields.includes(key) && (value === '' || value === 'none' || value === 'unassigned')) {
        return false;
      }
      return true;
    })
  ) as Partial<T>
}
