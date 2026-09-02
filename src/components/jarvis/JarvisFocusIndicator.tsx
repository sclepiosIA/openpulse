/**
 * JarvisFocusIndicator - Indicateur de contexte/focus actuel de Jarvis
 */

import {
  Building2,
  Mail,
  CheckSquare,
  HeadphonesIcon,
  Calendar,
  Wallet,
  FlaskConical,
  GraduationCap,
  Globe,
  X,
  Eye,
  Pin,
  PinOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useJarvisFocus, type JarvisFocusMode } from '@/hooks/jarvis/useJarvisFocus';

interface JarvisFocusIndicatorProps {
  className?: string;
  compact?: boolean;
}

const MODE_CONFIG: Record<JarvisFocusMode, { icon: React.ElementType; label: string; color: string }> = {
  general: { icon: Globe, label: 'Général', color: 'text-muted-foreground' },
  emails: { icon: Mail, label: 'Emails', color: 'text-blue-500' },
  tasks: { icon: CheckSquare, label: 'Tâches', color: 'text-green-500' },
  support: { icon: HeadphonesIcon, label: 'Support', color: 'text-orange-500' },
  crm: { icon: Building2, label: 'CRM', color: 'text-purple-500' },
  calendar: { icon: Calendar, label: 'Calendrier', color: 'text-pink-500' },
  tresorerie: { icon: Wallet, label: 'Trésorerie', color: 'text-emerald-500' },
  rd: { icon: FlaskConical, label: 'R&D', color: 'text-cyan-500' },
  formation: { icon: GraduationCap, label: 'Formation', color: 'text-amber-500' },
};

export function JarvisFocusIndicator({ className, compact = false }: JarvisFocusIndicatorProps) {
  const { 
    focusContext, 
    recentActivities, 
    clearFocus, 
    togglePin,
    hasFocus,
    currentMode,
    isPinned 
  } = useJarvisFocus();

  const config = MODE_CONFIG[currentMode];
  const Icon = config.icon;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1.5', className)}>
            <Icon className={cn('h-4 w-4', config.color)} />
            {isPinned && <Pin className="h-3 w-3 text-amber-500" />}
            {hasFocus && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-2 w-2 rounded-full bg-primary"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label} {isPinned && '(épinglé)'}</p>
          {focusContext.etablissement_name && (
            <p className="text-xs text-muted-foreground">
              {focusContext.etablissement_name}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/30 p-3.5 shadow-sm', className)}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-2 rounded-xl bg-gradient-to-br from-background to-muted/50 ring-1 ring-border/50', config.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Mode {config.label}</p>
            <p className="text-[11px] text-muted-foreground">
              Contexte Jarvis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasFocus && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn('h-7 w-7', isPinned && 'text-amber-500')}
                    onClick={togglePin} aria-label="Détacher">
                    {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPinned ? 'Désépingler le focus' : 'Épingler le focus (persiste après navigation)'}
                </TooltipContent>
              </Tooltip>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={clearFocus} aria-label="Fermer">
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Établissement focus */}
      {focusContext.etablissement_name && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded-md bg-muted/50">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{focusContext.etablissement_name}</span>
        </div>
      )}

      {/* Activités récentes */}
      {recentActivities.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Eye className="h-3 w-3" />
            Récemment consulté
          </p>
          <div className="flex flex-wrap gap-1">
            {recentActivities.slice(0, 3).map((activity, index) => (
              <Badge 
                key={`${activity.entity_id}-${index}`} 
                variant="secondary" 
                className="text-[10px]"
              >
                {activity.entity_type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Message si pas de focus */}
      {!hasFocus && recentActivities.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Jarvis s'adapte automatiquement à votre contexte de travail
        </p>
      )}
    </div>
  );
}
