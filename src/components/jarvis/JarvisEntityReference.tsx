/**
 * JarvisEntityReference - Lien cliquable vers toute entité (v16)
 * 
 * Supporte: email, task, etablissement, ticket, event, contact
 * Style "pill" avec icône et couleur distincte par type
 */

import React from 'react';
import {
  Mail,
  CheckSquare,
  Building2,
  LifeBuoy,
  CalendarDays,
  UserCircle,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AIEmailHoverCard } from '@/components/search/AIEmailHoverCard';

export type EntityType = 'email' | 'task' | 'etablissement' | 'ticket' | 'event' | 'contact';

const ENTITY_CONFIG: Record<EntityType, {
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  route: (id: string) => string;
}> = {
  email: {
    icon: Mail,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10 hover:bg-primary/15',
    borderClass: 'border-primary/20 hover:border-primary/30',
    route: (id) => `/emails?thread=${id}`,
  },
  task: {
    icon: CheckSquare,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    borderClass: 'border-emerald-500/20 hover:border-emerald-500/30',
    route: (id) => `/todos?task=${id}`,
  },
  etablissement: {
    icon: Building2,
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-500/10 hover:bg-violet-500/15',
    borderClass: 'border-violet-500/20 hover:border-violet-500/30',
    route: (id) => `/etablissements/${id}`,
  },
  ticket: {
    icon: LifeBuoy,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10 hover:bg-amber-500/15',
    borderClass: 'border-amber-500/20 hover:border-amber-500/30',
    route: (id) => `/support?ticket=${id}`,
  },
  event: {
    icon: CalendarDays,
    colorClass: 'text-pink-600 dark:text-pink-400',
    bgClass: 'bg-pink-500/10 hover:bg-pink-500/15',
    borderClass: 'border-pink-500/20 hover:border-pink-500/30',
    route: (id) => `/calendrier?event=${id}`,
  },
  contact: {
    icon: UserCircle,
    colorClass: 'text-cyan-600 dark:text-cyan-400',
    bgClass: 'bg-cyan-500/10 hover:bg-cyan-500/15',
    borderClass: 'border-cyan-500/20 hover:border-cyan-500/30',
    route: (id) => `/etablissements?contact=${id}`,
  },
};

interface JarvisEntityReferenceProps {
  type: EntityType;
  entityId: string;
  title: string;
  className?: string;
}

export function JarvisEntityReference({ type, entityId, title, className }: JarvisEntityReferenceProps) {
  const navigate = useNavigate();
  const config = ENTITY_CONFIG[type];
  const Icon = config.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('jarvis:close'));
    navigate(config.route(entityId));
  };

  const pill = (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        config.bgClass,
        "border", config.borderClass,
        config.colorClass,
        "transition-colors duration-200 cursor-pointer",
        "text-sm font-medium",
        "shadow-sm hover:shadow-md",
        className
      )}
    >
      <div className={cn("flex items-center justify-center w-5 h-5 rounded-full", config.bgClass)}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="truncate max-w-[250px]">{title}</span>
      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
    </motion.button>
  );

  // Wrap email references with HoverCard for rich preview
  if (type === 'email') {
    return (
      <AIEmailHoverCard threadId={entityId}>
        {pill}
      </AIEmailHoverCard>
    );
  }

  return pill;
}
