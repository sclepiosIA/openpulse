/**
 * Query presets for React Query configuration
 * Differentiated staleTime based on data type for optimal performance
 */

export const queryPresets = {
  /**
   * Real-time data that should always be fresh
   * Use for: notifications, live chat, active presence
   */
  realtime: { 
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  
  /**
   * Frequently updated data
   * Use for: messages, badges, activity feeds
   */
  frequent: { 
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  
  /**
   * Standard data refresh rate (current default)
   * Use for: etablissements, contacts, taches, factures
   */
  standard: { 
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  
  /**
   * Reference data that changes infrequently
   * Use for: templates, categories, teams, competences, booking types
   */
  reference: { 
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },
  
  /**
   * Static/configuration data
   * Use for: system settings, tutorials, help content
   */
  static: { 
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  },
} as const;

export type QueryPreset = keyof typeof queryPresets;

/**
 * Helper to get preset configuration
 */
export function getQueryPreset(preset: QueryPreset) {
  return queryPresets[preset];
}
