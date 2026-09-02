import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEnrichProspect, useEnrichmentHistory } from '@/hooks/crm/useEnrichProspect';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  etablissementId: string;
  enrichmentStatus?: string | null;
  enrichmentAt?: string | null;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
}

/** Bouton "Enrichir / Re-enrichir" sur fiche établissement (INSEE Sirene + Pappers public). */
export function EnrichProspectButton({
  etablissementId,
  enrichmentStatus,
  enrichmentAt,
  variant = 'outline',
  size = 'sm',
}: Props) {
  const enrich = useEnrichProspect();
  const { data: history } = useEnrichmentHistory(etablissementId);
  const last = history?.[0];

  const label = enrichmentStatus === 'enriched' ? 'Re-enrichir' : 'Enrichir';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            disabled={enrich.isPending}
            onClick={() => enrich.mutate(etablissementId)}
            className="gap-2"
          >
            {enrich.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div>Récupère SIRET, NAF, effectif, dirigeants depuis les sources publiques (INSEE).</div>
            {enrichmentAt && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Dernier : {format(new Date(enrichmentAt), 'dd MMM yyyy HH:mm', { locale: fr })}
              </div>
            )}
            {last && (
              <div className="text-muted-foreground">
                {last.success
                  ? `${last.fields_updated.length} champ(s) mis à jour`
                  : `Échec : ${last.error_message ?? 'inconnu'}`}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
