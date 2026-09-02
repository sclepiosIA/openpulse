import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabaseBrowser"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Mail, MessageSquare, Sparkles } from "lucide-react"

interface Props {
  etablissementId: string
  aiSummary?: string | null
  summaryUpdatedAt?: string | null
  children: React.ReactNode
}

function fmt(v?: string | null) {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return format(d, "d MMM yyyy 'à' HH:mm", { locale: fr })
}

export function ProspectLastExchangesHoverCard({
  etablissementId,
  aiSummary,
  summaryUpdatedAt,
  children,
}: Props) {
  const { data: lastMessage } = useQuery({
    queryKey: ["prospect-last-email", etablissementId],
    queryFn: async () => {
      const { data: threads } = await supabase
        .from("email_threads")
        .select("id, subject, ai_generated_title, last_message_date")
        .eq("etablissement_id", etablissementId)
        .order("last_message_date", { ascending: false })
        .limit(1)

      const thread = threads?.[0]
      if (!thread) return null

      const { data: msg } = await supabase
        .from("email_messages")
        .select("from_name, from_address, body_text, sent_date")
        .eq("thread_id", thread.id)
        .order("sent_date", { ascending: false })
        .limit(1)
        .maybeSingle()

      return { thread, msg }
    },
    enabled: !!etablissementId,
    staleTime: 60_000,
  })

  const hasContent = !!aiSummary || !!lastMessage?.msg

  return (
    <HoverCard openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="left" align="start" className="w-96 p-0">
        <div className="p-3 border-b bg-muted/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
            <MessageSquare className="h-3.5 w-3.5" />
            Derniers échanges
          </div>
        </div>

        <div className="p-3 space-y-3 max-h-[420px] overflow-auto">
          {!hasContent && (
            <p className="text-xs text-muted-foreground italic">
              Aucun échange récent enregistré pour ce prospect.
            </p>
          )}

          {aiSummary && (
            <div className="rounded-md border bg-primary/5 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary mb-1">
                <Sparkles className="h-3 w-3" />
                Résumé IA
                {summaryUpdatedAt && (
                  <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                    {fmt(summaryUpdatedAt)}
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap line-clamp-8">
                {aiSummary}
              </p>
            </div>
          )}

          {lastMessage?.msg && (
            <div className="rounded-md border p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-1">
                <Mail className="h-3 w-3" />
                <span className="truncate">
                  {lastMessage.msg.from_name || lastMessage.msg.from_address || "Inconnu"}
                </span>
                {lastMessage.msg.sent_date && (
                  <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                    {fmt(lastMessage.msg.sent_date)}
                  </span>
                )}
              </div>
              {(lastMessage.thread.ai_generated_title || lastMessage.thread.subject) && (
                <div className="text-[11px] font-medium text-foreground/80 mb-1 truncate">
                  {lastMessage.thread.ai_generated_title || lastMessage.thread.subject}
                </div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-5 whitespace-pre-wrap">
                {(lastMessage.msg.body_text || "").slice(0, 400).trim()}
                {(lastMessage.msg.body_text?.length ?? 0) > 400 ? "…" : ""}
              </p>
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t bg-muted/30 text-[10px] text-muted-foreground">
          Clic droit sur la ligne pour envoyer un email
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
