import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  Send,
  Loader2,
  X,
  StopCircle,
  Trash2,
  FileText,
  CheckSquare,
  Mail,
  Building2,
  Zap,
} from 'lucide-react';
import { usePulseAIChat, AIChatMessage, AIAction, EntityLink } from '@/hooks/pulse/usePulseAIChat';
import { AIActionCard } from './AIActionCard';
import { PulseMarkdownRenderer } from './PulseMarkdownRenderer';
import { cn } from '@/lib/utils';

interface AIChatPanelProps {
  conversationId: string;
  onClose?: () => void;
  onOpenEmailComposer?: (draft: { to: string[]; cc?: string[]; subject: string; body: string; etablissement_id?: string }) => void;
  onOpenEtablissement?: (id: string) => void;
  onOpenTask?: (id: string) => void;
  onOpenEmail?: (threadId: string) => void;
}

const QUICK_ACTIONS = [
  { icon: FileText, label: 'Résumer', prompt: 'Résume cette conversation Pulse de manière concise avec les points clés et décisions.', color: 'text-blue-500 bg-blue-500/10' },
  { icon: CheckSquare, label: 'Créer tâche', prompt: 'Crée une tâche basée sur le dernier sujet discuté dans cette conversation.', color: 'text-green-500 bg-green-500/10' },
  { icon: Mail, label: 'Préparer email', prompt: 'Prépare un email professionnel basé sur le contexte de cette conversation.', color: 'text-amber-500 bg-amber-500/10' },
  { icon: Building2, label: 'Infos client', prompt: 'Donne-moi les informations clés sur l\'établissement ou le client lié à cette conversation.', color: 'text-purple-500 bg-purple-500/10' },
];

const ADVANCED_PROMPTS = [
  { icon: Zap, label: 'Mes tâches urgentes', prompt: 'Quelles sont mes tâches les plus urgentes à traiter aujourd\'hui ?', color: 'text-red-500' },
  { icon: Mail, label: 'Emails non traités', prompt: 'Quels sont les emails importants que je n\'ai pas encore traités ?', color: 'text-blue-500' },
  { icon: Building2, label: 'Établissements à relancer', prompt: 'Quels établissements prospects devrais-je relancer cette semaine ?', color: 'text-purple-500' },
];

export function AIChatPanel({
  conversationId,
  onClose,
  onOpenEmailComposer,
  onOpenEtablissement,
  onOpenTask,
  onOpenEmail,
}: AIChatPanelProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleAction = (action: AIAction) => {
    switch (action.type) {
      case 'open_email_composer':
        if (onOpenEmailComposer && action.data?.to && action.data?.subject && action.data?.body) {
          onOpenEmailComposer({
            to: action.data.to,
            cc: action.data.cc,
            subject: action.data.subject,
            body: action.data.body,
            etablissement_id: action.data.etablissement_id,
          });
        } else {
          // Fallback: navigate to emails with draft data in state
          navigate('/emails', { state: { draft: action.data } });
        }
        break;
      case 'created_task':
      case 'open_task':
        if (onOpenTask && action.data?.id) {
          onOpenTask(action.data.id);
        } else if (action.data?.etablissement_id) {
          navigate(`/etablissements/${action.data.etablissement_id}?tab=taches`);
        }
        break;
      case 'created_etablissement':
      case 'updated_etablissement':
      case 'open_etablissement':
        if (onOpenEtablissement && action.data?.id) {
          onOpenEtablissement(action.data.id);
        } else if (action.data?.id) {
          navigate(`/etablissements/${action.data.id}`);
        }
        break;
      case 'open_email':
        if (onOpenEmail && action.data?.id) {
          onOpenEmail(action.data.id);
        } else if (action.data?.id) {
          navigate(`/emails?thread=${action.data.id}`);
        }
        break;
    }
  };

  const handleEntityClick = (entity: EntityLink) => {
    switch (entity.type) {
      case 'etablissement':
        if (onOpenEtablissement) {
          onOpenEtablissement(entity.id);
        } else {
          navigate(`/etablissements/${entity.id}`);
        }
        break;
      case 'tache':
        if (onOpenTask) {
          onOpenTask(entity.id);
        }
        break;
      case 'email':
        if (onOpenEmail) {
          onOpenEmail(entity.id);
        } else {
          navigate(`/emails?thread=${entity.id}`);
        }
        break;
      case 'contact':
        navigate(`/contacts?id=${entity.id}`);
        break;
      case 'groupe':
        navigate(`/groupes/${entity.id}`);
        break;
      case 'partenaire':
        navigate(`/partenaires/${entity.id}`);
        break;
    }
  };

  const { messages, isLoading, sendMessage, cancelRequest, clearMessages, executeAction } = usePulseAIChat({
    conversationId,
    onAction: handleAction,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Assistant Pulse IA</h3>
            <p className="text-xs text-muted-foreground">Peut agir sur vos données</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clearMessages}
              title="Effacer la conversation"
              aria-label="Effacer la conversation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Fermer l'assistant IA">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="space-y-6">
            {/* Welcome message */}
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-medium text-lg mb-2">Assistant IA Complet</h4>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Je peux rechercher, créer des tâches, préparer des emails, 
                et modifier vos données CRM. Demandez-moi !
              </p>
            </div>

            {/* Quick actions - Grid 2x2 */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground px-1">Actions rapides</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={`ai-chat-quick-${action.label}`}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-background hover:bg-accent hover:border-primary/30 hover:shadow-sm transition-all text-center group"
                  >
                    <div className={cn("p-2.5 rounded-lg transition-transform group-hover:scale-110", action.color)}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced prompts */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">Suggestions</p>
              <div className="space-y-1">
                {ADVANCED_PROMPTS.map((prompt) => (
                  <button
                    key={`ai-chat-prompt-${prompt.label}`}
                    onClick={() => handleQuickAction(prompt.prompt)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent transition-colors"
                  >
                    <prompt.icon className={cn("h-4 w-4", prompt.color)} />
                    <span>{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onActionExecute={handleAction}
                onEntityClick={handleEntityClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input - Redesigned */}
      <div className="shrink-0 p-4 border-t bg-muted/30">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Demandez à l'IA d'agir..."
              className="flex-1 min-w-0 min-h-[48px] max-h-32 resize-none rounded-xl border-primary/20 focus:border-primary/50 bg-background"
              rows={1}
              disabled={isLoading}
            />
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={cancelRequest}
                aria-label="Annuler la requête"
                className="shrink-0 h-12 w-12 rounded-xl border-destructive/50 hover:bg-destructive/10"
              >
                <StopCircle className="h-5 w-5 text-destructive" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                aria-label="Envoyer le message"
                className={cn(
                  "shrink-0 h-12 w-12 rounded-xl transition-all",
                  input.trim() 
                    ? "bg-primary hover:bg-primary/90 shadow-sm hover:shadow-md" 
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd> envoyer • <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⇧↵</kbd> nouvelle ligne
          </p>
        </form>
      </div>
    </div>
  );
}

// Message bubble component
interface MessageBubbleProps {
  message: AIChatMessage;
  onActionExecute: (action: AIAction) => void;
  onEntityClick: (entity: EntityLink) => void;
}

function MessageBubble({ message, onActionExecute, onEntityClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      'flex gap-3',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3',
        isUser 
          ? 'bg-primary text-primary-foreground rounded-tr-md'
          : 'bg-muted rounded-tl-md'
      )}>
        <div className={cn("text-sm", !isUser && "overflow-x-auto")}>
          {message.content ? (
            <PulseMarkdownRenderer 
              content={message.content} 
              entityLinks={message.entityLinks}
              onEntityClick={onEntityClick}
            />
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Réflexion en cours...
            </span>
          )}
        </div>
        
        {/* Render action cards for assistant messages */}
        {!isUser && message.actions && message.actions.length > 0 && !message.isStreaming && (
          <div className="mt-2 space-y-2">
            {message.actions.map((action, index) => (
              <AIActionCard
                key={`${action.type}-${index}`}
                action={action}
                onExecute={onActionExecute}
              />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-xs font-medium text-primary-foreground">Moi</span>
        </div>
      )}
    </div>
  );
}
