import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  MessageCircle,
  Users,
  Clock,
  CheckCircle,
  Send,
  MoreVertical,
  UserPlus,
  Ticket,
  ArrowUpRight,
  Settings,
  Zap,
  MessageSquare,
  TrendingUp,
  Star,
  Bot,
  User,
  Mail,
  Building
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useLiveChatConversations,
  useLiveChatConversation,
  useLiveChatMessages,
  useSendMessage,
  useAssignConversation,
  useResolveConversation,
  useEscalateConversation,
  useCreateTicketFromChat,
  useLiveChatAgents,
  useToggleAgentAvailability,
  useLiveChatQuickReplies,
  useLiveChatKPIs
} from '@/hooks/presence/useLiveChat';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type LiveChatMessage,
  type ConversationStatus
} from '@/types/live-chat';

// ==================== KPI Cards ====================
function KPICards() {
  const { data: kpis } = useLiveChatKPIs();

  const cards = [
    {
      title: 'En attente',
      value: kpis?.waiting_conversations || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'En cours',
      value: kpis?.active_conversations || 0,
      icon: MessageCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Résolus (24h)',
      value: kpis?.resolved_today || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Agents en ligne',
      value: kpis?.agents_online || 0,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Temps réponse moy.',
      value: `${kpis?.avg_response_time_minutes || 0} min`,
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Satisfaction',
      value: kpis?.satisfaction_avg ? `${kpis.satisfaction_avg}/5` : 'N/A',
      icon: Star,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title} className={card.bgColor}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </div>
              <card.icon className={`h-8 w-8 ${card.color} opacity-20`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== Agent Status Toggle ====================
function AgentStatusToggle() {
  const { data: agents } = useLiveChatAgents();
  const { data: currentProfile } = useCurrentProfile();
  const toggleAvailability = useToggleAgentAvailability();

  const currentAgent = agents?.find(a => a.profile_id === currentProfile?.id);
  const isAvailable = currentAgent?.is_available || false;

  return (
    <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
      <Switch
        id="agent-status"
        checked={isAvailable}
        onCheckedChange={(checked) => toggleAvailability.mutate(checked)}
        disabled={toggleAvailability.isPending}
      />
      <Label htmlFor="agent-status" className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
        {isAvailable ? 'Disponible' : 'Hors ligne'}
      </Label>
    </div>
  );
}

// ==================== Conversation List ====================
function ConversationList({
  selectedId,
  onSelect,
  statusFilter,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  statusFilter?: ConversationStatus;
}) {
  const { data: conversations, isLoading } = useLiveChatConversations({ status: statusFilter });

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Chargement...</div>;
  }

  if (!conversations?.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
        <p>Aucune conversation</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-400px)]">
      <div className="space-y-1 p-2">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              selectedId === conv.id
                ? 'bg-primary/10 border-l-2 border-primary'
                : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {conv.visitor_name?.charAt(0) || 'V'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {conv.visitor_name || 'Visiteur anonyme'}
                  </p>
                  {conv.etablissement && (
                    <p className="text-xs text-muted-foreground">
                      {(conv.etablissement as { nom: string }).nom}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className={STATUS_COLORS[conv.status]}>
                {STATUS_LABELS[conv.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: fr })}
            </p>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

// ==================== Message Bubble ====================
function MessageBubble({ message, isCurrentUser }: { message: LiveChatMessage; isCurrentUser: boolean }) {
  const isVisitor = message.sender_type === 'visitor';
  const isBot = message.sender_type === 'bot';
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isVisitor ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className={`flex items-end gap-2 max-w-[70%] ${isVisitor ? '' : 'flex-row-reverse'}`}>
        <Avatar className="h-6 w-6">
          <AvatarFallback className={isBot ? 'bg-purple-100' : isVisitor ? 'bg-blue-100' : 'bg-green-100'}>
            {isBot ? <Bot className="h-3 w-3" /> : isVisitor ? <User className="h-3 w-3" /> : 
              (message.sender as { prenom?: string })?.prenom?.charAt(0) || 'A'}
          </AvatarFallback>
        </Avatar>
        <div>
          <div
            className={`px-4 py-2 rounded-2xl ${
              isVisitor
                ? 'bg-muted text-foreground rounded-bl-md'
                : isBot
                ? 'bg-purple-100 text-purple-900 rounded-br-md'
                : 'bg-primary text-primary-foreground rounded-br-md'
            } ${message.is_internal ? 'border-2 border-dashed border-yellow-500' : ''}`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className={`text-[10px] text-muted-foreground mt-1 ${isVisitor ? '' : 'text-right'}`}>
            {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
            {message.is_internal && <span className="ml-1">(note interne)</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ==================== Chat Panel ====================
function ChatPanel({ conversationId }: { conversationId: string | null }) {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: conversation } = useLiveChatConversation(conversationId);
  const { data: messages } = useLiveChatMessages(conversationId);
  const { data: quickReplies } = useLiveChatQuickReplies();
  const { data: currentProfile } = useCurrentProfile();
  const sendMessage = useSendMessage();
  const assignConversation = useAssignConversation();
  const resolveConversation = useResolveConversation();
  const escalateConversation = useEscalateConversation();
  const createTicket = useCreateTicketFromChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !conversationId) return;

    sendMessage.mutate({
      conversationId,
      content: message,
      isInternal,
    });
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTakeConversation = () => {
    if (!conversationId || !currentProfile?.id) return;
    assignConversation.mutate({ conversationId, agentId: currentProfile.id });
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p>Sélectionnez une conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{conversation?.visitor_name?.charAt(0) || 'V'}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{conversation?.visitor_name || 'Visiteur anonyme'}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {conversation?.visitor_email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {conversation.visitor_email}
                </span>
              )}
              {conversation?.etablissement && (
                <span className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {(conversation.etablissement as { nom: string }).nom}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[conversation?.status || 'waiting']}>
            {STATUS_LABELS[conversation?.status || 'waiting']}
          </Badge>
          
          {conversation?.status === 'waiting' && (
            <Button size="sm" onClick={handleTakeConversation}>
              <UserPlus className="h-4 w-4 mr-1" />
              Prendre en charge
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Plus d'options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => resolveConversation.mutate(conversationId)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Marquer comme résolu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => escalateConversation.mutate({ conversationId, reason: 'Escalade manuelle' })}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Escalader
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createTicket.mutate({ conversationId, subject: 'Ticket depuis chat', description: 'Créé depuis la conversation chat' })}>
                <Ticket className="h-4 w-4 mr-2" />
                Créer un ticket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages?.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isCurrentUser={msg.sender_id === currentProfile?.id}
          />
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Quick Replies */}
      {quickReplies && quickReplies.length > 0 && (
        <div className="px-4 py-2 border-t">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {quickReplies.slice(0, 5).map((qr) => (
              <Button
                key={qr.id}
                variant="outline"
                size="sm"
                onClick={() => setMessage(qr.content)}
                className="whitespace-nowrap"
              >
                <Zap className="h-3 w-3 mr-1" />
                {qr.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2 mb-2">
          <Switch
            id="internal-note"
            checked={isInternal}
            onCheckedChange={setIsInternal}
          />
          <Label htmlFor="internal-note" className="text-xs">
            Note interne (invisible pour le visiteur)
          </Label>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isInternal ? 'Écrire une note interne...' : 'Écrire un message...'}
            className={`flex-1 min-h-[44px] max-h-32 ${isInternal ? 'border-yellow-500' : ''}`}
            rows={1}
          />
          <Button onClick={handleSend} disabled={!message.trim() || sendMessage.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== Main Component ====================
export default function LiveChat() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | undefined>(undefined);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chat en Direct</h1>
          <p className="text-muted-foreground">Support client en temps réel</p>
        </div>
        <div className="flex items-center gap-4">
          <AgentStatusToggle />
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Paramètres
          </Button>
        </div>
      </div>

      <KPICards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start px-4">
                <TabsTrigger value="all" onClick={() => setStatusFilter(undefined)}>
                  Toutes
                </TabsTrigger>
                <TabsTrigger value="waiting" onClick={() => setStatusFilter('waiting')}>
                  En attente
                </TabsTrigger>
                <TabsTrigger value="active" onClick={() => setStatusFilter('active')}>
                  En cours
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Separator />
            <ConversationList
              selectedId={selectedConversation}
              onSelect={setSelectedConversation}
              statusFilter={statusFilter}
            />
          </CardContent>
        </Card>

        {/* Chat Panel */}
        <Card className="lg:col-span-2 flex flex-col min-h-[600px]">
          <ChatPanel conversationId={selectedConversation} />
        </Card>
      </div>
    </div>
  );
}
