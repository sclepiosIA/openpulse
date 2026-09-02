import {
  Info,
  Users,
  MessageSquare,
  Receipt,
  ListChecks,
  TrendingUp,
  BarChart3,
  UserCog,
  FileText as FileIcon,
  ExternalLink,
} from "lucide-react"
import type React from "react"

/**
 * Catégorie d'onglets de la page détail établissement.
 * Extrait depuis EtablissementDetail.tsx (S87) pour alléger le god-component.
 */
export type TabCategory = {
  label: string
  icon: React.ComponentType<any>
  tabs: string[]
  productionOnly?: boolean
}

export const TAB_CATEGORIES: Record<string, TabCategory> = {
  informations: {
    label: 'Informations',
    icon: Info,
    tabs: ['infos'],
  },
  contacts: {
    label: 'Contacts',
    icon: Users,
    tabs: ['contacts'],
  },
  communication: {
    label: 'Communication',
    icon: MessageSquare,
    tabs: ['emails', 'interactions', 'activite-unifiee', 'synthese-ia', 'scoring'],
  },
  facturation: {
    label: 'Facturation',
    icon: Receipt,
    tabs: ['facturation'],
  },
  gestion: {
    label: 'Gestion',
    icon: ListChecks,
    tabs: ['taches', 'kanban', 'agenda', 'gantt'],
  },
  customer_success: {
    label: 'Customer Success',
    icon: TrendingUp,
    tabs: [
      'csm-sante',
      'csm-parcours',
      'csm-facturation',
      'csm-kpis-mensuels',
      'csm-kpis-trimestriels',
      'csm-playbooks',
      'enquetes',
    ],
    productionOnly: true,
  },
  statistiques: {
    label: 'Statistiques',
    icon: BarChart3,
    tabs: ['stats-utilisation', 'stats-urgences'],
    productionOnly: true,
  },
  equipe: {
    label: 'Équipe',
    icon: UserCog,
    tabs: ['equipe'],
  },
  documents: {
    label: 'Documents',
    icon: FileIcon,
    tabs: ['documents'],
  },
  portail_client: {
    label: 'Portail client',
    icon: ExternalLink,
    tabs: ['portail-client'],
  },
}

/** Map onglet → catégorie parente. */
export const TAB_TO_CATEGORY: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  Object.entries(TAB_CATEGORIES).forEach(([categoryKey, category]) => {
    category.tabs.forEach((tab) => {
      map[tab] = categoryKey
    })
  })
  return map
})()
