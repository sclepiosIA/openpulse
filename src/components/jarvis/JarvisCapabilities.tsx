/**
 * JarvisCapabilities - Affichage des capacités Jarvis (v15.0)
 * 
 * Présente les fonctionnalités de Jarvis de manière interactive
 * avec catégorisation et exemples d'utilisation
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Calendar,
  BarChart2,
  Users,
  Zap,
  Brain,
  MessageCircle,
  CheckCircle2,
  Search,
  Sparkles,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrateSelection } from '@/lib/haptics';

interface Capability {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  examples: string[];
  color: string;
}

const CAPABILITY_CATEGORIES = {
  communication: {
    label: 'Communication',
    icon: MessageCircle,
    capabilities: [
      {
        id: 'emails',
        icon: Mail,
        title: 'Gestion des emails',
        description: 'Résumer, rédiger, classer et répondre aux emails',
        examples: ['Résume mes emails non lus', 'Rédige un email de relance pour...', 'Quels emails sont urgents ?'],
        color: 'from-blue-500/20 to-cyan-500/10',
      },
      {
        id: 'calendar',
        icon: Calendar,
        title: 'Calendrier',
        description: 'Gérer les événements, planifier des réunions',
        examples: ['Mon agenda du jour', 'Planifie une réunion avec...', 'Mes prochains rendez-vous'],
        color: 'from-purple-500/20 to-violet-500/10',
      },
    ],
  },
  crm: {
    label: 'CRM & Commercial',
    icon: Users,
    capabilities: [
      {
        id: 'pipeline',
        icon: BarChart2,
        title: 'Pipeline commercial',
        description: 'Analyser les opportunités et les prospects',
        examples: ['État du pipeline', 'Prospects à relancer', 'Valeur des deals en cours'],
        color: 'from-emerald-500/20 to-green-500/10',
      },
      {
        id: 'clients',
        icon: Users,
        title: 'Gestion clients',
        description: 'Suivi des établissements et contacts',
        examples: ['Infos sur [client]', 'Clients en retard de paiement', 'Historique avec [établissement]'],
        color: 'from-amber-500/20 to-orange-500/10',
      },
    ],
  },
  productivity: {
    label: 'Productivité',
    icon: Zap,
    capabilities: [
      {
        id: 'tasks',
        icon: CheckCircle2,
        title: 'Tâches',
        description: 'Créer, suivre et prioriser les tâches',
        examples: ['Mes tâches prioritaires', 'Crée une tâche pour...', 'Tâches en retard'],
        color: 'from-rose-500/20 to-pink-500/10',
      },
      {
        id: 'briefing',
        icon: Sparkles,
        title: 'Briefings',
        description: 'Synthèses quotidiennes et rapports',
        examples: ['Briefing du jour', 'Bilan de la semaine', 'Rapport mensuel'],
        color: 'from-indigo-500/20 to-blue-500/10',
      },
    ],
  },
  analytics: {
    label: 'Analytics',
    icon: Brain,
    capabilities: [
      {
        id: 'analysis',
        icon: BarChart2,
        title: 'Analyses',
        description: 'Tendances, prédictions et insights',
        examples: ['Analyse des tendances', 'Prévisions de CA', 'Anomalies détectées'],
        color: 'from-cyan-500/20 to-teal-500/10',
      },
      {
        id: 'search',
        icon: Search,
        title: 'Recherche',
        description: 'Rechercher dans toutes les données',
        examples: ['Cherche les factures de...', 'Documents liés à...', 'Historique de [terme]'],
        color: 'from-violet-500/20 to-purple-500/10',
      },
    ],
  },
};

interface JarvisCapabilitiesProps {
  onSelectExample?: (example: string) => void;
  compact?: boolean;
  className?: string;
}

export const JarvisCapabilities = memo(function JarvisCapabilities({
  onSelectExample,
  compact = false,
  className,
}: JarvisCapabilitiesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);

  const handleExampleClick = (example: string) => {
    vibrateSelection();
    onSelectExample?.(example);
  };

  if (compact) {
    // Compact view - just icons
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {Object.values(CAPABILITY_CATEGORIES).flatMap(cat => 
          cat.capabilities.map(cap => {
            const Icon = cap.icon;
            return (
              <motion.button
                key={cap.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleExampleClick(cap.examples[0])}
                className={cn(
                  "p-2 rounded-xl",
                  "bg-gradient-to-br",
                  cap.color,
                  "border border-border/30",
                  "transition-all duration-200"
                )}
                title={cap.title}
              >
                <Icon className="w-4 h-4 text-foreground" />
              </motion.button>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {Object.entries(CAPABILITY_CATEGORIES).map(([key, cat]) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === key;
          
          return (
            <motion.button
              key={key}
              onClick={() => {
                vibrateSelection();
                setSelectedCategory(isSelected ? null : key);
                setSelectedCapability(null);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full",
                "text-sm font-medium whitespace-nowrap",
                "transition-all duration-200",
                isSelected 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </motion.button>
          );
        })}
      </div>

      {/* Capabilities grid */}
      <AnimatePresence mode="wait">
        {selectedCategory && (
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {CAPABILITY_CATEGORIES[selectedCategory as keyof typeof CAPABILITY_CATEGORIES].capabilities.map((cap) => {
              const Icon = cap.icon;
              const isExpanded = selectedCapability === cap.id;
              
              return (
                <motion.div
                  key={cap.id}
                  layout
                  onClick={() => {
                    vibrateSelection();
                    setSelectedCapability(isExpanded ? null : cap.id);
                  }}
                  className={cn(
                    "p-4 rounded-2xl cursor-pointer",
                    "bg-gradient-to-br",
                    cap.color,
                    "border border-border/40",
                    "transition-all duration-200",
                    isExpanded && "ring-2 ring-primary/30"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={cn(
                      "w-10 h-10 rounded-xl",
                      "bg-background/80 shadow-sm",
                      "flex items-center justify-center"
                    )}>
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                    <ChevronRight className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-90"
                    )} />
                  </div>
                  
                  <h4 className="font-semibold text-sm text-foreground mb-1">
                    {cap.title}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {cap.description}
                  </p>

                  {/* Examples */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-border/30 space-y-2"
                      >
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Exemples
                        </p>
                        {cap.examples.map((example, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExampleClick(example);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg",
                              "bg-background/60 hover:bg-background",
                              "text-xs text-foreground",
                              "flex items-center gap-2",
                              "transition-colors duration-200"
                            )}
                          >
                            <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="truncate">{example}</span>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!selectedCategory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <Layers className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Sélectionnez une catégorie pour voir les capacités
          </p>
        </motion.div>
      )}
    </div>
  );
});
