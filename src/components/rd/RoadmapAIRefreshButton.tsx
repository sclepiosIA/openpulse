import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { invokeEdge } from '@/services/edgeFunctions'
import { useLatestRoadmapSummary } from '@/hooks/rd/useRoadmapAISummary'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/shared/use-toast'
import { useUserRole } from '@/hooks/shared/useUserRole'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Bouton de régénération manuelle du résumé IA roadmap.
 * Appelle l'edge function generate-roadmap-summary pour tous les DPIs.
 * Affiche la date de dernière génération.
 * Visible uniquement pour admin/direction.
 */
export function RoadmapAIRefreshButton() {
  const { isAdmin, isDirection } = useUserRole()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  const { data: lastSummary } = useLatestRoadmapSummary()

  if (!isAdmin && !isDirection) return null

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const data = await invokeEdge<{ results?: Array<{ success: boolean }> }>(
        'generate-roadmap-summary'
      )
      const ok = (data?.results ?? []).filter((r) => r.success).length
      const ko = (data?.results ?? []).filter((r) => !r.success).length
      toast({
        title: 'Résumé IA roadmap régénéré',
        description: `${ok} DPI mis à jour${ko > 0 ? `, ${ko} en échec` : ''}.`,
      })
      await qc.invalidateQueries({ queryKey: ['roadmap_ai_summaries'] })
    } catch (err: any) {
      toast({
        title: 'Échec de la régénération',
        description: err?.message ?? 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const lastLabel = lastSummary?.generated_at
    ? `Dernière MAJ ${formatDistanceToNow(new Date(lastSummary.generated_at), { addSuffix: true, locale: fr })}`
    : "Aucun résumé généré pour l'instant"

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2 h-9 bg-card/10 backdrop-blur-sm border-white/20 text-white hover:bg-card/20 hover:text-white"
            aria-label={`Régénérer résumé IA roadmap. ${lastLabel}`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="hidden md:inline font-medium">Résumé IA</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">Régénérer le résumé IA roadmap</p>
          <p className="text-xs text-muted-foreground mt-1">{lastLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
