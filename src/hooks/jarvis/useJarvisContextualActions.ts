/**
 * useJarvisContextualActions - Actions rapides contextuelles
 * 
 * Génère des actions rapides basées sur la page actuelle et le contexte
 */

import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useJarvisFocus } from './useJarvisFocus';

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  category: 'query' | 'action' | 'analysis';
  priority: number;
}

interface UseJarvisContextualActionsReturn {
  quickActions: QuickAction[];
  contextLabel: string;
  hasContext: boolean;
}

// Actions globales disponibles partout
const GLOBAL_ACTIONS: QuickAction[] = [
  { id: 'daily_summary', icon: '📊', label: 'Résumé du jour', prompt: 'Fais-moi un résumé de mon activité du jour', category: 'analysis', priority: 1 },
  { id: 'urgent_tasks', icon: '🔥', label: 'Tâches urgentes', prompt: 'Quelles sont mes tâches les plus urgentes ?', category: 'query', priority: 2 },
  { id: 'unread_emails', icon: '📧', label: 'Emails non lus', prompt: 'Résume mes emails non lus importants', category: 'query', priority: 3 },
];

// Actions spécifiques par route
const ROUTE_ACTIONS: Record<string, QuickAction[]> = {
  '/etablissements': [
    { id: 'pipeline_status', icon: '📈', label: 'État du pipeline', prompt: 'Analyse l\'état actuel du pipeline commercial', category: 'analysis', priority: 1 },
    { id: 'cold_prospects', icon: '❄️', label: 'Prospects froids', prompt: 'Liste les prospects sans interaction depuis plus de 30 jours', category: 'query', priority: 2 },
    { id: 'hot_prospects', icon: '🔥', label: 'Prospects chauds', prompt: 'Quels prospects sont proches de la signature ?', category: 'query', priority: 3 },
    { id: 'create_prospect', icon: '➕', label: 'Créer prospect', prompt: 'Je veux créer un nouveau prospect', category: 'action', priority: 4 },
  ],
  '/etablissements/:id': [
    { id: 'etab_summary', icon: '📋', label: 'Résumé établissement', prompt: 'Fais-moi un résumé complet de cet établissement', category: 'analysis', priority: 1 },
    { id: 'etab_tasks', icon: '✅', label: 'Tâches en cours', prompt: 'Quelles sont les tâches en cours pour cet établissement ?', category: 'query', priority: 2 },
    { id: 'etab_emails', icon: '📧', label: 'Derniers échanges', prompt: 'Résume les derniers échanges email avec cet établissement', category: 'query', priority: 3 },
    { id: 'schedule_meeting', icon: '📅', label: 'Planifier RDV', prompt: 'Planifie une réunion avec cet établissement', category: 'action', priority: 4 },
  ],
  '/emails': [
    { id: 'inbox_summary', icon: '📬', label: 'Résumé inbox', prompt: 'Résume ma boîte de réception', category: 'analysis', priority: 1 },
    { id: 'urgent_replies', icon: '⚡', label: 'À répondre', prompt: 'Quels emails nécessitent une réponse urgente ?', category: 'query', priority: 2 },
    { id: 'draft_response', icon: '✍️', label: 'Rédiger réponse', prompt: 'Aide-moi à rédiger une réponse professionnelle', category: 'action', priority: 3 },
  ],
  '/people': [
    { id: 'payroll_summary', icon: '💰', label: 'Masse salariale', prompt: 'Quelle est la masse salariale du mois en cours ?', category: 'query', priority: 1 },
    { id: 'absences_today', icon: '🏖️', label: 'Absences du jour', prompt: 'Qui est absent aujourd\'hui ?', category: 'query', priority: 2 },
    { id: 'upcoming_birthdays', icon: '🎂', label: 'Anniversaires', prompt: 'Quels sont les anniversaires à venir cette semaine ?', category: 'query', priority: 3 },
  ],
  '/tresorerie': [
    { id: 'cash_status', icon: '💳', label: 'État de trésorerie', prompt: 'Quel est l\'état actuel de la trésorerie ?', category: 'query', priority: 1 },
    { id: 'pending_invoices', icon: '📄', label: 'Factures en attente', prompt: 'Quelles factures sont en attente de paiement ?', category: 'query', priority: 2 },
    { id: 'sync_qonto', icon: '🔄', label: 'Sync Qonto', prompt: 'Synchronise les transactions Qonto des 30 derniers jours', category: 'action', priority: 3 },
    { id: 'cash_forecast', icon: '📊', label: 'Prévisions', prompt: 'Quelle est la prévision de trésorerie pour les 3 prochains mois ?', category: 'analysis', priority: 4 },
  ],
  '/rd': [
    { id: 'sprint_status', icon: '🏃', label: 'État du sprint', prompt: 'Quel est l\'état du sprint actuel ?', category: 'query', priority: 1 },
    { id: 'velocity', icon: '📈', label: 'Vélocité équipe', prompt: 'Quelle est la vélocité moyenne de l\'équipe ?', category: 'analysis', priority: 2 },
    { id: 'blocked_stories', icon: '🚧', label: 'Stories bloquées', prompt: 'Y a-t-il des user stories bloquées ?', category: 'query', priority: 3 },
    { id: 'create_story', icon: '➕', label: 'Créer story', prompt: 'Je veux créer une nouvelle user story', category: 'action', priority: 4 },
  ],
  '/support': [
    { id: 'support_kpis', icon: '📊', label: 'KPIs support', prompt: 'Quels sont les KPIs de support actuels ?', category: 'analysis', priority: 1 },
    { id: 'urgent_tickets', icon: '🚨', label: 'Tickets urgents', prompt: 'Quels tickets nécessitent une attention immédiate ?', category: 'query', priority: 2 },
    { id: 'unassigned', icon: '👤', label: 'Non assignés', prompt: 'Y a-t-il des tickets non assignés ?', category: 'query', priority: 3 },
  ],
  '/recrutement': [
    { id: 'active_offers', icon: '📢', label: 'Offres actives', prompt: 'Quelles sont les offres d\'emploi actuellement actives ?', category: 'query', priority: 1 },
    { id: 'pending_interviews', icon: '🗓️', label: 'Entretiens', prompt: 'Quels entretiens sont planifiés cette semaine ?', category: 'query', priority: 2 },
    { id: 'top_candidates', icon: '🌟', label: 'Top candidats', prompt: 'Quels sont les meilleurs candidats en cours ?', category: 'analysis', priority: 3 },
  ],
};

// Context labels par route
const ROUTE_LABELS: Record<string, string> = {
  '/etablissements': 'CRM',
  '/emails': 'Messagerie',
  '/people': 'RH',
  '/tresorerie': 'Trésorerie',
  '/rd': 'R&D',
  '/support': 'Support',
  '/recrutement': 'Recrutement',
};

export function useJarvisContextualActions(): UseJarvisContextualActionsReturn {
  const location = useLocation();
  const params = useParams();
  const { focusContext, hasFocus } = useJarvisFocus();

  const { quickActions, contextLabel, hasContext } = useMemo(() => {
    const path = location.pathname;
    
    // Determine the route key (handle dynamic routes)
    let routeKey = path;
    if (params.id && path.includes('/etablissements/')) {
      routeKey = '/etablissements/:id';
    }

    // Get route-specific actions
    const routeActions = ROUTE_ACTIONS[routeKey] || [];

    // Combine with global actions, avoiding duplicates
    const combinedActions = [...routeActions];
    
    // Add global actions that don't overlap
    for (const globalAction of GLOBAL_ACTIONS) {
      if (!combinedActions.some(a => a.id === globalAction.id)) {
        combinedActions.push(globalAction);
      }
    }

    // Add focus-specific action if there's an etablissement in focus
    if (hasFocus && focusContext.etablissement_id && focusContext.etablissement_name) {
      combinedActions.unshift({
        id: 'focus_etab',
        icon: '🎯',
        label: `Focus: ${focusContext.etablissement_name.substring(0, 15)}${focusContext.etablissement_name.length > 15 ? '...' : ''}`,
        prompt: `Donne-moi un résumé complet de l'établissement ${focusContext.etablissement_name}`,
        category: 'analysis',
        priority: 0,
      });
    }

    // Sort by priority and limit to 6
    const sortedActions = combinedActions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 6);

    // Determine context label
    let label = 'Général';
    for (const [route, routeLabel] of Object.entries(ROUTE_LABELS)) {
      if (path.startsWith(route)) {
        label = routeLabel;
        break;
      }
    }

    return {
      quickActions: sortedActions,
      contextLabel: label,
      hasContext: routeActions.length > 0 || hasFocus,
    };
  }, [location.pathname, params.id, focusContext, hasFocus]);

  return {
    quickActions,
    contextLabel,
    hasContext,
  };
}
