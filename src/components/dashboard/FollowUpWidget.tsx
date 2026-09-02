import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneForwarded, ExternalLink, Mail, CalendarCheck, MessageSquare, HeartPulse, Building2 } from "lucide-react";
import { useDashboardCoreData } from "@/hooks/dashboard/useDashboardCoreData";
import { cn } from "@/lib/utils";

type UrgencyLevel = 'critical' | 'urgent' | 'plan';

interface FollowUpItem {
  id: string;
  nom: string;
  statut: string;
  daysSinceActivity: number;
  urgency: UrgencyLevel;
  suggestedAction: string;
  actionIcon: typeof Mail;
}

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; className: string; dotClass: string }> = {
  critical: {
    label: 'Critique',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    dotClass: 'bg-destructive',
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    dotClass: 'bg-orange-500',
  },
  plan: {
    label: 'À planifier',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    dotClass: 'bg-yellow-500',
  },
};

const PROSPECT_STATUSES = ['Prospect', 'Contacté', 'Attente RDV', 'RDV pris', 'Attente post RDV', 'Dans les RDV', 'Etude émise', 'Dans les RDV post EME'];
const NEGOTIATION_STATUSES = ['Négociation', 'Contractualisation'];
const RDV_STATUSES = ['RDV pris', 'Attente post RDV', 'Dans les RDV', 'Dans les RDV post EME'];
const PRODUCTION_STATUS = 'Production';

function getSuggestedAction(statut: string): { text: string; icon: typeof Mail } {
  if (['Prospect', 'Contacté', 'Attente RDV'].includes(statut)) {
    return { text: 'Envoyer email de relance', icon: Mail };
  }
  if (RDV_STATUSES.includes(statut)) {
    return { text: 'Confirmer le prochain RDV', icon: CalendarCheck };
  }
  if (NEGOTIATION_STATUSES.includes(statut)) {
    return { text: 'Relancer sur la proposition', icon: MessageSquare };
  }
  if (statut === PRODUCTION_STATUS) {
    return { text: 'Point de suivi trimestriel', icon: HeartPulse };
  }
  return { text: 'Prendre contact', icon: Mail };
}

function computeUrgency(daysSince: number, statut: string): UrgencyLevel | null {
  if (daysSince > 14 && NEGOTIATION_STATUSES.includes(statut)) return 'critical';
  if (daysSince > 7 && PROSPECT_STATUSES.includes(statut)) return 'urgent';
  if (daysSince > 5 && statut === PRODUCTION_STATUS) return 'plan';
  // Additional: critical for prospects > 14 days too
  if (daysSince > 14 && PROSPECT_STATUSES.includes(statut)) return 'critical';
  return null;
}

const URGENCY_ORDER: Record<UrgencyLevel, number> = { critical: 0, urgent: 1, plan: 2 };
const MAX_ITEMS = 8;

export function FollowUpWidget() {
  const navigate = useNavigate();
  const { etablissements, lastEmailByEtablissement } = useDashboardCoreData();

  const followUpItems = useMemo<FollowUpItem[]>(() => {
    if (!etablissements || etablissements.length === 0) return [];

    const now = Date.now();
    const items: FollowUpItem[] = [];

    for (const etab of etablissements) {
      if (!etab.updated_at && !etab.created_at) continue;

      // Gather all activity dates to find the most recent one
      const dates = [
        etab.updated_at,
        etab.created_at,
        (etab as any).last_email_received_at,
        (etab as any).last_email_sent_at,
        lastEmailByEtablissement?.get(etab.id),
      ].filter(Boolean).map((d: string) => new Date(d).getTime());

      const lastActivity = Math.max(...dates);
      const daysSince = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
      const urgency = computeUrgency(daysSince, etab.statut);

      if (!urgency) continue;

      const action = getSuggestedAction(etab.statut);
      items.push({
        id: etab.id,
        nom: etab.nom,
        statut: etab.statut,
        daysSinceActivity: daysSince,
        urgency,
        suggestedAction: action.text,
        actionIcon: action.icon,
      });
    }

    items.sort((a, b) => {
      const orderDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      if (orderDiff !== 0) return orderDiff;
      return b.daysSinceActivity - a.daysSinceActivity;
    });

    return items;
  }, [etablissements, lastEmailByEtablissement]);

  const displayItems = followUpItems.slice(0, MAX_ITEMS);
  const hasMore = followUpItems.length > MAX_ITEMS;

  const countByUrgency = useMemo(() => ({
    critical: followUpItems.filter(i => i.urgency === 'critical').length,
    urgent: followUpItems.filter(i => i.urgency === 'urgent').length,
    plan: followUpItems.filter(i => i.urgency === 'plan').length,
  }), [followUpItems]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-semibold">
            <PhoneForwarded className="h-5 w-5 text-primary" />
            Relances à faire
          </span>
          {followUpItems.length > 0 && (
            <Badge variant="secondary" className="text-xs font-medium">
              {followUpItems.length}
            </Badge>
          )}
        </CardTitle>
        {/* Mini summary badges */}
        {followUpItems.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {countByUrgency.critical > 0 && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", URGENCY_CONFIG.critical.className)}>
                {countByUrgency.critical} critique{countByUrgency.critical > 1 ? 's' : ''}
              </Badge>
            )}
            {countByUrgency.urgent > 0 && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", URGENCY_CONFIG.urgent.className)}>
                {countByUrgency.urgent} urgent{countByUrgency.urgent > 1 ? 's' : ''}
              </Badge>
            )}
            {countByUrgency.plan > 0 && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", URGENCY_CONFIG.plan.className)}>
                {countByUrgency.plan} à planifier
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {followUpItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune relance nécessaire</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tous vos comptes sont à jour ✓</p>
          </div>
        ) : (
          <ScrollArea className="h-[340px] sm:h-[380px]">
            <div className="space-y-1.5">
              {displayItems.map((item) => {
                const cfg = URGENCY_CONFIG[item.urgency];
                const ActionIcon = item.actionIcon;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/etablissements/${item.id}`)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-all",
                      "hover:bg-accent/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "group"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Urgency dot */}
                      <div className={cn("mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background", cfg.dotClass, `ring-${item.urgency === 'critical' ? 'destructive' : item.urgency === 'urgent' ? 'orange-500' : 'yellow-500'}/30`)} />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{item.nom}</span>
                          <Badge variant="outline" className={cn("text-[10px] shrink-0 px-1.5 py-0", cfg.className)}>
                            {cfg.label}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{item.statut}</span>
                          <span className="shrink-0 font-medium tabular-nums">
                            {item.daysSinceActivity}j sans activité
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-primary/80">
                          <ActionIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.suggestedAction}</span>
                          <ExternalLink className="h-3 w-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/etablissements')}
              >
                Voir les {followUpItems.length - MAX_ITEMS} relances restantes →
              </Button>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
