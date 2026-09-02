/**
 * Mock Providers pour les tutoriels
 * Permet d'utiliser les vrais composants avec des données mockées
 */

import { memo, ReactNode } from 'react'

/**
 * Wrapper qui désactive les interactions tout en gardant l'apparence
 */
export const TutorielPreviewWrapper = memo(({ children, scale = 1 }: { children: ReactNode; scale?: number }) => (
  <div 
    className="pointer-events-none select-none"
    style={{ 
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      transformOrigin: 'top left'
    }}
  >
    {children}
  </div>
))
TutorielPreviewWrapper.displayName = 'TutorielPreviewWrapper'

/**
 * Données mockées pour HeroMetrics - exactement les mêmes props que le vrai composant
 */
export const mockHeroMetricsProps = {
  totalEtablissements: 127,
  prospects: 45,
  contractuels: 32,
  production: 50,
  totalValeur: 2450000,
  urgentTasksCount: 8,
  conversionRate: 42,
  totalBloques: 3,
  valeurBloquee: 85000
}

/**
 * Données mockées pour EmailListItemModern
 */
export const mockEmailThread = {
  id: 'demo-thread-1',
  thread_id: 'demo-thread-1',
  user_email_account_id: 'demo-account',
  subject: 'RE: Déploiement solution OpenPulse - Cabinet Les Tilleuls',
  last_message_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  message_count: 5,
  unread_count: 2,
  participants: [
    { name: 'Marie Dupont', email: 'marie.dupont@cabinet-glycines.example.org' },
    { name: 'Pierre Martin', email: 'p.martin@exploitant.example.org' }
  ],
  category: 'Commercial' as const,
  priority: 'haute' as const,
  ai_summary: 'Discussion sur le planning de déploiement prévu pour janvier 2025. Demande de confirmation des dates de formation.',
  ai_generated_title: 'Planification déploiement Cabinet Les Tilleuls',
  tags: ['déploiement', 'formation', 'janvier-2025'],
  etablissement_id: 'demo-etab-1',
  groupe_id: null,
  partenaire_id: null,
  is_archived: false,
  is_deleted: false,
  is_spam: false,
  is_hors_etablissement: false,
  created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
}

export const mockEmailThreads = [
  {
    ...mockEmailThread,
    id: 'demo-thread-1',
    category: 'Commercial',
    unread_count: 2,
    ai_generated_title: 'Planification déploiement Cabinet Les Tilleuls',
    message_count: 5,
    priority: 'haute' as const,
  },
  {
    ...mockEmailThread,
    id: 'demo-thread-2',
    category: 'Support',
    unread_count: 0,
    ai_generated_title: 'Problème connexion module cotation',
    message_count: 3,
    priority: 'moyenne' as const,
    etablissement_id: 'demo-etab-2',
  },
  {
    ...mockEmailThread,
    id: 'demo-thread-3',
    category: 'Administratif',
    unread_count: 1,
    ai_generated_title: 'Facturation Q4 2024',
    message_count: 2,
    priority: 'basse' as const,
    etablissement_id: 'demo-etab-3',
  }
]

/**
 * Données mockées pour EnhancedEtablissementCard
 */
export const mockEtablissement = {
  id: 'demo-etab-1',
  nom: 'Cabinet Les Tilleuls de Provence',
  type_etablissement: 'Cabinet',
  statut: 'Production',
  ville: 'Aix-en-Provence',
  code_postal: '13100',
  adresse: '15 Avenue des Oliviers',
  region: 'Provence-Alpes-Côte d\'Azur',
  potentiel_ca: 45000,
  nombre_lits: 120,
  date_signature: '2024-06-15',
  date_go_live: '2024-09-01',
  logo_url: null,
  progression: 75,
  dpi_actuel: 'Axigate',
  type_offre: 'Licence',
  commercial_id: 'user-1',
  chef_projet_id: 'user-2',
  csm_id: 'user-3',
  created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString()
}

export const mockProfiles = [
  { id: 'user-1', prenom: 'Sophie', nom: 'Bernard', email: 's.bernard@marque.ai', avatar_url: null },
  { id: 'user-2', prenom: 'Thomas', nom: 'Martin', email: 't.martin@marque.ai', avatar_url: null },
  { id: 'user-3', prenom: 'Julie', nom: 'Petit', email: 'j.petit@marque.ai', avatar_url: null },
]

/**
 * Données mockées enrichies pour les threads email
 * Compatible avec ThreadEnrichedData type
 */
import type { ThreadEnrichedData } from '@/hooks/email/useThreadsEnrichedData'

const defaultGroupeInfo = {
  hasMultipleEtablissementsInGroupe: false,
  groupeNom: null,
  groupeId: null,
  etablissementNames: []
}

export const mockThreadEnrichedData = new Map<string, ThreadEnrichedData>([
  ['demo-thread-1', {
    groupeInfo: defaultGroupeInfo,
    contact: { nom: 'Marie Dupont', fonction: 'Directrice' },
    contactRole: 'direction',
    isInternalTeam: false,
    internalRole: null,
    imageCount: 0,
    entityLogoUrl: null,
    internalProfileAvatarUrl: null,
    hasReply: true,
    groupeFromDomain: null,
    externalEntityForInternal: null
  }],
  ['demo-thread-2', {
    groupeInfo: defaultGroupeInfo,
    contact: { nom: 'Jean Lefebvre', fonction: 'DSI' },
    contactRole: 'informatique',
    isInternalTeam: false,
    internalRole: null,
    imageCount: 0,
    entityLogoUrl: null,
    internalProfileAvatarUrl: null,
    hasReply: false,
    groupeFromDomain: null,
    externalEntityForInternal: null
  }],
  ['demo-thread-3', {
    groupeInfo: defaultGroupeInfo,
    contact: { nom: 'Sophie Martin', fonction: 'RAF' },
    contactRole: 'administratif',
    isInternalTeam: false,
    internalRole: null,
    imageCount: 0,
    entityLogoUrl: null,
    internalProfileAvatarUrl: null,
    hasReply: true,
    groupeFromDomain: null,
    externalEntityForInternal: null
  }]
])
