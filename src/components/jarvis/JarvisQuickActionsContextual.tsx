/**
 * JarvisQuickActionsContextual - Actions rapides contextuelles JARVIS 9.0
 * 
 * Affiche des actions rapides intelligentes basées sur:
 * - La page actuelle (module, entité)
 * - Les prédictions comportementales
 * - Les workflows fréquents de l'utilisateur
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Mail,
  CheckSquare,
  BarChart2,
  Zap,
  Calendar,
  DollarSign,
  Users,
  Ticket,
  RefreshCw,
  Clock,
  TrendingUp,
  Send,
  Archive,
  Languages,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useJarvisPageContext } from '@/hooks/jarvis/useJarvisPageContext';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

interface QuickAction {
  id: string;
  label: string;
  shortLabel: string;
  command: string;
  icon: keyof typeof ICON_MAP;
  category: 'routine' | 'productivity' | 'sales' | 'management';
  priority: number;
}

interface JarvisQuickActionsContextualProps {
  onExecute: (command: string) => void;
  isDisabled?: boolean;
  compact?: boolean;
  maxActions?: number;
}

const ICON_MAP = {
  summary: FileText,
  email: Mail,
  task: CheckSquare,
  chart: BarChart2,
  calendar: Calendar,
  money: DollarSign,
  users: Users,
  ticket: Ticket,
  sync: RefreshCw,
  clock: Clock,
  trend: TrendingUp,
  send: Send,
  archive: Archive,
  translate: Languages,
  zap: Zap,
};

// Actions par module
const MODULE_ACTIONS: Record<string, QuickAction[]> = {
  // Dashboard
  'dashboard': [
    { id: 'briefing', label: 'Briefing du jour', shortLabel: 'Briefing', command: 'Génère mon briefing complet du jour', icon: 'summary', category: 'routine', priority: 1 },
    { id: 'tasks', label: 'Tâches urgentes', shortLabel: 'Tâches', command: 'Liste mes tâches urgentes et en retard', icon: 'task', category: 'productivity', priority: 2 },
    { id: 'emails', label: 'Emails importants', shortLabel: 'Emails', command: 'Résume mes emails non lus importants', icon: 'email', category: 'routine', priority: 3 },
    { id: 'pipeline', label: 'État pipeline', shortLabel: 'Pipeline', command: 'Montre le résumé du pipeline commercial', icon: 'trend', category: 'sales', priority: 4 },
  ],
  
  // Établissements / CRM
  'etablissement': [
    { id: 'resume', label: 'Résumé établissement', shortLabel: 'Résumé', command: 'Résume cet établissement avec son historique récent', icon: 'summary', category: 'sales', priority: 1 },
    { id: 'email', label: 'Email de suivi', shortLabel: 'Email', command: 'Rédige un email de suivi pour cet établissement', icon: 'email', category: 'sales', priority: 2 },
    { id: 'task', label: 'Créer tâche', shortLabel: 'Tâche', command: 'Crée une tâche de suivi pour cet établissement', icon: 'task', category: 'productivity', priority: 3 },
    { id: 'history', label: 'Historique complet', shortLabel: 'Historique', command: 'Affiche l\'historique complet des interactions avec cet établissement', icon: 'clock', category: 'sales', priority: 4 },
  ],
  
  'etablissements': [
    { id: 'pipeline', label: 'Pipeline complet', shortLabel: 'Pipeline', command: 'Montre le pipeline commercial complet avec valeurs', icon: 'trend', category: 'sales', priority: 1 },
    { id: 'prospects', label: 'Prospects à relancer', shortLabel: 'Relances', command: 'Liste les prospects à relancer cette semaine', icon: 'users', category: 'sales', priority: 2 },
    { id: 'stats', label: 'Statistiques CRM', shortLabel: 'Stats', command: 'Affiche les KPIs CRM du mois', icon: 'chart', category: 'management', priority: 3 },
  ],
  
  // Emails
  'emails': [
    { id: 'resume', label: 'Résumer ce thread', shortLabel: 'Résumé', command: 'Résume cette conversation email', icon: 'summary', category: 'productivity', priority: 1 },
    { id: 'translate', label: 'Traduire', shortLabel: 'Traduire', command: 'Traduis ce thread en français', icon: 'translate', category: 'productivity', priority: 2 },
    { id: 'archive', label: 'Archiver les lus', shortLabel: 'Archiver', command: 'Archive tous les emails lus de plus de 7 jours', icon: 'archive', category: 'productivity', priority: 3 },
    { id: 'respond', label: 'Suggérer réponse', shortLabel: 'Réponse', command: 'Suggère une réponse à ce thread', icon: 'send', category: 'productivity', priority: 4 },
  ],
  
  // Trésorerie
  'tresorerie': [
    { id: 'sync', label: 'Sync Qonto', shortLabel: 'Sync', command: 'Synchronise les transactions Qonto des 30 derniers jours', icon: 'sync', category: 'management', priority: 1 },
    { id: 'forecast', label: 'Prévisions', shortLabel: 'Prévisions', command: 'Génère les prévisions de trésorerie sur 3 mois', icon: 'trend', category: 'management', priority: 2 },
    { id: 'relances', label: 'Relances factures', shortLabel: 'Relances', command: 'Liste les factures impayées à relancer', icon: 'money', category: 'management', priority: 3 },
  ],
  
  // RH / People
  'people': [
    { id: 'team', label: 'Résumé équipe', shortLabel: 'Équipe', command: 'Résume la situation RH de l\'équipe', icon: 'users', category: 'management', priority: 1 },
    { id: 'absences', label: 'Absences à venir', shortLabel: 'Absences', command: 'Liste les absences prévues ce mois', icon: 'calendar', category: 'management', priority: 2 },
    { id: 'payroll', label: 'KPIs masse salariale', shortLabel: 'Salaires', command: 'Affiche les KPIs de masse salariale', icon: 'money', category: 'management', priority: 3 },
  ],
  
  // Support
  'support': [
    { id: 'tickets', label: 'Tickets ouverts', shortLabel: 'Tickets', command: 'Liste les tickets support ouverts par priorité', icon: 'ticket', category: 'management', priority: 1 },
    { id: 'sla', label: 'KPIs Support', shortLabel: 'KPIs', command: 'Affiche les KPIs de support (SLA, MTTR)', icon: 'chart', category: 'management', priority: 2 },
    { id: 'assign', label: 'Répartir tickets', shortLabel: 'Répartir', command: 'Suggère une répartition optimale des tickets', icon: 'users', category: 'management', priority: 3 },
  ],
  
  // R&D
  'rd': [
    { id: 'sprint', label: 'État sprint actuel', shortLabel: 'Sprint', command: 'Résume l\'état du sprint actuel avec burndown', icon: 'chart', category: 'productivity', priority: 1 },
    { id: 'velocity', label: 'Vélocité équipe', shortLabel: 'Vélocité', command: 'Affiche la vélocité moyenne sur les 5 derniers sprints', icon: 'trend', category: 'management', priority: 2 },
    { id: 'backlog', label: 'Backlog à prioriser', shortLabel: 'Backlog', command: 'Liste les user stories du backlog à prioriser', icon: 'task', category: 'productivity', priority: 3 },
  ],
  
  // Calendrier
  'calendrier': [
    { id: 'today', label: 'Événements du jour', shortLabel: 'Aujourd\'hui', command: 'Liste mes événements d\'aujourd\'hui', icon: 'calendar', category: 'routine', priority: 1 },
    { id: 'week', label: 'Planning semaine', shortLabel: 'Semaine', command: 'Affiche mon planning de la semaine', icon: 'calendar', category: 'routine', priority: 2 },
    { id: 'conflicts', label: 'Détecter conflits', shortLabel: 'Conflits', command: 'Vérifie les conflits dans mon calendrier', icon: 'clock', category: 'productivity', priority: 3 },
  ],
};

// Actions par défaut (fallback)
const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'briefing', label: 'Briefing rapide', shortLabel: 'Briefing', command: 'Génère un briefing rapide de ma situation', icon: 'summary', category: 'routine', priority: 1 },
  { id: 'tasks', label: 'Mes tâches', shortLabel: 'Tâches', command: 'Liste mes tâches en cours par priorité', icon: 'task', category: 'productivity', priority: 2 },
  { id: 'emails', label: 'Emails non lus', shortLabel: 'Emails', command: 'Résume mes emails non lus', icon: 'email', category: 'routine', priority: 3 },
];

export function JarvisQuickActionsContextual({ 
  onExecute, 
  isDisabled = false,
  compact = false,
  maxActions = 4
}: JarvisQuickActionsContextualProps) {
  const location = useLocation();
  const pageContext = useJarvisPageContext();
  
  // Déterminer le module actuel
  const currentModule = useMemo(() => {
    const path = location.pathname;
    
    // Vérifier si on est sur une page de détail d'établissement
    if (/^\/etablissements\/[a-f0-9-]+/.test(path)) return 'etablissement';
    if (path.startsWith('/etablissements')) return 'etablissements';
    if (path.startsWith('/emails')) return 'emails';
    if (path.startsWith('/tresorerie')) return 'tresorerie';
    if (path.startsWith('/people')) return 'people';
    if (path.startsWith('/support')) return 'support';
    if (path.startsWith('/rd')) return 'rd';
    if (path.startsWith('/calendrier')) return 'calendrier';
    if (path === '/') return 'dashboard';
    
    return 'default';
  }, [location.pathname]);
  
  // Obtenir les actions pour le module actuel
  const contextualActions = useMemo(() => {
    const moduleActions = MODULE_ACTIONS[currentModule] || DEFAULT_ACTIONS;
    
    // Trier par priorité et limiter
    return moduleActions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxActions);
  }, [currentModule, maxActions]);
  
  // Enrichir la commande avec le contexte de page si disponible
  const enrichCommand = (command: string): string => {
    if (!pageContext?.primaryEntity) return command;
    
    // Si on a un ID d'entité spécifique, l'ajouter au contexte
    if (pageContext.primaryEntity.id && currentModule === 'etablissement') {
      return `${command} (ID établissement: ${pageContext.primaryEntity.id})`;
    }
    
    return command;
  };
  
  return (
    <div className={cn(
      "flex items-center gap-1 flex-wrap",
      compact ? "gap-0.5" : "gap-1.5"
    )}>
      <AnimatePresence mode="popLayout">
        {contextualActions.map((action, index) => {
          const Icon = ICON_MAP[action.icon] || Zap;
          
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    delay: index * 0.05,
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                  layout
                >
                  <Button
                    variant="ghost"
                    size={compact ? "sm" : "default"}
                    className={cn(
                      "rounded-lg transition-all group",
                      "hover:bg-primary/10 hover:text-primary",
                      "focus:ring-2 focus:ring-primary/20",
                      compact ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm"
                    )}
                    onClick={() => onExecute(enrichCommand(action.command))}
                    disabled={isDisabled}
                  >
                    <Icon className={cn(
                      "shrink-0",
                      compact ? "h-3.5 w-3.5" : "h-4 w-4",
                      compact ? "" : "mr-1.5"
                    )} />
                    {!compact && (
                      <span className="truncate max-w-[100px]">
                        {action.shortLabel}
                      </span>
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[250px]">
                <div className="space-y-1">
                  <p className="font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {action.command.length > 60 
                      ? action.command.substring(0, 60) + '...' 
                      : action.command}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {action.category}
                  </Badge>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </AnimatePresence>
      
      {/* Indicateur du module actuel (optionnel en mode compact) */}
      {!compact && currentModule !== 'default' && (
        <Badge 
          variant="secondary" 
          className="ml-2 text-xs opacity-60"
        >
          {currentModule}
        </Badge>
      )}
    </div>
  );
}
