import { useState, useEffect, useRef, useMemo } from 'react'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { createLiveChatVisitorClient } from '@/lib/liveChatClient'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  content: string
  sender: 'user' | 'agent' | 'bot'
  timestamp: Date
  senderName?: string
}

interface ChatWidgetProps {
  etablissementId?: string
  guestName?: string
  guestEmail?: string
  position?: 'bottom-right' | 'bottom-left'
  primaryColor?: string
  welcomeMessage?: string
}

export function ChatWidget({
  etablissementId,
  guestName = '',
  guestEmail = '',
  position = 'bottom-right',
  primaryColor = 'hsl(var(--primary))',
  welcomeMessage = 'Bonjour ! Comment pouvons-nous vous aider ?',
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [name, setName] = useState(guestName)
  const [email, setEmail] = useState(guestEmail)
  const [isStarted, setIsStarted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const visitorClient = useMemo(
    () => (sessionToken ? createLiveChatVisitorClient(sessionToken) : null),
    [sessionToken]
  )

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          content: welcomeMessage,
          sender: 'bot',
          timestamp: new Date(),
          senderName: 'Assistant',
        },
      ])
    }
  }, [isOpen, welcomeMessage, messages.length])

  // Subscribe to realtime messages
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newMessage = payload.new as any
          if (newMessage.sender_type !== 'guest') {
            setMessages((prev) => [
              ...prev,
              {
                id: newMessage.id,
                content: newMessage.content,
                sender: newMessage.sender_type === 'agent' ? 'agent' : 'bot',
                timestamp: new Date(newMessage.created_at),
                senderName: newMessage.sender_name,
              },
            ])
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const startSession = async () => {
    if (!name.trim() || !email.trim()) return

    try {
      const { data, error } = await supabase.functions.invoke('create-live-chat-session', {
        body: {
          guest_name: name,
          guest_email: email,
          etablissement_id: etablissementId,
          source: 'widget',
        },
      })

      if (error || !data?.session_id || !data?.session_token) throw error || new Error('No session')

      setSessionId(data.session_id)
      setSessionToken(data.session_token)
      setIsStarted(true)
    } catch (error) {
      debug.error('Error starting chat session:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || !sessionId || !visitorClient) return

    const newMessage: Message = {
      id: crypto.randomUUID(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      senderName: name,
    }

    setMessages((prev) => [...prev, newMessage])
    setInputValue('')

    try {
      await visitorClient.from('live_chat_messages' as any).insert({
        session_id: sessionId,
        content: inputValue,
        sender_type: 'visitor',
        sender_name: name,
      })
    } catch (error) {
      debug.error('Error sending message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStarted) {
        sendMessage()
      } else {
        startSession()
      }
    }
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed z-50 rounded-full w-14 h-14 shadow-lg',
          position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'
        )}
        style={{ backgroundColor: primaryColor }}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  if (isMinimized) {
    return (
      <div
        className={cn(
          'fixed z-50 bg-card border rounded-lg shadow-lg p-3 cursor-pointer',
          position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'
        )}
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Chat en cours</span>
          {messages.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
              {messages.length}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed z-50 w-80 sm:w-96 h-[500px] bg-card border rounded-lg shadow-xl flex flex-col overflow-hidden',
        position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'
      )}
    >
      {/* Header */}
      <div
        className="p-4 text-primary-foreground flex items-center justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">Support en direct</span>
          {isConnected && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground hover:bg-card/20"
            onClick={() => setIsMinimized(true)}
            aria-label="Réduire"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground hover:bg-card/20"
            onClick={() => setIsOpen(false)}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isStarted ? (
        <div className="flex-1 p-4 flex flex-col justify-center gap-4">
          <p className="text-center text-muted-foreground text-sm">
            Entrez vos informations pour démarrer la conversation
          </p>
          <Input placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Votre email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button
            onClick={startSession}
            disabled={!name.trim() || !email.trim()}
            style={{ backgroundColor: primaryColor }}
          >
            Démarrer le chat
          </Button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex flex-col gap-1',
                    message.sender === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {message.senderName || (message.sender === 'user' ? 'Vous' : 'Support')}
                  </span>
                  <div
                    className={cn(
                      'max-w-[80%] p-3 rounded-lg text-sm',
                      message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                    style={
                      message.sender === 'user' ? { backgroundColor: primaryColor } : undefined
                    }
                  >
                    {message.content}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Tapez votre message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
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
          </div>
        </>
      )}
    </div>
  )
}

export default ChatWidget
