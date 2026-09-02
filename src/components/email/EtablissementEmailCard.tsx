import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Mail,
  MessageSquare,
  Clock,
  ChevronRight,
  AlertCircle,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fixMalformedEncoding } from "@/lib/emailUtils";

interface EtablissementEmailCardProps {
  etablissementId: string;
  etablissementNom: string;
  etablissementVille: string;
  totalThreads: number;
  totalMessages: number;
  unreadCount: number;
  lastMessageDate: string | null;
  avgResponseTimeHours: number | null;
  activeThreads: number;
  archivedThreads: number;
  relationshipStatus?: string;
  engagementScore?: number;
  lastEmailReceivedAt?: string | null;
  lastEmailSentAt?: string | null;
  onViewDetails: (etablissementId: string) => void;
}

export function EtablissementEmailCard({
  etablissementId,
  etablissementNom,
  etablissementVille,
  totalThreads,
  totalMessages,
  unreadCount,
  lastMessageDate,
  avgResponseTimeHours,
  activeThreads,
  archivedThreads,
  relationshipStatus = 'prospect',
  engagementScore = 0,
  lastEmailReceivedAt,
  lastEmailSentAt,
  onViewDetails,
}: EtablissementEmailCardProps) {
  const formatResponseTime = (hours: number | null) => {
    if (hours === null) return "—";
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}j`;
  };

  // Déterminer le badge de statut basé sur l'activité réelle
  const getActivityStatus = () => {
    const daysSinceLastContact = lastMessageDate
      ? Math.floor((Date.now() - new Date(lastMessageDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    if (daysSinceLastContact === null) {
      return { label: "Nouveau", color: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-300" };
    } else if (daysSinceLastContact <= 7) {
      return { label: "Actif", color: "bg-green-500", textColor: "text-green-700 dark:text-green-300" };
    } else if (daysSinceLastContact <= 30) {
      return { label: "À relancer", color: "bg-yellow-500", textColor: "text-yellow-700 dark:text-yellow-300" };
    } else {
      return { label: "Inactif", color: "bg-red-500", textColor: "text-red-700 dark:text-red-300" };
    }
  };

  const activityStatus = getActivityStatus();

  // Vérifier si on attend une réponse
  const awaitingResponse = lastEmailReceivedAt && lastEmailSentAt
    ? new Date(lastEmailReceivedAt) > new Date(lastEmailSentAt)
    : false;

  const isHighEngagement = engagementScore > 70;

  return (
    <Card
      className={cn(
        "p-4 hover:shadow-md transition-all cursor-pointer group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isHighEngagement && "ring-1 ring-primary/50"
      )}
      onClick={() => onViewDetails(etablissementId)}
      role="button"
      tabIndex={0}
      aria-label={`Voir les emails de l'établissement ${etablissementNom}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onViewDetails(etablissementId)
        }
      }}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate leading-tight">
              {fixMalformedEncoding(etablissementNom)}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {fixMalformedEncoding(etablissementVille)}
            </p>
          </div>

          {/* Badges compacts - max 2 visibles */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", activityStatus.color)} />
              <span className={cn("text-xs font-medium", activityStatus.textColor)}>
                {activityStatus.label}
              </span>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs h-5">
                {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats compactes inline */}
        <div className="flex items-center gap-4 text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{totalThreads}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {totalThreads} conversation{totalThreads > 1 ? 's' : ''} ({activeThreads} active{activeThreads > 1 ? 's' : ''})
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">{totalMessages}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {totalMessages} message{totalMessages > 1 ? 's' : ''} au total
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{formatResponseTime(avgResponseTimeHours)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Temps de réponse moyen
            </TooltipContent>
          </Tooltip>

          {isHighEngagement && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-primary">
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-medium">{engagementScore}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Score d'engagement élevé
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Footer avec dernier échange et CTA */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {awaitingResponse && (
              <Badge variant="secondary" className="text-xs h-5 gap-1">
                <AlertCircle className="h-3 w-3" />
                Attente réponse
              </Badge>
            )}
            {lastMessageDate && (
              <span>
                {formatDistanceToNow(new Date(lastMessageDate), {
                  addSuffix: true,
                  locale: fr,
                })}
              </span>
            )}
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Card>
  );
}