import { useMemo, useState } from 'react'
import { Check, Loader2, MessageSquare, Reply, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/hooks/shared/useAuth'
import { useProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import {
  useWhiteboardComments,
  useCreateComment,
  useReplyComment,
  useResolveComment,
  useDeleteComment,
} from '@/hooks/whiteboards/useWhiteboardComments'

interface Props {
  whiteboardId: string | null
  /** Centre courant de la vue, pour ancrer le commentaire sur la scène. */
  getAnchor: () => { x: number; y: number }
  onFocusComment: (x: number, y: number) => void
}

/** Fil de commentaires contextuels du tableau (réponses, mentions, résolution). */
export function WhiteboardCommentsPanel({ whiteboardId, getAnchor, onFocusComment }: Props) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [mention, setMention] = useState<string>('none')
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const { data: comments = [], isLoading } = useWhiteboardComments(whiteboardId)
  const { data: profiles = [] } = useProfilesWithRoles()
  const createComment = useCreateComment()
  const replyComment = useReplyComment()
  const resolveComment = useResolveComment()
  const deleteComment = useDeleteComment()

  const visible = useMemo(
    () => comments.filter((c) => (showResolved ? true : !c.resolved_at)),
    [comments, showResolved]
  )

  const handleSubmit = async () => {
    if (!whiteboardId || !content.trim()) return
    const anchor = getAnchor()
    try {
      await createComment.mutateAsync({
        whiteboardId,
        content,
        x: anchor.x,
        y: anchor.y,
        mentions: mention !== 'none' ? [mention] : [],
      })
      setContent('')
      setMention('none')
    } catch (e: any) {
      toast({
        title: 'Commentaire non enregistré',
        description: e?.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="space-y-2 rounded-lg border border-border/60 p-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ajouter un commentaire sur la zone visible…"
          className="min-h-[64px] resize-none text-sm"
          aria-label="Nouveau commentaire"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={mention} onValueChange={setMention}>
            <SelectTrigger className="h-9 flex-1 text-xs" aria-label="Mentionner une personne">
              <SelectValue placeholder="Mentionner…" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="none">Sans mention</SelectItem>
              {profiles
                .filter((p) => p.actif && p.user_id !== user?.id)
                .map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.prenom} {p.nom}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-9 min-h-9 shrink-0"
            onClick={handleSubmit}
            disabled={!content.trim() || createComment.isPending}
          >
            {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publier'}
          </Button>
        </div>
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="h-8 min-h-8 self-start px-1 text-xs text-muted-foreground"
        onClick={() => setShowResolved((v) => !v)}
      >
        {showResolved ? 'Masquer les commentaires résolus' : 'Afficher les commentaires résolus'}
      </Button>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && visible.length === 0 && (
          <p className="flex flex-col items-center gap-2 px-1 py-8 text-center text-xs text-muted-foreground">
            <MessageSquare className="h-5 w-5" />
            Aucun commentaire.
          </p>
        )}
        {visible.map((c) => (
          <div key={c.id} className="rounded-lg border border-border/60 p-2">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onFocusComment(c.x, c.y)}
              >
                <span className="block text-xs font-medium">{c.author_name}</span>
                <span className="block whitespace-pre-wrap break-words text-sm">{c.content}</span>
              </button>
              {c.resolved_at && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Résolu
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {new Date(c.created_at).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>

            {c.replies.length > 0 && (
              <ul className="mt-1.5 space-y-1 border-l border-border/60 pl-2">
                {c.replies.map((r) => (
                  <li key={r.id} className="text-xs">
                    <span className="font-medium">{r.author_name} : </span>
                    <span className="whitespace-pre-wrap break-words">{r.content}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-1.5 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 min-h-8 gap-1 px-2 text-xs"
                onClick={() => setReplyFor(replyFor === c.id ? null : c.id)}
              >
                <Reply className="h-3.5 w-3.5" /> Répondre
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 min-h-8 gap-1 px-2 text-xs"
                onClick={() =>
                  whiteboardId &&
                  resolveComment.mutate({ whiteboardId, commentId: c.id, resolved: !c.resolved_at })
                }
              >
                {c.resolved_at ? (
                  <Undo2 className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {c.resolved_at ? 'Rouvrir' : 'Résoudre'}
              </Button>
              {c.author_id === user?.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 min-h-8 gap-1 px-2 text-xs text-destructive"
                  onClick={() =>
                    whiteboardId && deleteComment.mutate({ whiteboardId, commentId: c.id })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
              )}
            </div>

            {replyFor === c.id && (
              <div className="mt-1.5 flex flex-col gap-1.5 sm:flex-row">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Votre réponse…"
                  className="min-h-[40px] resize-none text-sm"
                  aria-label="Réponse au commentaire"
                />
                <Button
                  size="sm"
                  className="h-9 min-h-9 shrink-0"
                  disabled={!replyContent.trim() || replyComment.isPending}
                  onClick={async () => {
                    if (!whiteboardId) return
                    await replyComment.mutateAsync({
                      whiteboardId,
                      commentId: c.id,
                      content: replyContent,
                    })
                    setReplyContent('')
                    setReplyFor(null)
                  }}
                >
                  Envoyer
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
