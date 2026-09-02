import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RefreshCw, AlertTriangle, CheckCircle, Monitor, Activity, Globe, Smartphone, XCircle } from "lucide-react";

type ConfigState = {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordExpiration: number;
  twoFactorRequired: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  ipWhitelistEnabled: boolean;
  bruteForceProtection: boolean;
  securityHeaders: boolean;
  auditLogging: boolean;
  loginAlerts: boolean;
  suspiciousActivityAlerts: boolean;
  passwordChangeAlerts: boolean;
};

type UpdateConfig = (key: string, value: unknown) => void;

export function PasswordsTabContent({ configState, updateConfig }: { configState: ConfigState; updateConfig: UpdateConfig }) {
  return (
    <>
      <h3 className="text-lg font-medium">Politique des mots de passe</h3>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Longueur minimale</Label>
            <Input type="number" value={configState.passwordMinLength}
              onChange={(e) => updateConfig('passwordMinLength', parseInt(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Expiration (jours)</Label>
            <Input type="number" value={configState.passwordExpiration}
              onChange={(e) => updateConfig('passwordExpiration', parseInt(e.target.value))} />
          </div>
        </div>
        <div className="space-y-4">
          {[
            ['passwordRequireUppercase', 'Majuscules obligatoires'],
            ['passwordRequireLowercase', 'Minuscules obligatoires'],
            ['passwordRequireNumbers', 'Chiffres obligatoires'],
            ['passwordRequireSymbols', 'Symboles obligatoires'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch
                checked={configState[key as keyof ConfigState] as boolean}
                onCheckedChange={(checked) => updateConfig(key, checked)} />
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 bg-muted rounded-lg">
        <h4 className="font-medium mb-2">Aperçu de la politique</h4>
        <p className="text-sm text-muted-foreground">
          Les mots de passe doivent contenir au minimum {configState.passwordMinLength} caractères
          {configState.passwordRequireUppercase && ", des majuscules"}
          {configState.passwordRequireLowercase && ", des minuscules"}
          {configState.passwordRequireNumbers && ", des chiffres"}
          {configState.passwordRequireSymbols && ", des symboles"}
          . Ils expirent après {configState.passwordExpiration} jours.
        </p>
      </div>
    </>
  );
}

export function AuthenticationTabContent({ configState, updateConfig }: { configState: ConfigState; updateConfig: UpdateConfig }) {
  return (
    <>
      <h3 className="text-lg font-medium">Paramètres d'authentification</h3>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Authentification à 2 facteurs</Label>
              <div className="text-sm text-muted-foreground">Obligatoire pour tous les utilisateurs</div>
            </div>
            <Switch checked={configState.twoFactorRequired}
              onCheckedChange={(checked) => updateConfig('twoFactorRequired', checked)} />
          </div>
          <div className="space-y-2">
            <Label>Timeout de session (secondes)</Label>
            <Input type="number" value={configState.sessionTimeout}
              onChange={(e) => updateConfig('sessionTimeout', parseInt(e.target.value))} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tentatives de connexion max</Label>
            <Input type="number" value={configState.maxLoginAttempts}
              onChange={(e) => updateConfig('maxLoginAttempts', parseInt(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Durée de blocage (minutes)</Label>
            <Input type="number" value={configState.lockoutDuration}
              onChange={(e) => updateConfig('lockoutDuration', parseInt(e.target.value))} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div className="space-y-0.5">
          <Label>Liste blanche d'adresses IP</Label>
          <div className="text-sm text-muted-foreground">Restreindre l'accès à certaines adresses IP</div>
        </div>
        <Switch checked={configState.ipWhitelistEnabled}
          onCheckedChange={(checked) => updateConfig('ipWhitelistEnabled', checked)} />
      </div>
      {configState.ipWhitelistEnabled && (
        <Card>
          <CardHeader><CardTitle className="text-base">Adresses IP autorisées</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Input placeholder="192.168.1.0/24" />
              <Button size="sm">Ajouter</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

type UserSession = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  deviceType?: string;
  ipAddress: string;
  location: string;
  sessionStart: string;
  lastActivity: string;
};

export function SessionsTabContent({
  sessionsLoading, userSessions, onTerminate,
}: {
  sessionsLoading: boolean;
  userSessions: UserSession[] | undefined;
  onTerminate: (userId: string) => void;
}) {
  if (sessionsLoading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin opacity-50" />
        <p>Chargement des sessions...</p>
      </div>
    );
  }
  if (!userSessions || userSessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Monitor className="w-8 h-8 mx-auto mb-4 opacity-50" />
        <p>Aucune session active</p>
        <p className="text-sm">Les sessions apparaîtront ici lors des connexions utilisateurs authentifiés</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sessions utilisateurs actives</h3>
        <Badge variant="secondary">{userSessions.length} session{userSessions.length > 1 ? 's' : ''}</Badge>
      </div>
      <div className="grid gap-4">
        {userSessions.map((session) => (
          <Card key={session.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {session.deviceType === 'mobile'
                      ? <Smartphone className="w-4 h-4 text-primary" />
                      : <Monitor className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{session.userName}</h4>
                      <Badge variant="outline" className="text-xs">
                        <Globe className="w-3 h-3 mr-1" />
                        {session.deviceType === 'mobile' ? 'Mobile' : 'Desktop'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{session.email}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>IP: {session.ipAddress}</span>
                      <span>📍 {session.location}</span>
                      <span>🕒 Connecté depuis {new Date(session.sessionStart).toLocaleString('fr-FR')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dernière activité: {new Date(session.lastActivity).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <XCircle className="w-4 h-4 mr-1" />
                        Terminer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Terminer la session</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir terminer la session de {session.userName} ? L'utilisateur sera déconnecté immédiatement.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onTerminate(session.userId)}>
                          Terminer la session
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type SecurityLogRow = {
  id: string;
  created_at: string;
  log_type: string;
  risk_level: string;
  profiles?: { prenom?: string | null; nom?: string | null } | null;
  user_email?: string | null;
  ip_address?: string | null;
  location?: string | null;
  user_agent?: string | null;
};

const LOG_TYPE_COLORS: Record<string, string> = {
  login: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  logout: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  failed_login: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  password_change: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  suspicious_activity: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
};
const LOG_TYPE_LABELS: Record<string, string> = {
  login: "Connexion",
  logout: "Déconnexion",
  failed_login: "Échec connexion",
  password_change: "Changement MDP",
  suspicious_activity: "Activité suspecte",
};

function LogTypeBadge({ type, risk }: { type: string; risk: string }) {
  return (
    <div className="flex items-center gap-2">
      <Badge className={LOG_TYPE_COLORS[type]}>{LOG_TYPE_LABELS[type]}</Badge>
      {risk === 'high' && <AlertTriangle className="w-4 h-4 text-red-500" />}
      {risk === 'medium' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
    </div>
  );
}

export function LogsTabContent({
  securityLogs, onBlockIP,
}: {
  securityLogs: SecurityLogRow[] | undefined;
  onBlockIP: (ip: string) => void;
}) {
  if (!securityLogs || securityLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="w-8 h-8 mx-auto mb-4 opacity-50" />
        <p>Aucun log de sécurité</p>
        <p className="text-sm">Les événements de sécurité apparaîtront ici</p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Horodatage</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Utilisateur</TableHead>
          <TableHead>Adresse IP</TableHead>
          <TableHead>Localisation</TableHead>
          <TableHead>Navigateur</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {securityLogs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="font-medium">{new Date(log.created_at).toLocaleString('fr-FR')}</TableCell>
            <TableCell><LogTypeBadge type={log.log_type} risk={log.risk_level} /></TableCell>
            <TableCell>
              {log.profiles ? `${log.profiles.prenom ?? ''} ${log.profiles.nom ?? ''}`.trim() : log.user_email}
            </TableCell>
            <TableCell>{log.ip_address}</TableCell>
            <TableCell>{log.location || 'N/A'}</TableCell>
            <TableCell className="max-w-[200px] truncate">{log.user_agent || 'N/A'}</TableCell>
            <TableCell className="text-right">
              {log.risk_level === 'high' && log.ip_address && (
                <Button variant="ghost" size="sm" onClick={() => onBlockIP(log.ip_address!)} className="text-destructive">
                  Bloquer IP
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export type { ConfigState, UserSession, SecurityLogRow };
