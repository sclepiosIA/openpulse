import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ExternalLink, MapPin, ChevronDown, CheckCircle2, Clock, Mail, Target, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEtablissement } from '@/hooks/crm/useEtablissements';
import { useQuery } from '@tanstack/react-query';
import { getStatusBadgeVariant } from '@/config/statusConfig';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from "@/integrations/supabase/client";

interface EtablissementContextBannerProps {
  etablissementId: string;
  etablissementNom?: string;
  etablissementLogoUrl?: string | null;
  isMobileView?: boolean;
}

export function EtablissementContextBanner({
  etablissementId,
  etablissementNom,
  etablissementLogoUrl,
  isMobileView = false,
}: EtablissementContextBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: etablissement } = useEtablissement(etablissementId);

  const nom = etablissement?.nom || etablissementNom || 'Établissement';
  const logoUrl = etablissement?.logo_url || etablissementLogoUrl;
  const ville = etablissement?.ville;
  const statut = etablissement?.statut;
  const progression = etablissement?.progression;
  const prochaine_action_csm = (etablissement as any)?.prochaine_action_csm;
  const prochaine_action_orga = (etablissement as any)?.prochaine_action_orga;

  // Fetch open tasks count
  const { data: openTasks } = useQuery({
    queryKey: ['pulse-banner', 'tasks', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taches')
        .select('id, titre, statut, echeance')
        .eq('etablissement_id', etablissementId)
        .eq('archive', false)
        .neq('statut', 'Terminé')
        .order('echeance', { ascending: true, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!etablissementId && isExpanded,
    staleTime: 60000,
  });

  // Fetch latest email thread
  const { data: latestEmail } = useQuery({
    queryKey: ['pulse-banner', 'email', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('id, subject, ai_generated_title, ai_summary, last_message_date')
        .eq('etablissement_id', etablissementId)
        .order('last_message_date', { ascending: false })
        .limit(1);
      if (error) return null;
      return data?.[0] || null;
    },
    enabled: !!etablissementId && isExpanded,
    staleTime: 60000,
  });

  const hasDetails = progression != null || statut;

  return (
    <div className={cn(
      "flex-shrink-0 border-b border-primary/10",
      "bg-gradient-to-r from-primary/5 via-white/80 to-primary/5 backdrop-blur-sm",
      isMobileView ? "px-3 py-2" : "px-4 py-2.5"
    )}>
      {/* Main banner row */}
      <div className="flex items-center gap-3">
        <Link
          to={`/etablissements/${etablissementId}`}
          className="flex items-center gap-3 group flex-1 min-w-0"
        >
          <Avatar className={cn(isMobileView ? "h-8 w-8" : "h-9 w-9")}>
            {logoUrl ? (
              <AvatarImage src={logoUrl} alt={nom} className="object-contain p-0.5" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-semibold truncate group-hover:text-primary transition-colors",
                isMobileView ? "text-xs" : "text-sm"
              )}>
                {nom}
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {ville && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {ville}
                </span>
              )}
              {statut && (
                <Badge variant={getStatusBadgeVariant(statut)} className="text-[10px] h-4 px-1.5">
                  {statut}
                </Badge>
              )}
              {progression != null && !isExpanded && (
                <span className="text-[10px] text-muted-foreground font-medium ml-1">
                  {progression}%
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Expand toggle */}
        {hasDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Réduire les détails" : "Afficher les détails"}
            aria-expanded={isExpanded}
            className="flex-shrink-0 p-1.5 rounded-md hover:bg-primary/10 transition-colors"
          >
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180"
            )} />
          </button>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className={cn(
          "mt-2.5 pt-2.5 border-t border-primary/10 space-y-2.5 animate-in slide-in-from-top-2 duration-200",
          isMobileView ? "text-xs" : "text-sm"
        )}>
          {/* Progression bar */}
          {progression != null && (
            <div className="flex items-center gap-3">
              <TrendingUp className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 flex items-center gap-2">
                <Progress value={progression || 0} className="h-1.5 flex-1" />
                <span className="text-xs font-semibold text-primary w-8 text-right">{progression}%</span>
              </div>
            </div>
          )}

          {/* Open tasks */}
          {openTasks && openTasks.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-medium">{openTasks.length} tâche{openTasks.length > 1 ? 's' : ''} en cours</span>
              </div>
              <div className="ml-5 space-y-0.5">
                {openTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      task.statut === 'Bloqué' ? 'bg-destructive' : task.statut === 'En cours' ? 'bg-primary' : 'bg-muted-foreground'
                    )} />
                    <span className="truncate">{task.titre}</span>
                    {task.echeance && (
                      <span className="text-[10px] flex-shrink-0 opacity-70">
                        {format(new Date(task.echeance), 'dd MMM', { locale: fr })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest email */}
          {latestEmail && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-xs">Dernier email : </span>
                <span className="text-xs truncate">
                  {latestEmail.ai_generated_title || latestEmail.subject}
                </span>
                {latestEmail.ai_summary && (
                  <p className="text-[10px] text-muted-foreground/70 line-clamp-2 mt-0.5">
                    {latestEmail.ai_summary}
                  </p>
                )}
                {latestEmail.last_message_date && (
                  <span className="text-[10px] opacity-60 ml-1">
                    · {format(new Date(latestEmail.last_message_date), 'dd MMM', { locale: fr })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Prochaines actions */}
          {(prochaine_action_csm || prochaine_action_orga) && (
            <div className="space-y-1">
              {prochaine_action_csm && (
                <div className="flex items-start gap-1.5 text-muted-foreground">
                  <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
                  <span className="text-xs line-clamp-1"><span className="font-medium">CSM :</span> {prochaine_action_csm}</span>
                </div>
              )}
              {prochaine_action_orga && (
                <div className="flex items-start gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-accent-foreground" />
                  <span className="text-xs line-clamp-1"><span className="font-medium">Orga :</span> {prochaine_action_orga}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
