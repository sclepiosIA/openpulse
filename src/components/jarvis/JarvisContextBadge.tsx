/**
 * JarvisContextBadge - Badge contextuel intelligent (v14.0)
 * 
 * Affiche le contexte actuel détecté par Jarvis:
 * - Module actif
 * - Établissement en focus
 * - Filtres appliqués
 */

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Users,
  Wallet,
  Mail,
  Headphones,
  Beaker,
  GraduationCap,
  Calendar,
  Home,
  Target,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { useJarvisFocus } from '@/hooks/jarvis/useJarvisFocus';

interface JarvisContextBadgeProps {
  className?: string;
}

const MODULE_CONFIG = {
  dashboard: { icon: Home, label: 'Dashboard', color: 'text-blue-500' },
  etablissements: { icon: Building2, label: 'CRM', color: 'text-emerald-500' },
  prospects: { icon: Target, label: 'Prospects', color: 'text-amber-500' },
  people: { icon: Users, label: 'Équipe', color: 'text-violet-500' },
  tresorerie: { icon: Wallet, label: 'Trésorerie', color: 'text-green-500' },
  emails: { icon: Mail, label: 'Emails', color: 'text-blue-500' },
  support: { icon: Headphones, label: 'Support', color: 'text-orange-500' },
  rd: { icon: Beaker, label: 'R&D', color: 'text-purple-500' },
  formations: { icon: GraduationCap, label: 'Formations', color: 'text-pink-500' },
  calendrier: { icon: Calendar, label: 'Calendrier', color: 'text-cyan-500' },
};

export const JarvisContextBadge = memo(function JarvisContextBadge({
  className,
}: JarvisContextBadgeProps) {
  const location = useLocation();
  const { focusContext } = useJarvisFocus();

  const contextInfo = useMemo(() => {
    const path = location.pathname;
    
    // Detect module
    let module = 'dashboard';
    for (const key of Object.keys(MODULE_CONFIG)) {
      if (path.includes(`/${key}`)) {
        module = key;
        break;
      }
    }
    
    const config = MODULE_CONFIG[module as keyof typeof MODULE_CONFIG] || MODULE_CONFIG.dashboard;
    
    // Check for entity focus
    const entityMatch = path.match(/\/etablissements\/([a-f0-9-]+)/);
    const hasEntityFocus = !!entityMatch || !!focusContext.etablissement_id;
    
    return {
      module,
      config,
      hasEntityFocus,
      entityName: focusContext.etablissement_id ? 'Établissement en focus' : null,
    };
  }, [location.pathname, focusContext]);

  const Icon = contextInfo.config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
        "bg-muted/50 border border-border/40",
        "text-xs font-medium",
        className
      )}
    >
      <Sparkles className="w-3 h-3 text-primary" />
      <span className="text-muted-foreground">Contexte:</span>
      
      <div className="flex items-center gap-1">
        <Icon className={cn("w-3.5 h-3.5", contextInfo.config.color)} />
        <span className="text-foreground">{contextInfo.config.label}</span>
      </div>
      
      <AnimatePresence>
        {contextInfo.hasEntityFocus && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-1 overflow-hidden"
          >
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-primary truncate max-w-[100px]">
              {contextInfo.entityName || 'Détail'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
