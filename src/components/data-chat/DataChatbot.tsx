import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Database, Copy, Check, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';
import { supabase } from '@/integrations/supabase/client';

interface EtablissementSuggestion {
  nom: string;
  ville?: string;
  region?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>[];
  sql?: string;
  error?: string;
  rowCount?: number;
  suggestions?: EtablissementSuggestion[];
  usedFallback?: boolean;
}

export function DataChatbot() {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Bonjour ! Je peux vous aider à interroger toutes les données de votre CRM. Posez-moi n\'importe quelle question sur vos établissements, contacts, tâches, emails, etc.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
  const [showSql, setShowSql] = useState<{ [key: number]: boolean }>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ne pas afficher le chatbot si l'utilisateur n'est pas connecté
  if (!session) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      // Token presence logged in debug mode only (stripped in production by Vite)
      const { data, error } = await supabase.functions.invoke('chat-data-query', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: {
          question: input,
          conversationHistory: messages.slice(-6) // Derniers 6 messages pour contexte
        }
      });

      if (error) {
        // Gestion spécifique des erreurs 401
        if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('token')) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '🔒 Votre session a expiré ou est invalide. Veuillez vous reconnecter.',
            error: 'Session expirée'
          }]);
          toast.error('Session expirée, veuillez vous reconnecter');
          return;
        }
        throw error;
      }

      if (data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Désolé, une erreur est survenue : ${data.error}`,
          error: data.error,
          sql: data.sql
        }]);
        toast.error(data.error);
        return;
      }

      const responseMessage: Message = {
        role: 'assistant',
        content: data.analysis || (data.rowCount === 0 
          ? 'Aucun résultat trouvé pour cette requête.'
          : `J'ai trouvé ${data.rowCount} résultat(s) :`),
        data: data.data,
        sql: data.sql,
        rowCount: data.rowCount,
        suggestions: data.suggestions,
        usedFallback: data.flags?.usedFallback
      };

      setMessages(prev => [...prev, responseMessage]);
      toast.success(`${data.rowCount} résultat(s) trouvé(s)`);

    } catch (error) {
      debug.error('Error querying data:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        error: error instanceof Error ? error.message : 'Unknown error'
      }]);
      toast.error('Erreur lors de l\'interrogation des données');
    } finally {
      setIsLoading(false);
    }
  };

  const copySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(sql);
    toast.success('SQL copié !');
    setTimeout(() => setCopiedSql(null), 2000);
  };

  const renderData = (data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) return null;

    const keys = Object.keys(data[0]);
    
    return (
      <div className="mt-3 rounded-md border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {keys.map(key => (
                  <th key={key} className="px-3 py-2 text-left font-medium text-foreground">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.slice(0, 10).map((row, idx) => (
                <tr key={`row-${idx}-${String(row[keys[0]] ?? idx)}`} className="hover:bg-muted/50">
                  {keys.map(key => (
                    <td key={key} className="px-3 py-2 text-muted-foreground">
                      {row[key] !== null && row[key] !== undefined 
                        ? String(row[key]).substring(0, 100)
                        : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 10 && (
          <div className="px-3 py-2 bg-muted text-xs text-muted-foreground text-center">
            {data.length - 10} ligne(s) supplémentaire(s) non affichée(s)
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Bouton flottant */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-50"
          size="icon"
          aria-label="Ouvrir l'assistant données"
          title="Ouvrir l'assistant données"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      )}

      {/* Widget chatbot */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-[400px] h-[600px] flex flex-col shadow-2xl z-50">
          <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Assistant Données</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8" aria-label="Fermer">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, idx) => (
                <div
                  key={`msg-${idx}-${message.role}-${message.content.slice(0, 24)}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    
                    {message.error && (
                      <div className="mt-2 p-3 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20">
                        <p className="font-semibold mb-1">Erreur:</p>
                        <p className="text-xs">{message.error}</p>
                      </div>
                    )}

                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Suggestions d'établissements:</p>
                         <div className="flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion) => (
                            <Button
                              key={`suggestion-${suggestion.nom}-${suggestion.ville ?? ''}`}
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const query = `Montre l'état de l'établissement "${suggestion.nom}"${suggestion.ville ? ` à ${suggestion.ville}` : ''}${suggestion.region ? ` (${suggestion.region})` : ''}`;
                                setInput(query);
                                setTimeout(() => {
                                  const form = document.querySelector('form');
                                  if (form) {
                                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                                  }
                                }, 100);
                              }}
                              className="text-xs"
                            >
                              {suggestion.nom}
                              {suggestion.ville && ` • ${suggestion.ville}`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.sql && (
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSql(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          className="h-7 px-2 text-xs"
                        >
                          {showSql[idx] ? 'Masquer le SQL' : 'Afficher le SQL'}
                        </Button>
                        {showSql[idx] && (
                          <div className="mt-2 rounded border border-border bg-background/50 p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono text-muted-foreground">SQL</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => copySql(message.sql!)}
                              >
                                {copiedSql === message.sql ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                            <pre className="text-xs font-mono overflow-x-auto text-foreground">
                              {message.sql}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {message.data && renderData(message.data)}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-lg p-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                </div>
              )}
              
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Quels établissements ont un score < 60 ?"
                className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !input.trim()} size="sm">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              💡 Exemples : "Liste des tâches urgentes" • "Établissements par région"
            </p>
          </form>
        </Card>
      )}
    </>
  );
}
