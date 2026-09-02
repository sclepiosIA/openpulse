import React, { useState, useEffect, useRef, useMemo } from 'react'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MessageCircle, X, Send, Minimize2, Bot, User } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'
import { createLiveChatVisitorClient } from '@/lib/liveChatClient'

interface WidgetMessage {
  id: string
  content: string
  sender_type: 'visitor' | 'agent' | 'bot' | 'system'
  created_at: string
}

interface LiveChatWidgetProps {
  etablissementId?: string
  position?: 'bottom-right' | 'bottom-left'
  primaryColor?: string
  welcomeMessage?: string
}

export function LiveChatWidget({
  etablissementId,
  position = 'bottom-right',
  primaryColor = '#3B82F6',
  welcomeMessage = 'Bonjour ! Comment puis-je vous aider ?',
}: LiveChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [visitorId] = useState(() => localStorage.getItem('chat_visitor_id') || crypto.randomUUID())
  const [visitorName, setVisitorName] = useState('')
  const [visitorEmail, setVisitorEmail] = useState('')
  const [isStarted, setIsStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const visitorClient = useMemo(
    () => (sessionToken ? createLiveChatVisitorClient(sessionToken) : null),
    [sessionToken]
  )

  // Save visitor ID
  useEffect(() => {
    localStorage.setItem('chat_visitor_id', visitorId)
  }, [visitorId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscribe to messages with Supabase Realtime
  useEffect(() => {
    if (!conversationId) return

    // Initial fetch
    const fetchMessages = async () => {
      if (!visitorClient) return
      const { data, error } = await visitorClient
        .from('live_chat_messages')
        .select('id, content, sender_type, created_at')
        .eq('session_id', conversationId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setMessages(data as WidgetMessage[])
      }
    }

    fetchMessages()

    // Subscribe to new messages via Realtime
    const channel = supabase
      .channel(`chat-widget-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat_messages',
          filter: `session_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as WidgetMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, visitorClient])

  const startConversation = async () => {
    if (!visitorName.trim()) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-live-chat-session', {
        body: {
          guest_name: visitorName,
          guest_email: visitorEmail || null,
          etablissement_id: etablissementId || null,
          source: 'widget',
        },
      })

      if (error || !data?.session_id || !data?.session_token) {
        throw error || new Error('No session')
      }

      setConversationId(data.session_id)
      setSessionToken(data.session_token)
      setIsStarted(true)
    } catch (error) {
      debug.error('Error starting conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || !conversationId || !visitorClient) return

    const content = inputValue
    setInputValue('')

    try {
      await visitorClient.from('live_chat_messages').insert({
        session_id: conversationId,
        content,
        sender_type: 'visitor',
      })
    } catch (error) {
      debug.error('Error sending message:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStarted) {
        sendMessage()
      } else {
        startConversation()
      }
    }
  }

  const positionClasses = position === 'bottom-right' ? 'right-4 bottom-4' : 'left-4 bottom-4'

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${positionClasses} z-50 p-4 rounded-full shadow-lg transition-transform hover:scale-110`}
        style={{ backgroundColor: primaryColor }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>
    )
  }

  return (
    <div
      className={`fixed ${positionClasses} z-50 w-[360px] rounded-lg shadow-2xl bg-background border overflow-hidden transition-all ${
        isMinimized ? 'h-14' : 'h-[500px]'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-semibold">Support en ligne</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-card/20 rounded"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-card/20 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {!isStarted ? (
            // Start Form
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Veuillez vous identifier pour démarrer la conversation.
              </p>
              <Input
                placeholder="Votre nom *"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Input
                placeholder="Votre email (optionnel)"
                type="email"
                value={visitorEmail}
                onChange={(e) => setVisitorEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                className="w-full"
                onClick={startConversation}
                disabled={!visitorName.trim() || isLoading}
                style={{ backgroundColor: primaryColor }}
              >
                {isLoading ? 'Connexion...' : 'Démarrer la conversation'}
              </Button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <ScrollArea className="h-[360px] p-4">
                {messages.map((msg) => {
                  const isVisitor = msg.sender_type === 'visitor'
                  const isBot = msg.sender_type === 'bot'

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isVisitor ? 'justify-end' : 'justify-start'} mb-3`}
                    >
                      <div
                        className={`flex items-end gap-2 max-w-[80%] ${isVisitor ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback
                            className={
                              isBot ? 'bg-purple-100' : isVisitor ? 'bg-blue-100' : 'bg-green-100'
                            }
                          >
                            {isBot ? (
                              <Bot className="h-3 w-3" />
                            ) : isVisitor ? (
                              <User className="h-3 w-3" />
                            ) : (
                              'A'
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm ${
                              isVisitor
                                ? 'rounded-br-md text-white'
                                : isBot
                                  ? 'bg-purple-100 text-purple-900 rounded-bl-md'
                                  : 'bg-muted rounded-bl-md'
                            }`}
                            style={isVisitor ? { backgroundColor: primaryColor } : undefined}
                          >
                            {msg.content}
                          </div>
                          <p
                            className={`text-[10px] text-muted-foreground mt-1 ${isVisitor ? 'text-right' : ''}`}
                          >
                            {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrire un message..."
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputValue.trim()}
                  size="icon"
                  style={{ backgroundColor: primaryColor }}
                  aria-label="Envoyer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default LiveChatWidget
