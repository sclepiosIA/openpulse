/**
 * JarvisCommandPalette - Palette de commandes rapides
 * Déclenché avec "/" dans l'input
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  CalendarPlus,
  CheckSquare,
  Search,
  FileText,
  Users,
  Building2,
  Wallet,
  BarChart3,
  HelpCircle,
  Sparkles,
  Clock,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  prompt: string;
  category: 'emails' | 'tasks' | 'crm' | 'analytics' | 'help';
}

const COMMANDS: Command[] = [
  // Emails
  { id: 'email-summary', label: 'Résumer emails', description: 'Voir les emails non lus importants', icon: Mail, prompt: 'Résume mes emails non lus les plus importants', category: 'emails' },
  { id: 'email-draft', label: 'Rédiger email', description: 'Créer un brouillon d\'email', icon: Send, prompt: 'Aide-moi à rédiger un email pour ', category: 'emails' },
  
  // Tasks
  { id: 'task-today', label: 'Tâches du jour', description: 'Voir mes priorités', icon: CheckSquare, prompt: 'Quelles sont mes tâches prioritaires pour aujourd\'hui ?', category: 'tasks' },
  { id: 'task-create', label: 'Créer tâche', description: 'Ajouter une nouvelle tâche', icon: CalendarPlus, prompt: 'Crée une tâche pour ', category: 'tasks' },
  { id: 'task-overdue', label: 'Tâches en retard', description: 'Voir les tâches dépassées', icon: Clock, prompt: 'Montre-moi les tâches en retard', category: 'tasks' },
  
  // CRM
  { id: 'crm-pipeline', label: 'État pipeline', description: 'Vue d\'ensemble des opportunités', icon: Building2, prompt: 'Fais-moi un résumé de l\'état du pipeline commercial', category: 'crm' },
  { id: 'crm-contacts', label: 'Rechercher contact', description: 'Trouver un contact', icon: Users, prompt: 'Recherche le contact ', category: 'crm' },
  { id: 'crm-etablissement', label: 'Info établissement', description: 'Détails d\'un établissement', icon: Building2, prompt: 'Donne-moi les informations sur l\'établissement ', category: 'crm' },
  
  // Analytics
  { id: 'analytics-kpi', label: 'KPIs du jour', description: 'Métriques principales', icon: BarChart3, prompt: 'Quels sont les KPIs clés aujourd\'hui ?', category: 'analytics' },
  { id: 'analytics-report', label: 'Rapport hebdo', description: 'Rapport de la semaine', icon: FileText, prompt: 'Génère un rapport d\'activité de cette semaine', category: 'analytics' },
  { id: 'analytics-treasury', label: 'État trésorerie', description: 'Solde et prévisions', icon: Wallet, prompt: 'Quel est l\'état actuel de la trésorerie ?', category: 'analytics' },
  
  // Help
  { id: 'help-capabilities', label: 'Que sais-tu faire ?', description: 'Voir mes capacités', icon: HelpCircle, prompt: 'Quelles sont tes capacités ?', category: 'help' },
  { id: 'help-search', label: 'Recherche KB', description: 'Chercher dans la base', icon: Search, prompt: 'Recherche dans la base de connaissances : ', category: 'help' },
];

const CATEGORY_LABELS = {
  emails: 'Emails',
  tasks: 'Tâches',
  crm: 'CRM',
  analytics: 'Analytics',
  help: 'Aide',
};

interface JarvisCommandPaletteProps {
  isOpen: boolean;
  searchQuery: string;
  onSelect: (prompt: string) => void;
  onClose: () => void;
  className?: string;
}

export function JarvisCommandPalette({
  isOpen,
  searchQuery,
  onSelect,
  onClose,
  className,
}: JarvisCommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on search query (remove "/" prefix)
  const filteredCommands = useMemo(() => {
    const query = searchQuery.replace(/^\//, '').toLowerCase();
    if (!query) return COMMANDS;
    
    return COMMANDS.filter(
      cmd => 
        cmd.label.toLowerCase().includes(query) || 
        cmd.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => filteredCommands, [filteredCommands]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % flatList.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + flatList.length) % flatList.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[selectedIndex]) {
            onSelect(flatList[selectedIndex].prompt);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatList, selectedIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'absolute bottom-full left-0 right-0 mb-2 max-h-80 overflow-auto',
          'bg-card/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl shadow-primary/10',
          'z-50',
          className
        )}
      >
        {/* Header */}
        <div className="sticky top-0 px-3 py-2 bg-card/90 backdrop-blur-sm border-b border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Commandes rapides</span>
            <span className="ml-auto">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd>
              {' '}naviguer • {' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↵</kbd>
              {' '}sélectionner
            </span>
          </div>
        </div>

        {/* Commands list */}
        <div className="p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune commande trouvée
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </div>
                {commands.map((cmd) => {
                  const globalIndex = flatList.findIndex(c => c.id === cmd.id);
                  const isSelected = globalIndex === selectedIndex;
                  const Icon = cmd.icon;
                  
                  return (
                    <button
                      key={cmd.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                        isSelected 
                          ? 'bg-primary/10 text-foreground' 
                          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => onSelect(cmd.prompt)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        isSelected ? 'bg-primary/20' : 'bg-muted/50'
                      )}>
                        <Icon className={cn(
                          'h-4 w-4',
                          isSelected ? 'text-primary' : ''
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cmd.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
