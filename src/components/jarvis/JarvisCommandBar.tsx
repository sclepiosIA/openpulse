/**
 * JarvisCommandBar - Barre de commandes rapides (v14.0)
 * 
 * Permet d'accéder rapidement aux commandes Jarvis via un raccourci clavier
 * Style Spotlight/Command Palette
 */

import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  Mail,
  BarChart2,
  FileText,
  Users,
  ArrowRight,
  Command,
  CheckCircle,
  MessageCircle,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  action: string;
  category: 'quick' | 'email' | 'crm' | 'analytics';
}

const COMMANDS: Command[] = [
  { id: 'briefing', label: 'Briefing du jour', description: 'Résumé de votre journée', icon: Sparkles, action: 'Génère mon briefing du jour', category: 'quick' },
  { id: 'tasks', label: 'Tâches prioritaires', description: 'Ce qui doit être fait', icon: CheckCircle, action: 'Mes tâches prioritaires', category: 'quick' },
  { id: 'emails', label: 'Emails urgents', description: 'Messages importants', icon: Mail, action: 'Quels emails sont urgents ?', category: 'email' },
  { id: 'compose', label: 'Composer un email', description: 'Rédiger avec l\'aide de l\'IA', icon: MessageCircle, action: 'Aide-moi à rédiger un email', category: 'email' },
  { id: 'pipeline', label: 'Pipeline commercial', description: 'État des opportunités', icon: BarChart2, action: 'État du pipeline commercial', category: 'crm' },
  { id: 'prospects', label: 'Prospects à relancer', description: 'Opportunités froides', icon: Users, action: 'Quels prospects relancer ?', category: 'crm' },
  { id: 'report', label: 'Rapport hebdo', description: 'Synthèse de la semaine', icon: FileText, action: 'Génère un rapport hebdomadaire', category: 'analytics' },
  { id: 'analyze', label: 'Analyser les tendances', description: 'Insights business', icon: Brain, action: 'Analyse les tendances récentes', category: 'analytics' },
];

interface JarvisCommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (action: string) => void;
}

export const JarvisCommandBar = memo(function JarvisCommandBar({
  isOpen,
  onClose,
  onCommand,
}: JarvisCommandBarProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return COMMANDS;
    const query = search.toLowerCase();
    return COMMANDS.filter(
      cmd => 
        cmd.label.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
    );
  }, [search]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleSelect(filteredCommands[selectedIndex]);
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
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  const handleSelect = useCallback((command: Command) => {
    vibrateSelection();
    onCommand(command.action);
    onClose();
  }, [onCommand, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Command bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              "fixed top-[20%] left-1/2 -translate-x-1/2 z-50",
              "w-full max-w-lg mx-4",
              "bg-background/95 backdrop-blur-xl",
              "rounded-2xl shadow-2xl",
              "border border-border/50",
              "overflow-hidden"
            )}
          >
            {/* Search input */}
            <div className="relative flex items-center border-b border-border/50 px-4">
              <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Que voulez-vous faire ?"
                autoFocus
                className={cn(
                  "flex-1 px-3 py-4",
                  "bg-transparent text-foreground",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none",
                  "text-base"
                )}
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">esc</kbd>
              </div>
            </div>

            {/* Commands list */}
            <div className="max-h-80 overflow-y-auto py-2">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Aucune commande trouvée</p>
                </div>
              ) : (
                filteredCommands.map((command, index) => {
                  const Icon = command.icon;
                  const isSelected = index === selectedIndex;
                  
                  return (
                    <motion.button
                      key={command.id}
                      onClick={() => handleSelect(command)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3",
                        "text-left transition-colors",
                        isSelected 
                          ? "bg-primary/10 text-foreground" 
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                      initial={false}
                      animate={{
                        backgroundColor: isSelected ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                      }}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center",
                        isSelected 
                          ? "bg-primary/20 text-primary" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {command.label}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {command.description}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                          >
                            <ArrowRight className="w-4 h-4 text-primary" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  <span>Jarvis Command Bar</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Naviguer:</span>
                  <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd>
                  <span>Sélectionner:</span>
                  <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↵</kbd>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

/**
 * Hook pour gérer le raccourci clavier de la command bar
 */
export function useJarvisCommandBar(onCommand: (action: string) => void) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    CommandBar: () => (
      <JarvisCommandBar
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onCommand={onCommand}
      />
    ),
  };
}
