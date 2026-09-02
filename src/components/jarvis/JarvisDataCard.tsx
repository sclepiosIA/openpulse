/**
 * JarvisDataCard - Cartes de données contextuelles v12.5
 * 
 * Email, Task, Établissement, KPI previews avec actions
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  CheckCircle2,
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Calendar,
  ExternalLink,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';

// Types
interface BaseCardProps {
  className?: string;
  onClick?: () => void;
}

interface EmailCardProps extends BaseCardProps {
  type: 'email';
  from: string;
  subject: string;
  preview?: string;
  timestamp: string;
  isUrgent?: boolean;
  category?: string;
  onOpen?: () => void;
  onReply?: () => void;
}

interface TaskCardProps extends BaseCardProps {
  type: 'task';
  title: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  status: 'todo' | 'in_progress' | 'done';
  etablissement?: string;
  onComplete?: () => void;
  onView?: () => void;
}

interface EtablissementCardProps extends BaseCardProps {
  type: 'etablissement';
  name: string;
  phase: string;
  healthScore?: number;
  ca?: number;
  csm?: string;
  lastActivity?: string;
  onView?: () => void;
}

interface KPICardProps extends BaseCardProps {
  type: 'kpi';
  label: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
  format?: 'number' | 'currency' | 'percent';
  sparkline?: number[];
}

export type JarvisDataCardProps = 
  | EmailCardProps 
  | TaskCardProps 
  | EtablissementCardProps 
  | KPICardProps;

export const JarvisDataCard = memo(function JarvisDataCard(props: JarvisDataCardProps) {
  switch (props.type) {
    case 'email':
      return <EmailCard {...props} />;
    case 'task':
      return <TaskCard {...props} />;
    case 'etablissement':
      return <EtablissementCard {...props} />;
    case 'kpi':
      return <KPICard {...props} />;
    default:
      return null;
  }
});

// Email Card
const EmailCard = memo(function EmailCard({
  from,
  subject,
  preview,
  timestamp,
  isUrgent,
  category,
  onOpen,
  onReply,
  className,
  onClick,
}: EmailCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl bg-card/90 backdrop-blur-sm border border-border/50",
        "hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer",
        isUrgent && "border-l-4 border-l-red-500",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2.5 rounded-xl shrink-0",
          isUrgent ? "bg-red-500/10" : "bg-sky-500/10"
        )}>
          <Mail className={cn(
            "w-5 h-5",
            isUrgent ? "text-red-500" : "text-sky-500"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm truncate">{from}</span>
            {isUrgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Urgent
              </Badge>
            )}
            {category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {category}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate">{subject}</p>
          {preview && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{preview}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timestamp}
            </span>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          {onOpen && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="h-8 px-2">
              Ouvrir
            </Button>
          )}
          {onReply && (
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onReply(); }} className="h-8 px-2">
              Répondre
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// Task Card
const TaskCard = memo(function TaskCard({
  title,
  dueDate,
  priority,
  assignee,
  status,
  etablissement,
  onComplete,
  onView,
  className,
  onClick,
}: TaskCardProps) {
  const priorityConfig = {
    low: { color: 'text-muted-foreground', bg: 'bg-slate-500/10', label: 'Basse' },
    medium: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Moyenne' },
    high: { color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Haute' },
    urgent: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Urgente' },
  };

  const config = priorityConfig[priority];
  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'done';

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl bg-card/90 backdrop-blur-sm border border-border/50",
        "hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer",
        isOverdue && "border-l-4 border-l-red-500",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2.5 rounded-xl shrink-0", config.bg)}>
          <CheckCircle2 className={cn("w-5 h-5", config.color)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm truncate flex-1">{title}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", config.color)}>
              {config.label}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
            {etablissement && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {etablissement}
              </span>
            )}
            {assignee && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {assignee}
              </span>
            )}
            {dueDate && (
              <span className={cn(
                "flex items-center gap-1",
                isOverdue && "text-red-500 font-medium"
              )}>
                <Calendar className="w-3 h-3" />
                {dueDate}
                {isOverdue && <AlertCircle className="w-3 h-3" />}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          {status !== 'done' && onComplete && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onComplete(); }} className="h-8 px-2">
              Terminer
            </Button>
          )}
          {onView && (
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onView(); }} className="h-8 px-2">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// Établissement Card
const EtablissementCard = memo(function EtablissementCard({
  name,
  phase,
  healthScore,
  ca,
  csm,
  lastActivity,
  onView,
  className,
  onClick,
}: EtablissementCardProps) {
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-500 bg-amber-500/10';
    return 'text-red-500 bg-red-500/10';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl bg-card/90 backdrop-blur-sm border border-border/50",
        "hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/10 shrink-0">
          <Building2 className="w-5 h-5 text-violet-500" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm truncate">{name}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
              {phase}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-xs mt-2">
            {healthScore !== undefined && (
              <span className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full font-medium",
                getHealthColor(healthScore)
              )}>
                Santé: {healthScore}%
              </span>
            )}
            {ca !== undefined && (
              <span className="text-muted-foreground">
                CA: {formatNumber(ca)}€
              </span>
            )}
            {csm && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <User className="w-3 h-3" />
                {csm}
              </span>
            )}
          </div>
          
          {lastActivity && (
            <p className="text-xs text-muted-foreground mt-2">
              Dernière activité: {lastActivity}
            </p>
          )}
        </div>

        {onView && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onView(); }} className="h-8 w-8 p-0 shrink-0">
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
});

// KPI Card
const KPICard = memo(function KPICard({
  label,
  value,
  trend,
  trendLabel,
  format = 'number',
  sparkline,
  className,
  onClick,
}: KPICardProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    switch (format) {
      case 'currency':
        return `${formatNumber(val)}€`;
      case 'percent':
        return `${val}%`;
      default:
        return formatNumber(val);
    }
  };

  const isPositiveTrend = trend && trend > 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl bg-card/90 backdrop-blur-sm border border-border/50",
        "hover:shadow-lg transition-all cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {trend !== undefined && (
          <span className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            isPositiveTrend ? "text-emerald-500" : "text-red-500"
          )}>
            {isPositiveTrend ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      
      <p className="text-2xl font-bold text-foreground">
        {formatValue(value)}
      </p>
      
      {trendLabel && (
        <p className="text-xs text-muted-foreground mt-1">
          {trendLabel}
        </p>
      )}

      {/* Mini Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div className="h-8 mt-3 flex items-end gap-0.5">
          {sparkline.map((val, i) => (
            <div
              key={`jarvis-data-sparkline-${i}`}
              className="flex-1 bg-primary/20 rounded-t-sm"
              style={{ height: `${(val / Math.max(...sparkline)) * 100}%` }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
});
