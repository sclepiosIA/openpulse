/**
 * Fil de conversation type "ticket" pour une tâche portail client.
 * Affiche les messages échangés entre OpenPulse et l'établissement, et permet
 * au staff de répondre (avec option "note interne" non visible côté établissement).
 */
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Trash2, Lock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useClientPortalTaskMessages,
  useCreateClientPortalTaskMessage,
  useDeleteClientPortalTaskMessage,
  type ClientPortalTaskMessage,
} from "@/hooks/portail/useClientPortalTaskMessages";
import { useAuth } from "@/hooks/shared/useAuth";

interface Props {
  taskId: string; // raw uuid (sans préfixe portal-)
}

export function ClientPortalTaskConversation({ taskId }: Props) {
  const { user } = useAuth();
  const { data: messages, isLoading } = useClientPortalTaskMessages(taskId);
  const createMsg = useCreateClientPortalTaskMessage();
  const deleteMsg = useDeleteClientPortalTaskMessage();

  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll en bas quand un nouveau message arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    await createMsg.mutateAsync({
      task_id: taskId,
      content: trimmed,
      is_internal: isInternal,
    });
    setContent("");
    setIsInternal(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 border rounded-lg bg-muted/20">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background/80 backdrop-blur-sm rounded-t-lg flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Conversation</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {messages?.length ?? 0} message{(messages?.length ?? 0) > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Liste des messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Chargement…
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Aucun message pour le moment.
            <br />
            Démarrez la conversation avec l'établissement.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              canDelete={msg.author_user_id === user?.id}
              onDelete={() =>
                deleteMsg.mutate({ id: msg.id, task_id: taskId })
              }
            />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3 space-y-2 bg-background/80 backdrop-blur-sm rounded-b-lg">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire une réponse… (Ctrl/Cmd + Entrée pour envoyer)"
          rows={3}
          className="resize-none text-sm"
          disabled={createMsg.isPending}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="internal-note"
              checked={isInternal}
              onCheckedChange={setIsInternal}
              disabled={createMsg.isPending}
            />
            <Label
              htmlFor="internal-note"
              className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer"
            >
              <Lock className="h-3 w-3" />
              Note interne
            </Label>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!content.trim() || createMsg.isPending}
          >
            {createMsg.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}

interface BubbleProps {
  message: ClientPortalTaskMessage;
  canDelete: boolean;
  onDelete: () => void;
}

function MessageBubble({ message, canDelete, onDelete }: BubbleProps) {
  const isMarque = message.author_type === "marque";
  return (
    <div className={cn("flex flex-col gap-1", isMarque ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm break-words",
          isMarque
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground border",
          message.is_internal && "ring-2 ring-warning/60"
        )}
      >
        <div className="flex items-center gap-2 mb-1 text-xs opacity-80">
          <span className="font-medium">
            {message.author_name ?? (isMarque ? "OpenPulse" : "Établissement")}
          </span>
          {message.is_internal && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4 gap-1 border-warning text-warning bg-warning/10">
              <Lock className="h-2.5 w-2.5" />
              Interne
            </Badge>
          )}
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div className="text-[10px] opacity-70 mt-1 text-right">
          {format(new Date(message.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
        </div>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          <Trash2 className="h-2.5 w-2.5" />
          Supprimer
        </button>
      )}
    </div>
  );
}
