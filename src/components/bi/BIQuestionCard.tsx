import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Sparkles, Pencil, Trash2, Loader2 } from 'lucide-react'
import {
  useRunBIQuery,
  useExplainBIWithAI,
  useDeleteBIQuestion,
  type BIQuestion,
} from '@/hooks/bi/useBIStudio'
import { BIViz } from './BIViz'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function BIQuestionCard({
  question,
  onEdit,
  height = 320,
}: {
  question: BIQuestion
  onEdit?: (q: BIQuestion) => void
  height?: number
}) {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch, isFetching } = useRunBIQuery(question.id)
  const explain = useExplainBIWithAI()
  const del = useDeleteBIQuestion()
  const [analysis, setAnalysis] = useState<string | null>(null)

  const handleExplain = async () => {
    if (!data?.rows?.length) {
      toast.info('Aucune donnée à analyser.')
      return
    }
    try {
      const text = await explain.mutateAsync({
        question_name: question.name,
        rows: data.rows,
        viz_type: question.viz_type,
      })
      setAnalysis(text)
    } catch (e) {
      toast.error(`Analyse IA impossible : ${(e as Error).message}`)
    }
  }

  const handleDelete = () => {
    if (confirm(`Supprimer la question "${question.name}" ?`)) {
      del.mutate(question.id)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold truncate">{question.name}</CardTitle>
          {question.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {question.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {question.viz_type}
            </Badge>
            {data && (
              <span className="text-[10px] text-muted-foreground">
                {data.row_count} lignes · {data.duration_ms}ms{data.cached ? ' · cache' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => refetch()}
            title="Actualiser"
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleExplain}
            title="Analyser avec Jarvis"
            disabled={explain.isPending || !data?.rows?.length}
          >
            {explain.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </Button>
          {onEdit && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onEdit(question)}
              title="Éditer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : isError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-destructive">
            <div>Erreur : {(error as Error)?.message ?? 'inconnue'}</div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Réessayer
            </Button>
          </div>
        ) : (
          <BIViz rows={data?.rows ?? []} viz_type={question.viz_type} height={height} />
        )}

        {analysis && (
          <div className="mt-3 rounded-md border bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Analyse Jarvis
            </div>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-xs text-foreground/90">
              {analysis}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
