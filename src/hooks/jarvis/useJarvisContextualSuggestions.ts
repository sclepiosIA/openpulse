/**
 * useJarvisContextualSuggestions - Hook pour suggestions contextuelles Jarvis 8.0
 * 
 * Génère des suggestions intelligentes basées sur la page actuelle et l'entité visualisée.
 * Ces suggestions sont pré-remplies et exécutables en un clic.
 */

import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useJarvisPageContext } from './useJarvisPageContext';

export interface ContextualSuggestion {
  id: string;
  label: string;
  command: string;
  icon: 'summary' | 'task' | 'email' | 'chart' | 'alert' | 'calendar' | 'search' | 'edit';
  priority: number; // 1-5, 1 being highest
  category: 'analyze' | 'action' | 'navigate' | 'create';
}

interface PageSuggestionConfig {
  pattern: RegExp;
  suggestions: (entityName?: string, entityId?: string) => ContextualSuggestion[];
}

const PAGE_SUGGESTIONS: PageSuggestionConfig[] = [
  // Établissement detail page
  {
    pattern: /^\/etablissements\/([a-f0-9-]+)/,
    suggestions: (entityName, entityId) => [
      {
        id: 'resume-etablissement',
        label: 'Résumer cet établissement',
        command: entityName 
          ? `Résume l'établissement "${entityName}" avec son historique, ses contacts et sa santé client`
          : 'Résume cet établissement avec son historique, ses contacts et sa santé client',
        icon: 'summary',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'taches-etablissement',
        label: 'Tâches en attente',
        command: entityName 
          ? `Liste les tâches en attente pour l'établissement "${entityName}"`
          : 'Liste les tâches en attente pour cet établissement',
        icon: 'task',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'historique-echanges',
        label: 'Historique des échanges',
        command: entityName 
          ? `Montre-moi l'historique des échanges emails avec "${entityName}"`
          : 'Montre-moi l\'historique des échanges emails avec cet établissement',
        icon: 'email',
        priority: 3,
        category: 'analyze',
      },
      {
        id: 'sante-client',
        label: 'Analyser la santé client',
        command: entityName 
          ? `Analyse la santé client de "${entityName}" et suggère des actions`
          : 'Analyse la santé client de cet établissement et suggère des actions',
        icon: 'chart',
        priority: 4,
        category: 'analyze',
      },
      {
        id: 'creer-tache-etab',
        label: 'Créer une tâche',
        command: entityName 
          ? `Crée une tâche de suivi pour "${entityName}"`
          : 'Crée une tâche de suivi pour cet établissement',
        icon: 'edit',
        priority: 5,
        category: 'create',
      },
    ],
  },
  // Liste établissements
  {
    pattern: /^\/etablissements$/,
    suggestions: () => [
      {
        id: 'pipeline-overview',
        label: 'Vue d\'ensemble du pipeline',
        command: 'Montre-moi un résumé du pipeline commercial avec les opportunités par statut',
        icon: 'chart',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'prospects-chauds',
        label: 'Prospects les plus chauds',
        command: 'Quels sont les prospects les plus actifs qui nécessitent une relance ?',
        icon: 'alert',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'etablissements-risque',
        label: 'Clients à risque',
        command: 'Identifie les clients à risque de churn avec les signaux d\'alerte',
        icon: 'alert',
        priority: 3,
        category: 'analyze',
      },
    ],
  },
  // Prospects
  {
    pattern: /^\/prospects/,
    suggestions: () => [
      {
        id: 'prospects-prioritaires',
        label: 'Prospects prioritaires',
        command: 'Liste les prospects prioritaires à contacter cette semaine avec leur potentiel',
        icon: 'chart',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'relances-suggerees',
        label: 'Relances suggérées',
        command: 'Génère des suggestions de relance pour les prospects froids',
        icon: 'email',
        priority: 2,
        category: 'action',
      },
    ],
  },
  // Emails
  {
    pattern: /^\/emails/,
    suggestions: () => [
      {
        id: 'emails-urgents',
        label: 'Emails urgents',
        command: 'Résume mes emails urgents non lus avec les actions requises',
        icon: 'email',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'trier-emails',
        label: 'Trier par priorité',
        command: 'Trie mes emails par priorité et catégorie',
        icon: 'summary',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'emails-sans-reponse',
        label: 'Emails sans réponse',
        command: 'Quels emails importants attendent une réponse de ma part ?',
        icon: 'alert',
        priority: 3,
        category: 'analyze',
      },
      {
        id: 'rediger-email',
        label: 'Rédiger un email',
        command: 'Aide-moi à rédiger un email professionnel',
        icon: 'edit',
        priority: 4,
        category: 'create',
      },
    ],
  },
  // Trésorerie
  {
    pattern: /^\/tresorerie/,
    suggestions: () => [
      {
        id: 'prevision-tresorerie',
        label: 'Prévision 30 jours',
        command: 'Génère une prévision de trésorerie pour les 30 prochains jours',
        icon: 'chart',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'factures-impayees',
        label: 'Factures impayées',
        command: 'Liste les factures impayées avec les montants et les retards',
        icon: 'alert',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'kpi-tresorerie',
        label: 'KPIs trésorerie',
        command: 'Affiche les KPIs clés de trésorerie : solde, DSO, encours',
        icon: 'chart',
        priority: 3,
        category: 'analyze',
      },
      {
        id: 'relance-paiement',
        label: 'Générer des relances',
        command: 'Génère des emails de relance pour les factures en retard',
        icon: 'email',
        priority: 4,
        category: 'action',
      },
    ],
  },
  // RH / People
  {
    pattern: /^\/people/,
    suggestions: () => [
      {
        id: 'absences-prevues',
        label: 'Absences prévues',
        command: 'Quelles sont les absences prévues cette semaine et le mois prochain ?',
        icon: 'calendar',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'masse-salariale',
        label: 'Synthèse masse salariale',
        command: 'Affiche une synthèse de la masse salariale avec l\'évolution',
        icon: 'chart',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'certificats-expirant',
        label: 'Certificats expirant',
        command: 'Quels certificats ou documents RH arrivent à expiration ?',
        icon: 'alert',
        priority: 3,
        category: 'analyze',
      },
      {
        id: 'onboarding-status',
        label: 'Statut onboarding',
        command: 'Quel est le statut des onboardings en cours ?',
        icon: 'task',
        priority: 4,
        category: 'analyze',
      },
    ],
  },
  // R&D
  {
    pattern: /^\/rd/,
    suggestions: () => [
      {
        id: 'avancement-sprint',
        label: 'Avancement du sprint',
        command: 'Quel est l\'avancement du sprint en cours avec la vélocité ?',
        icon: 'chart',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'burndown-sprint',
        label: 'Burndown chart',
        command: 'Analyse le burndown chart et prédit si le sprint sera livré à temps',
        icon: 'chart',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'stories-bloquees',
        label: 'User stories bloquées',
        command: 'Quelles user stories sont bloquées ou en retard ?',
        icon: 'alert',
        priority: 3,
        category: 'analyze',
      },
      {
        id: 'creer-story',
        label: 'Créer une user story',
        command: 'Aide-moi à rédiger une user story bien structurée',
        icon: 'edit',
        priority: 4,
        category: 'create',
      },
    ],
  },
  // Support
  {
    pattern: /^\/support/,
    suggestions: () => [
      {
        id: 'tickets-urgents',
        label: 'Tickets urgents',
        command: 'Liste les tickets support urgents non résolus',
        icon: 'alert',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'backlog-support',
        label: 'Analyser le backlog',
        command: 'Analyse le backlog support et suggère une priorisation',
        icon: 'chart',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'temps-resolution',
        label: 'Temps de résolution',
        command: 'Quel est le temps moyen de résolution des tickets cette semaine ?',
        icon: 'chart',
        priority: 3,
        category: 'analyze',
      },
    ],
  },
  // Formations
  {
    pattern: /^\/formations/,
    suggestions: () => [
      {
        id: 'sessions-a-venir',
        label: 'Sessions à venir',
        command: 'Liste les sessions de formation prévues ce mois-ci',
        icon: 'calendar',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'emargements-manquants',
        label: 'Émargements manquants',
        command: 'Quelles sessions ont des émargements incomplets ?',
        icon: 'alert',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'satisfaction-formations',
        label: 'Satisfaction formations',
        command: 'Quel est le score de satisfaction moyen des formations récentes ?',
        icon: 'chart',
        priority: 3,
        category: 'analyze',
      },
    ],
  },
  // Dashboard (home)
  {
    pattern: /^\/$/,
    suggestions: () => [
      {
        id: 'briefing-jour',
        label: 'Briefing du jour',
        command: 'Génère mon briefing du jour avec les tâches urgentes, emails et événements',
        icon: 'summary',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'mes-taches',
        label: 'Mes tâches prioritaires',
        command: 'Quelles sont mes tâches prioritaires pour aujourd\'hui ?',
        icon: 'task',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'kpis-globaux',
        label: 'KPIs globaux',
        command: 'Affiche les KPIs clés de l\'entreprise',
        icon: 'chart',
        priority: 3,
        category: 'analyze',
      },
      {
        id: 'alertes-actives',
        label: 'Alertes actives',
        command: 'Quelles sont les alertes et anomalies à traiter en priorité ?',
        icon: 'alert',
        priority: 4,
        category: 'analyze',
      },
    ],
  },
  // Recrutement
  {
    pattern: /^\/recrutement/,
    suggestions: () => [
      {
        id: 'candidats-attente',
        label: 'Candidats en attente',
        command: 'Quels candidats attendent une réponse depuis plus de 5 jours ?',
        icon: 'alert',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'pipeline-recrutement',
        label: 'Pipeline recrutement',
        command: 'Affiche le pipeline de recrutement par poste et statut',
        icon: 'chart',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'entretiens-semaine',
        label: 'Entretiens cette semaine',
        command: 'Quels entretiens sont prévus cette semaine ?',
        icon: 'calendar',
        priority: 3,
        category: 'analyze',
      },
    ],
  },
  // Calendrier
  {
    pattern: /^\/calendrier/,
    suggestions: () => [
      {
        id: 'agenda-semaine',
        label: 'Agenda de la semaine',
        command: 'Résume mon agenda de la semaine avec les événements importants',
        icon: 'calendar',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'conflits-horaires',
        label: 'Conflits horaires',
        command: 'Y a-t-il des conflits horaires dans mon planning ?',
        icon: 'alert',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'creer-evenement',
        label: 'Créer un événement',
        command: 'Planifie un événement dans mon calendrier',
        icon: 'edit',
        priority: 3,
        category: 'create',
      },
    ],
  },
];

export function useJarvisContextualSuggestions() {
  const location = useLocation();
  const params = useParams();
  const pageContext = useJarvisPageContext();
  
  const suggestions = useMemo((): ContextualSuggestion[] => {
    const path = location.pathname;
    
    // Find matching page config
    for (const config of PAGE_SUGGESTIONS) {
      const match = path.match(config.pattern);
      if (match) {
        const entityName = pageContext.primaryEntity?.name;
        const entityId = match[1] || pageContext.primaryEntity?.id;
        return config.suggestions(entityName, entityId);
      }
    }
    
    // Default suggestions if no specific page matched
    return [
      {
        id: 'aide-generale',
        label: 'Que puis-je faire ?',
        command: 'Explique-moi ce que tu peux faire pour m\'aider',
        icon: 'summary',
        priority: 1,
        category: 'analyze',
      },
    ];
  }, [location.pathname, pageContext.primaryEntity]);
  
  // Quick actions for header (top 3 most useful across all contexts)
  const quickActions = useMemo((): ContextualSuggestion[] => {
    return [
      {
        id: 'quick-briefing',
        label: 'Briefing',
        command: 'Génère mon briefing rapide : tâches urgentes, emails non lus, prochains événements',
        icon: 'summary',
        priority: 1,
        category: 'analyze',
      },
      {
        id: 'quick-emails',
        label: 'Emails',
        command: 'Résume mes emails urgents non lus',
        icon: 'email',
        priority: 2,
        category: 'analyze',
      },
      {
        id: 'quick-taches',
        label: 'Tâches',
        command: 'Quelles sont mes tâches prioritaires pour aujourd\'hui ?',
        icon: 'task',
        priority: 3,
        category: 'analyze',
      },
    ];
  }, []);
  
  return {
    suggestions,
    quickActions,
    pageType: pageContext.pageType,
    module: pageContext.module,
    entityName: pageContext.primaryEntity?.name,
    entityId: pageContext.primaryEntity?.id,
    isLoading: pageContext.isLoading,
  };
}
