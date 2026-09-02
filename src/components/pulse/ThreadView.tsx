import { useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { usePulseThreadReplies } from '@/hooks/pulse/usePulseMessages'
import { MessageEditor } from './MessageEditor'
import type { PulseMessage } from '@/types/pulse'
import { linkify } from '@/lib/linkify'

interface ThreadViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentMessage: PulseMessage | null
  conversationId: string
}

export function ThreadView({ open, onOpenChange, parentMessage, conversationId }: ThreadViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: replies, isLoading } = usePulseThreadReplies(
    open && parentMessage ? parentMessage.id : undefined
  )

  const getInitials = (nom?: string, prenom?: string) => {
    if (!nom && !prenom) return '?'
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase()
  }

  // Scroll to bottom on new reply
  useEffect(() => {
    if (replies && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [replies?.length])

  if (!parentMessage) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => onOpenChange(false)}
              aria-label="Fermer"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle>Fil de discussion</SheetTitle>
            <span className="text-sm text-muted-foreground ml-auto">
              {(replies?.length || 0) + 1} message{(replies?.length || 0) > 0 ? 's' : ''}
            </span>
          </div>
        </SheetHeader>

        <ScrollArea ref={scrollRef} className="flex-1">
          <div className="p-4 space-y-4">
            {/* Parent message */}
            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(parentMessage.user?.nom, parentMessage.user?.prenom)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {parentMessage.user?.prenom} {parentMessage.user?.nom}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(parentMessage.created_at), "d MMM 'à' HH:mm", {
                        locale: fr,
                      })}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words mt-1">
                    {linkify(parentMessage.content)}
                  </div>
                </div>
              </div>
            </div>

            {/* Separator */}
            {(replies?.length || 0) > 0 && (
              <div className="relative flex items-center py-2">
                <div className="flex-1 border-t" />
                <span className="px-3 text-xs text-muted-foreground bg-background">
                  {replies?.length} réponse{(replies?.length || 0) > 1 ? 's' : ''}
                </span>
                <div className="flex-1 border-t" />
              </div>
            )}

            {/* Replies */}
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`pulse-thread-skeleton-${i}`} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {replies?.map((reply) => (
                  <div key={reply.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(reply.user?.nom, reply.user?.prenom)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {reply.user?.prenom} {reply.user?.nom}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(reply.created_at), 'HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words mt-0.5">
                        {linkify(reply.content)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Reply editor */}
        <div className="p-4 border-t flex-shrink-0">
          <MessageEditor
            conversationId={conversationId}
            parentMessageId={parentMessage.id}
            onTyping={() => {}}
            placeholder="Répondre dans le fil..."
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
