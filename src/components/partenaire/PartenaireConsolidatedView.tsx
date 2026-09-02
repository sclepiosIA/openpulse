import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Partenaire } from "@/hooks/crm/usePartenaires";
import { useContactsGroupe } from "@/hooks/crm/useContactsGroupe";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Mail, Users, Activity, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface PartenaireConsolidatedViewProps {
  partenaire: Partenaire;
}

export function PartenaireConsolidatedView({ partenaire }: PartenaireConsolidatedViewProps) {
  const { data: contacts = [] } = useContactsGroupe(partenaire.id);
  
  // Récupérer les messages emails directement avec validation des dates
  const { data: emailMessages = [] } = useQuery({
    queryKey: ['partenaire-email-messages', partenaire.id],
    queryFn: async () => {
      const { data: threads } = await supabase
        .from('email_threads')
        .select('id')
        .eq('partenaire_id', partenaire.id);
      
      if (!threads?.length) return [];
      
      const { data, error } = await supabase
        .from('email_messages')
        .select('id, subject, received_date, from_address, thread_id')
        .in('thread_id', threads.map(t => t.id))
        .order('received_date', { ascending: false });
      
      if (error) throw error;
      return (data || []).filter(msg => msg.received_date); // Filtrer les dates nulles
    }
  });

  // KPIs
  const totalContacts = contacts.length;
  const totalEmails = emailMessages.length;
  
  // Interactions ce mois
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const emailsThisMonth = emailMessages.filter((e: any) => {
    const date = new Date(e.received_date);
    return !isNaN(date.getTime()) && date >= startOfMonth;
  }).length;

  // Évolution du score d'engagement (simulé pour l'exemple)
  const engagementData = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      name: month.toLocaleDateString('fr-FR', { month: 'short' }),
      score: Math.max(0, (partenaire.engagement_score || 0) + Math.random() * 20 - 10),
    };
  });

  // Timeline des 10 dernières interactions
  const recentEmails = emailMessages
    .filter((e: any) => e.received_date && !isNaN(new Date(e.received_date).getTime()))
    .sort((a: any, b: any) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())
    .slice(0, 10);

  // Répartition des emails par mois (6 derniers mois)
  const emailsByMonth = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0);
    const count = emailMessages.filter((e: any) => {
      if (!e.received_date) return false;
      const date = new Date(e.received_date);
      return !isNaN(date.getTime()) && date >= month && date <= monthEnd;
    }).length;

    return {
      name: month.toLocaleDateString('fr-FR', { month: 'short' }),
      emails: count,
    };
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <CardDescription>Contacts totaux</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl">{totalContacts}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Contacts enregistrés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Mail className="h-5 w-5 text-green-600" />
            </div>
            <CardDescription>Emails totaux</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl">{totalEmails}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Emails échangés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <CardDescription>Interactions ce mois</CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl">{emailsThisMonth}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Emails ce mois
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Évolution engagement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Évolution du score d'engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Score (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Répartition emails */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails par mois (6 derniers mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emailsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="emails" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Timeline interactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline des interactions récentes</CardTitle>
          <CardDescription>10 derniers emails</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEmails.length > 0 ? (
            <div className="space-y-3">
              {recentEmails.map((email: any) => (
                <div key={email.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{email.subject}</p>
                    <p className="text-sm text-muted-foreground truncate">{email.from_address}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {formatDistanceToNow(new Date(email.received_date), { addSuffix: true, locale: fr })}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune interaction récente
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prochaines actions */}
      {partenaire.prochaine_action && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaines actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Activity className="h-4 w-4 text-orange-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Action planifiée</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(partenaire.prochaine_action).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Badge variant={new Date(partenaire.prochaine_action) < new Date() ? 'destructive' : 'default'}>
                {new Date(partenaire.prochaine_action) < new Date() ? 'En retard' : 'À venir'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}