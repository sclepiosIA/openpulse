import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, User, MessageSquare, Building2, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  threadId: string;
  children: React.ReactNode;
}

const categoryColors: Record<string, string> = {
  'commercial': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'support': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'technique': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'administratif': 'bg-gray-100 text-foreground dark:bg-gray-900/30 dark:text-muted-foreground',
  'formation': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export function AIEmailHoverCard({ threadId, children }: Props) {
  const navigate = useNavigate();
  
  const { data: thread } = useQuery({
    queryKey: ['email-thread-hover', threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_threads')
        .select(`
          id,
          subject,
          ai_generated_title,
          ai_summary,
          category,
          last_message_date,
          message_count,
          participants,
          tags,
          etablissement:etablissements(id, nom)
        `)
        .eq('id', threadId)
        .maybeSingle();

      return data;
    },
    enabled: !!threadId,
    staleTime: 60000,
  });

  // Get last message preview
  const { data: lastMessage } = useQuery({
    queryKey: ['email-last-message-hover', threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_messages')
        .select('from_name, from_address, body_text, sent_date')
        .eq('thread_id', threadId)
        .order('sent_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      return data;
    },
    enabled: !!threadId,
    staleTime: 60000,
  });

  if (!thread) return <>{children}</>;

  const participants = thread.participants as Array<{ email?: string; name?: string }> || [];
  const mainParticipant = participants.find(p => !p.email?.includes('openpulse') && !p.email?.includes('marque')) || participants[0];

  // Truncate body text for preview
  const bodyPreview = lastMessage?.body_text 
    ? lastMessage.body_text.slice(0, 150).trim() + (lastMessage.body_text.length > 150 ? '...' : '')
    : null;

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-96" side="right" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <EntityAvatar 
              name={mainParticipant?.name || mainParticipant?.email || 'Email'}
              email={mainParticipant?.email}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight line-clamp-2">
                {thread.ai_generated_title || thread.subject}
              </h4>
              {mainParticipant && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <User className="h-3 w-3" />
                  <span className="truncate">{mainParticipant.name || mainParticipant.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-2 items-center text-xs">
            {thread.category && (
              <Badge variant="secondary" className={categoryColors[thread.category.toLowerCase()] || ''}>
                {thread.category}
              </Badge>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{thread.message_count} message{thread.message_count > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(thread.last_message_date), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
            </div>
          </div>

          {/* Tags */}
          {thread.tags && thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {thread.tags.slice(0, 4).map((tag: string) => (
                <Badge key={`email-hover-tag-${tag}`} variant="outline" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {thread.tags.length > 4 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 opacity-60">
                  +{thread.tags.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* Établissement lié */}
          {thread.etablissement && (
            <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 rounded-md px-2 py-1.5">
              <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-muted-foreground">Lié à:</span>
              <span className="font-medium text-blue-700 dark:text-blue-400">{thread.etablissement.nom}</span>
            </div>
          )}

          {/* Last message preview */}
          {bodyPreview && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground mb-1 font-medium">
                Dernier message:
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 bg-muted/30 rounded p-2">
                {bodyPreview}
              </p>
            </div>
          )}

          {/* Summary */}
          {thread.ai_summary && !bodyPreview && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {thread.ai_summary}
              </p>
            </div>
          )}

          {/* Action button */}
          <div className="pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full h-8 text-xs"
              onClick={() => navigate(`/emails?thread=${thread.id}`)}
            >
              <Mail className="h-3 w-3 mr-1.5" />
              Ouvrir la conversation
              <ExternalLink className="h-3 w-3 ml-auto opacity-60" />
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
