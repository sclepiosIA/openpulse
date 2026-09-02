/**
 * Système de couleurs cohérent pour les statuts et priorités dans le module email
 * Utilise les tokens sémantiques du design system
 */

export const statusColors = {
  // Statuts établissement
  etablissement: {
    'Prospect': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Contractuel': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'En négociation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Suspendu': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'Refus': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    'Production': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  // Priorités tâches
  priority: {
    'haute': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    'moyenne': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    'basse': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  // Catégories email
  category: {
    'commercial': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'support': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    'administratif': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    'technique': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  // États partenaire
  partenaire: {
    'actif': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'prospect': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'inactif': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  }
} as const;

export const getPriorityColor = (priority: string | null) => {
  if (!priority) return '';
  const normalized = priority.toLowerCase();
  return statusColors.priority[normalized as keyof typeof statusColors.priority] || '';
};

export const getEtablissementStatusColor = (status: string) => {
  return statusColors.etablissement[status as keyof typeof statusColors.etablissement] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30';
};

export const getCategoryColor = (category: string | null) => {
  if (!category) return '';
  const normalized = category.toLowerCase();
  return statusColors.category[normalized as keyof typeof statusColors.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30';
};

export const getPartenaireStatusColor = (status: string) => {
  const normalized = status.toLowerCase();
  return statusColors.partenaire[normalized as keyof typeof statusColors.partenaire] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30';
};
