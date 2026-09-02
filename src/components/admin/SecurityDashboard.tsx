import { useState } from 'react';
import { debug } from '@/lib/debug';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

interface SecurityMetrics {
  adminsWithout2FA: number;
  totalAdmins: number;
  recentFailedLogins: number;
  securityScore: number;
  lastAuditDate: string | null;
}

interface TwoFactorAuditEntry {
  id: string;
  event_type: string;
  ip_address: string | null;
  created_at: string;
  profile_id: string;
}

export function SecurityDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch security metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['security-metrics'],
    queryFn: async (): Promise<SecurityMetrics> => {
      // Get admins without 2FA
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, two_factor_enabled');

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
      const admins = profiles?.filter(p => adminUserIds.has(p.user_id)) || [];
      const adminsWithout2FA = admins.filter(a => !a.two_factor_enabled).length;

      // Get recent failed logins from security_logs
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count: failedLogins } = await supabase
        .from('security_logs')
        .select('id', { count: 'exact', head: true })
        .eq('log_type', 'login_failed')
        .gte('created_at', thirtyMinutesAgo);

      // Calculate security score
      let score = 100;
      if (adminsWithout2FA > 0) score -= 30;
      if ((failedLogins || 0) > 5) score -= 20;
      if ((failedLogins || 0) > 10) score -= 20;

      return {
        adminsWithout2FA,
        totalAdmins: admins.length,
        recentFailedLogins: failedLogins || 0,
        securityScore: Math.max(0, score),
        lastAuditDate: new Date().toISOString(),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch 2FA audit log
  const { data: twoFactorAudit, isLoading: auditLoading } = useQuery({
    queryKey: ['2fa-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('two_factor_audit')
        .select('id, user_id, profile_id, event_type, ip_address, user_agent, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        debug.error('Error fetching 2FA audit:', error);
        return [];
      }
      return data as TwoFactorAuditEntry[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recent security logs
  const { data: securityLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['security-logs-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_logs')
        .select('id, event_type, user_id, ip_address, details, severity, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        debug.error('Error fetching security logs:', error);
        return [];
      }
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchMetrics();
    setIsRefreshing(false);
    toast.success('Données de sécurité actualisées');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Bon';
    if (score >= 60) return 'Moyen';
    if (score >= 40) return 'Faible';
    return 'Critique';
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      enabled: '2FA Activé',
      disabled: '2FA Désactivé',
      verified: 'Vérification réussie',
      failed: 'Vérification échouée',
      backup_used: 'Code backup utilisé',
    };
    return labels[type] || type;
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      enabled: 'bg-green-100 text-green-800',
      disabled: 'bg-red-100 text-red-800',
      verified: 'bg-blue-100 text-blue-800',
      failed: 'bg-orange-100 text-orange-800',
      backup_used: 'bg-yellow-100 text-yellow-800',
    };
    return colors[type] || 'bg-gray-100 text-foreground';
  };

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Dashboard Sécurité
          </h2>
          <p className="text-muted-foreground">
            Surveillance et audit de la sécurité du système
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Security Score Card */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Score de Sécurité Global</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className={`text-5xl font-bold ${getScoreColor(metrics?.securityScore || 0)}`}>
              {metrics?.securityScore || 0}%
            </div>
            <div className="flex-1">
              <Progress 
                value={metrics?.securityScore || 0} 
                className="h-4"
              />
              <p className="text-sm text-muted-foreground mt-1">
                État : <span className={`font-medium ${getScoreColor(metrics?.securityScore || 0)}`}>
                  {getScoreLabel(metrics?.securityScore || 0)}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              2FA Administrateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {(metrics?.totalAdmins || 0) - (metrics?.adminsWithout2FA || 0)}/{metrics?.totalAdmins || 0}
              </div>
              {metrics?.adminsWithout2FA === 0 ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  OK
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  {metrics?.adminsWithout2FA} sans 2FA
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Échecs de connexion (30min)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {metrics?.recentFailedLogins || 0}
              </div>
              {(metrics?.recentFailedLogins || 0) <= 5 ? (
                <Badge className="bg-green-100 text-green-800">Normal</Badge>
              ) : (metrics?.recentFailedLogins || 0) <= 10 ? (
                <Badge className="bg-yellow-100 text-yellow-800">Attention</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Alerte</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Dernier Audit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.lastAuditDate 
                ? new Date(metrics.lastAuditDate).toLocaleDateString('fr-FR')
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Mise à jour automatique
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="2fa-audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="2fa-audit">Audit 2FA</TabsTrigger>
          <TabsTrigger value="security-logs">Logs Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="2fa-audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historique 2FA</CardTitle>
              <CardDescription>
                Derniers événements d'authentification à deux facteurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex justify-center p-4">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : twoFactorAudit && twoFactorAudit.length > 0 ? (
                <div className="space-y-2">
                  {twoFactorAudit.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={getEventTypeColor(entry.event_type)}>
                          {getEventTypeLabel(entry.event_type)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {entry.ip_address || 'IP inconnue'}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun événement 2FA enregistré
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security-logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logs de Sécurité Récents</CardTitle>
              <CardDescription>
                50 derniers événements de sécurité
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center p-4">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : securityLogs && securityLogs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {securityLogs.map((log: any) => (
                    <div 
                      key={log.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {log.risk_level === 'high' ? (
                          <ShieldAlert className="h-4 w-4 text-red-500" />
                        ) : log.risk_level === 'medium' ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Shield className="h-4 w-4 text-green-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{log.log_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.description?.substring(0, 80) || 'Pas de description'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun log de sécurité récent
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Recommendations */}
      {metrics && (metrics.adminsWithout2FA > 0 || metrics.recentFailedLogins > 5) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Actions Recommandées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.adminsWithout2FA > 0 && (
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <p className="text-sm">
                  <strong>{metrics.adminsWithout2FA} administrateur(s)</strong> n'ont pas activé l'authentification à deux facteurs. 
                  Contactez-les pour activer 2FA.
                </p>
              </div>
            )}
            {metrics.recentFailedLogins > 5 && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <p className="text-sm">
                  Nombre élevé d'échecs de connexion détectés ({metrics.recentFailedLogins} en 30 min). 
                  Vérifiez les IPs suspectes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SecurityDashboard;
