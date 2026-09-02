import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { Mail, Calendar, User, Sparkles, TrendingUp, Globe, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { EmailThread } from "@/components/email/EmailThread";
import { EmailDomainManager } from "@/components/email/EmailDomainManager";
import { EmailTimeline } from "@/components/email/EmailTimeline";
import { fixMalformedEncoding, sanitizeEmailSubject } from "@/lib/emailUtils";

interface EtablissementEmailsProps {
  etablissementId: string;
  etablissementNom: string;
}

export function EtablissementEmails({ etablissementId, etablissementNom }: EtablissementEmailsProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['etablissement-email-threads', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('*, user_email_accounts!inner(email_address)')
        .eq('etablissement_id', etablissementId)
        .order('last_message_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const { data: etablissement } = useQuery({
    queryKey: ['etablissement-summary', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('derniers_echanges_resume, derniers_echanges_updated_at, engagement_score')
        .eq('id', etablissementId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch domain stats
  const { data: domainStats } = useQuery({
    queryKey: ['etablissement-domain-stats', etablissementId],
    queryFn: async () => {
      const { data: domains, error: domainsError } = await supabase
        .from('email_domain_mappings')
        .select('id')
        .eq('etablissement_id', etablissementId);

      if (domainsError) throw domainsError;

      const autoClassifiedCount = threads.filter(t => t.etablissement_id === etablissementId).length;

      return {
        activeDomains: domains?.length || 0,
        autoClassifiedCount,
      };
    },
    enabled: threads.length > 0,
  });

  if (selectedThreadId) {
    return (
      <EmailThread
        threadId={selectedThreadId}
        onBack={() => setSelectedThreadId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Classification Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques de classification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Mail className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">{domainStats?.autoClassifiedCount || 0}</p>
              <p className="text-sm text-muted-foreground">Threads auto-classés</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <Globe className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">{domainStats?.activeDomains || 0}</p>
              <p className="text-sm text-muted-foreground">Domaines actifs</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-amber-600" />
              <p className="text-2xl font-bold">{etablissement?.engagement_score || 0}</p>
              <p className="text-sm text-muted-foreground">Score d'engagement</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">
            <Mail className="mr-2 h-4 w-4" />
            Liste des échanges
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="mr-2 h-4 w-4" />
            Timeline interactive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6 mt-6">
          {/* AI Summary */}
          {etablissement?.derniers_echanges_resume && (
        <Card className="border-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Résumé IA des derniers échanges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{fixMalformedEncoding(etablissement.derniers_echanges_resume)}</p>
            {etablissement.derniers_echanges_updated_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Mis à jour {formatDistanceToNow(new Date(etablissement.derniers_echanges_updated_at), {
                  addSuffix: true,
                  locale: fr
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

          {/* Email Threads List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Historique des échanges ({threads.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : threads.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun échange enregistré</p>
              ) : (
                <div className="space-y-3">
                  {threads.map((thread) => (
                    <Card key={thread.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <CardContent className="p-4" onClick={() => setSelectedThreadId(thread.id)}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <h4 className="font-semibold text-sm">{sanitizeEmailSubject(thread.subject)}</h4>
                              {thread.unread_count > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {thread.unread_count} non lu{thread.unread_count > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {thread.user_email_accounts?.email_address}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(new Date(thread.last_message_date), {
                                  addSuffix: true,
                                  locale: fr
                                })}
                              </span>
                              <span>{thread.message_count} message{thread.message_count > 1 ? 's' : ''}</span>
                            </div>
                            {thread.ai_summary && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {sanitizeEmailSubject(thread.ai_summary)}
                              </p>
                            )}
                          </div>
                          <Button variant="ghost" size="sm">
                            Ouvrir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <EmailTimeline
            etablissementId={etablissementId}
            etablissementNom={etablissementNom}
            onThreadSelect={setSelectedThreadId}
          />
        </TabsContent>
      </Tabs>

      {/* Domain Management - En bas de page */}
      <div className="mt-6">
        <EmailDomainManager etablissementId={etablissementId} />
      </div>
    </div>
  );
}
