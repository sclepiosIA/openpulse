import { Card, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from
'@/components/ui/dropdown-menu';
import {
  TooltipProvider,
} from
'@/components/ui/tooltip';
import { MapPin, Calendar, MoreVertical, Users, AlertTriangle, Mail, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Etablissement } from '@/hooks/crm/useEtablissements';
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth';
import type { CsmSanteCompte, WeatherType, TrendType } from '@/types/csm';

import { EntityAvatar } from '@/components/ui/EntityAvatar';
import { WeatherIcon } from '@/components/csm/WeatherIcon';
import { calculateEtablissementValue } from '@/lib/valueCalculations';
import { formatCurrency, formatDateFr, getMonthsInProduction, getRenewalInfo } from '@/lib/productionUtils';
import { sanitizeEmailSubject } from '@/lib/emailUtils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LastEmail {
  id: string;
  subject: string;
  last_message_date: string;
  ai_generated_title: string | null;
}

const TrendIcon = ({ trend }: {trend: TrendType;}) => {
  if (trend === 'up') return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

interface EnrichedProductionCardProps {
  etablissement: Etablissement;
  health?: CustomerHealthScore;
  healthMetrics?: any;
  santeData?: CsmSanteCompte;
  satisfaction?: number | null;
  deploymentDate?: string | null;
  billingEndDate?: string | null;
  lastEmail?: LastEmail;
  isSelected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export function EnrichedProductionCard({
  etablissement,
  health,
  healthMetrics,
  santeData,
  satisfaction,
  deploymentDate,
  billingEndDate,
  lastEmail,
  isSelected = false,
  onSelectionChange
}: EnrichedProductionCardProps) {
  const navigate = useNavigate();

  const monthsInProduction = getMonthsInProduction(etablissement.date_go_live);
  const revenue = calculateEtablissementValue(etablissement);
  const adoptionRate = healthMetrics?.adoption_rate || 0;
  const supportTickets = healthMetrics?.support_tickets_open || 0;
  const renewalInfo = getRenewalInfo(healthMetrics?.contract_end_date);
  const weather = (santeData?.weather || 'not-started') as WeatherType;

  const handleCardClick = () => {
    navigate(`/etablissements/${etablissement.id}`);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(etablissement.id, checked);
  };

  return (
    <Card
      className={`hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      isSelected ? 'ring-2 ring-primary' : ''}`
      }
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir la fiche établissement ${etablissement.nom}`}
      onKeyDown={handleCardKeyDown}>

      {/* Header compact */}
      <div className="bg-gradient-to-r from-[hsl(var(--primary)/0.06)] to-[hsl(var(--marque-pastel-cyan)/0.15)] px-4 py-3 border-b border-border/40">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            {onSelectionChange &&
            <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                className="mt-1" />

              </div>
            }
            <EntityAvatar
              name={etablissement.nom}
              logoUrl={etablissement.logo_url || (etablissement as any).groupe_logo_url}
              size="sm" />

            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-primary truncate">
                {etablissement.nom}
              </h3>
              <p className="text-xs text-muted-foreground truncate">{etablissement.type}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <WeatherIcon weather={weather} size="sm" showLabel />
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options" className="h-7 w-7 p-0">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}`)}>
                    Voir les détails
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}?tab=taches`)}>
                    Voir les tâches
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}?tab=emails`)}>
                    Voir les emails
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-0 flex-1 flex flex-col">
        {/* Localisation + Durée + CA */}
        <div className="px-4 py-2.5 border-b border-border/30 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs">{etablissement.ville}, {etablissement.region}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">En production:</span>
              <p className="font-semibold text-sm">{monthsInProduction} mois</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">CA annuel:</span>
              <p className="font-semibold text-sm">
                {revenue > 0 ? formatCurrency(revenue) : <span className="text-muted-foreground font-normal">—</span>}
              </p>
            </div>
          </div>
        </div>

        {/* KPI Grid: Utilisation / UHCD / Satisfaction */}
        <div className="grid grid-cols-3 divide-x divide-border/40 border-b border-border/30">
          <div className="px-2.5 py-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Utilisation</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm font-bold">
                {santeData?.taux_utilisation != null ? `${santeData.taux_utilisation}%` : '—'}
              </span>
              <TrendIcon trend={santeData?.taux_utilisation_trend || 'stable'} />
            </div>
          </div>
          <div className="px-2.5 py-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">UHCD</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm font-bold">
                {santeData?.taux_uhcd != null ? `${santeData.taux_uhcd}%` : '—'}
              </span>
              <TrendIcon trend={santeData?.taux_uhcd_trend || 'stable'} />
            </div>
          </div>
          <div className="px-2.5 py-2 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center justify-center gap-0.5">
              <Star className="w-2.5 h-2.5" /> Satisfaction
            </p>
            <span className="text-sm font-bold">
              {satisfaction != null ? `${satisfaction}%` : '—'}
            </span>
          </div>
        </div>

        {/* Métriques: Adoption + Support */}
        {/* @ts-expect-error - TooltipProvider children type mismatch with shadcn/ui */}
        <TooltipProvider delayDuration={300}>
          

        </TooltipProvider>

        {/* Dernier échange email */}
        <div className="px-4 py-2 border-b border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <Mail className="w-3 h-3" /> Dernier échange
          </p>
          {lastEmail ?
          <div
            className="text-xs rounded bg-[hsl(var(--marque-pastel-cyan)/0.2)] px-2 py-1.5 cursor-pointer hover:bg-[hsl(var(--marque-pastel-cyan)/0.35)] transition-colors"
            onClick={(e) => {e.stopPropagation();navigate(`/emails?thread=${lastEmail.id}`);}}>

              <p className="font-medium truncate">
                {sanitizeEmailSubject(lastEmail.ai_generated_title || lastEmail.subject)}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(lastEmail.last_message_date), { addSuffix: true, locale: fr })}
              </p>
            </div> :

          <p className="text-[11px] text-muted-foreground/50 italic bg-muted/30 rounded px-2 py-1.5">
              Aucun email associé
            </p>
          }
        </div>

        {/* Dates clés */}
        <div className="px-4 py-2 border-b border-border/30 text-xs">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Dates clés
          </p>
          <div className="space-y-0.5 text-muted-foreground">
          {billingEndDate ? (() => {
              const daysLeft = Math.ceil((new Date(billingEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              const isUrgent = daysLeft <= 15 && daysLeft >= 0
              return (
                <p className={isUrgent ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                  Fin période factu: <span className={isUrgent ? 'font-semibold' : 'text-foreground font-medium'}>{formatDateFr(billingEndDate)}</span>
                  {isUrgent && <span className="ml-1">{daysLeft <= 3 ? '🔴' : '⚠️'} {daysLeft === 0 ? "Aujourd'hui" : `J-${daysLeft}`}</span>}
                </p>
              )
            })() : (
              <p>Déploiement: <span className="text-foreground font-medium">{deploymentDate ? formatDateFr(deploymentDate) : formatDateFr(etablissement.date_go_live)}</span></p>
            )}
            {renewalInfo &&
            <p className={renewalInfo.alert ? 'text-destructive font-medium' : ''}>
                Renouvellement: {renewalInfo.label} {renewalInfo.alert && '⚠️'}
              </p>
            }
          </div>
        </div>

        {/* Équipe */}
        {(etablissement.csm || etablissement.chef_projet) &&
        <div className="px-4 py-2 border-b border-border/30 text-xs">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              <Users className="w-3 h-3" /> Équipe
            </div>
            <div className="space-y-0.5 text-muted-foreground">
              {etablissement.csm &&
            <p>CSM: <span className="font-medium text-foreground">{etablissement.csm.prenom} {etablissement.csm.nom}</span></p>
            }
              {etablissement.chef_projet &&
            <p>CP: <span className="font-medium text-foreground">{etablissement.chef_projet.prenom} {etablissement.chef_projet.nom}</span></p>
            }
            </div>
          </div>
        }

        {/* Actions organisationnelles */}
        {(() => {
          const actions = (etablissement as any).prochaine_action_orga;
          if (!actions || !Array.isArray(actions) || actions.length === 0) return null;
          const pending = actions.filter((a: any) => !a.done);
          if (pending.length === 0) return null;
          return (
            <div className="px-4 py-2 border-b border-border/30 text-xs">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Actions orga ({pending.length})
              </p>
              <ul className="space-y-0.5">
                {pending.slice(0, 3).map((a: any, i: number) =>
                <li key={`action-orga-${i}-${String(a.text).slice(0, 20)}`} className="text-muted-foreground truncate">• {a.text}</li>
                )}
                {pending.length > 3 &&
                <li className="text-muted-foreground/60 italic">+{pending.length - 3} autre(s)</li>
                }
              </ul>
            </div>);

        })()}

        {/* Alertes */}
        {(() => {
          if (!health || health.alerts.length === 0) return null;
          // Filter out alerts already shown in "Dates clés" (renewal info)
          const filteredAlerts = health.alerts.filter((alert) => {
            const lower = alert.toLowerCase();
            if (renewalInfo && (lower.includes('renouvellement') || lower.includes('renewal'))) return false;
            if (renewalInfo && (lower.includes('contrat expiré') || lower.includes('contract expired') || lower.includes('expir'))) return false;
            return true;
          });
          if (filteredAlerts.length === 0) return null;
          return (
            <div className="px-4 py-2">
              <div className="text-[10px] uppercase tracking-wider font-medium flex items-center gap-1 text-orange-600 dark:text-orange-400 mb-1">
                <AlertTriangle className="w-3 h-3" /> Alertes
              </div>
              <ul className="text-xs space-y-0.5">
                {filteredAlerts.slice(0, 3).map((alert, idx) =>
                  <li key={idx} className="text-muted-foreground">• {alert}</li>
                )}
              </ul>
            </div>
          );
        })()}

        {/* Spacer */}
        <div className="flex-1" />
      </CardContent>
    </Card>);

}