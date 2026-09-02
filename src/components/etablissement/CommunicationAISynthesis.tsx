import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Brain, RefreshCw, CheckCircle2, AlertTriangle, TrendingUp, MessageSquare, Calendar } from 'lucide-react'
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface CommunicationAISynthesisProps {
  etablissementId: string
  etablissementNom?: string
}

interface SynthesisResult {
  summary: string
  key_points: string[]
  pending_actions: string[]
  sentiment: 'positif' | 'neutre' | 'négatif' | 'mitigé'
  last_contact_date: string | null
}

const sentimentConfig: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  positif: { label: 'Positif', color: 'text-green-600 bg-green-100 dark:bg-green-900/30', icon: TrendingUp },
  neutre: { label: 'Neutre', color: 'text-muted-foreground bg-muted', icon: MessageSquare },
  négatif: { label: 'Négatif', color: 'text-red-600 bg-red-100 dark:bg-red-900/30', icon: AlertTriangle },
  mitigé: { label: 'Mitigé', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle },
}

export function CommunicationAISynthesis({ etablissementId, etablissementNom }: CommunicationAISynthesisProps) {
  const [result, setResult] = useState<SynthesisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const handleGenerate = async () => {
    setIsLoading(true)
    try {
      const data = await invokeEdge<any>('synthesize-communication', { etablissement_id: etablissementId });
      if (data?.error) throw new Error(data.error)

      setResult(data.result as SynthesisResult)
      setGeneratedAt(new Date())
    } catch (err: unknown) {
      toast.error(sanitizeSupabaseError(err))
    } finally {
      setIsLoading(false)
    }
  }

  if (!result && !isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Brain className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Synthèse IA des communications</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Analysez l'ensemble des emails et interactions avec {etablissementNom || 'cet établissement'} pour obtenir un résumé structuré de la relation.
          </p>
          <Button onClick={handleGenerate} size="lg">
            <Brain className="w-5 h-5 mr-2" />
            Générer la synthèse
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Analyse des communications en cours...</p>
          <p className="text-xs text-muted-foreground mt-1">Cela peut prendre quelques secondes</p>
        </CardContent>
      </Card>
    )
  }

  if (!result) return null

  const sentiment = sentimentConfig[result.sentiment] || sentimentConfig.neutre
  const SentimentIcon = sentiment.icon

  return (
    <div className="space-y-4">
      {/* Header with regenerate */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Synthèse IA</h3>
          {generatedAt && (
            <span className="text-xs text-muted-foreground">
              Générée {formatDistanceToNow(generatedAt, { addSuffix: true, locale: fr })}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Régénérer
        </Button>
      </div>

      {/* Summary + Sentiment */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Résumé de la relation</CardTitle>
            <Badge className={sentiment.color}>
              <SentimentIcon className="w-3 h-3 mr-1" />
              {sentiment.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.summary}</p>
          {result.last_contact_date && (
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Dernier contact : {new Date(result.last_contact_date).toLocaleDateString('fr-FR')}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key points */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Points clés récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.key_points.length > 0 ? (
              <ul className="space-y-2">
                {result.key_points.map((point, i) => (
                  <li key={`keypoint-${i}-${point.slice(0, 20)}`} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun point clé identifié</p>
            )}
          </CardContent>
        </Card>

        {/* Pending actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Actions en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.pending_actions.length > 0 ? (
              <ul className="space-y-2">
                {result.pending_actions.map((action, i) => (
                  <li key={`pending-${i}-${action.slice(0, 20)}`} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune action en attente</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
