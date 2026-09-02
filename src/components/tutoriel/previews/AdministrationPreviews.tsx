import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Users,
  Settings,
  Key,
  Lock,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ============================================
// LISTE DES UTILISATEURS
// ============================================

const mockUsers = [
  { id: 1, name: 'Marie Dupont', email: 'marie@example.com', role: 'admin', status: 'active', avatar: null, lastLogin: 'Il y a 2h' },
  { id: 2, name: 'Thomas Laurent', email: 'thomas@example.com', role: 'commercial', status: 'active', avatar: null, lastLogin: 'Il y a 1j' },
  { id: 3, name: 'Julie Martin', email: 'julie@example.com', role: 'csm', status: 'active', avatar: null, lastLogin: 'Il y a 3h' },
  { id: 4, name: 'Pierre Vasseur', email: 'pierre@example.com', role: 'chef_projet', status: 'inactive', avatar: null, lastLogin: 'Il y a 30j' },
]

const roleColors = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  commercial: 'bg-blue-100 text-blue-700 border-blue-200',
  csm: 'bg-green-100 text-green-700 border-green-200',
  chef_projet: 'bg-purple-100 text-purple-700 border-purple-200',
  rh: 'bg-orange-100 text-orange-700 border-orange-200',
}

const roleLabels = {
  admin: 'Administrateur',
  commercial: 'Commercial',
  csm: 'CSM',
  chef_projet: 'Chef de projet',
  rh: 'RH',
}

export const AdminUsersListPreview = memo(() => (
  <div className="p-4">
    <div className="flex items-center justify-between mb-4">
      <h4 className="font-semibold flex items-center gap-2">
        <Users className="h-4 w-4" />
        Utilisateurs
      </h4>
      <Button size="sm">+ Nouveau</Button>
    </div>

    <div className="space-y-2">
      {mockUsers.map((user, index) => (
        <motion.div
          key={user.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{user.name}</p>
              {user.status === 'inactive' && (
                <Badge variant="secondary" className="text-xs">Inactif</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>

          <Badge variant="outline" className={roleColors[user.role as keyof typeof roleColors]}>
            {roleLabels[user.role as keyof typeof roleLabels]}
          </Badge>

          <div className="text-xs text-muted-foreground text-right">
            {user.lastLogin}
          </div>

          <Switch checked={user.status === 'active'} />
        </motion.div>
      ))}
    </div>
  </div>
))
AdminUsersListPreview.displayName = 'AdminUsersListPreview'

// ============================================
// PANEL SÉCURITÉ 2FA
// ============================================

export const AdminSecurityPreview = memo(() => (
  <div className="p-4 space-y-4">
    <h4 className="font-semibold flex items-center gap-2">
      <Shield className="h-4 w-4" />
      Sécurité
    </h4>

    {/* 2FA Status */}
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Lock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Authentification 2FA</p>
              <p className="text-xs text-muted-foreground">TOTP via Google Authenticator</p>
            </div>
          </div>
          <Badge className="bg-green-500">Activée</Badge>
        </div>
      </CardContent>
    </Card>

    {/* Logs de connexion */}
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Dernières connexions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {[
          { time: 'Aujourd\'hui 14:32', ip: '192.168.1.45', device: 'Chrome / MacOS', success: true },
          { time: 'Aujourd\'hui 09:15', ip: '192.168.1.45', device: 'Safari / iOS', success: true },
          { time: 'Hier 22:10', ip: '82.120.45.123', device: 'Firefox / Windows', success: false },
        ].map((log, index) => (
          // stable: static array literal above
          <motion.div
            key={`login-${log.time}-${log.ip}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-center justify-between p-2 rounded text-xs ${
              log.success ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2">
              {log.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>{log.time}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">{log.device}</span>
              <Badge variant="outline" className="text-xs">{log.ip}</Badge>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>

    {/* IPs autorisées */}
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Restriction IP
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-2 bg-yellow-50 rounded border border-yellow-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm">Restriction désactivée</span>
          </div>
          <Button size="sm" variant="outline">Configurer</Button>
        </div>
      </CardContent>
    </Card>
  </div>
))
AdminSecurityPreview.displayName = 'AdminSecurityPreview'

// ============================================
// PARAMÈTRES SYSTÈME
// ============================================

const settingsGroups = [
  {
    title: 'Général',
    icon: Settings,
    settings: [
      { label: 'Nom de l\'organisation', value: 'OpenPulse', type: 'text' },
      { label: 'Fuseau horaire', value: 'Europe/Paris (UTC+1)', type: 'select' },
      { label: 'Langue par défaut', value: 'Français', type: 'select' },
    ]
  },
  {
    title: 'Sécurité',
    icon: Shield,
    settings: [
      { label: '2FA obligatoire pour admins', value: true, type: 'switch' },
      { label: 'Session timeout (minutes)', value: '30', type: 'number' },
      { label: 'Notifications de sécurité', value: true, type: 'switch' },
    ]
  },
]

export const AdminSettingsPreview = memo(() => (
  <div className="p-4 space-y-4">
    <h4 className="font-semibold flex items-center gap-2">
      <Settings className="h-4 w-4" />
      Configuration système
    </h4>

    {settingsGroups.map((group, groupIndex) => {
      const Icon = group.icon
      return (
        <motion.div
          key={group.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: groupIndex * 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.settings.map((setting, index) => (
                <div key={setting.label} className="flex items-center justify-between">
                  <span className="text-sm">{setting.label}</span>
                  {setting.type === 'switch' ? (
                    <Switch checked={setting.value as boolean} />
                  ) : (
                    <Badge variant="secondary">{setting.value as string}</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )
    })}

    {/* Secrets API */}
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Key className="h-4 w-4" />
          Secrets et clés API
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[
            { name: 'AZURE_OPENAI_API_KEY', masked: '••••••••••••abc123' },
            { name: 'QONTO_API_KEY', masked: '••••••••••••xyz789' },
          ].map((secret) => (
            <div key={secret.name} className="flex items-center justify-between p-2 bg-muted rounded">
              <code className="text-xs">{secret.name}</code>
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">{secret.masked}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Voir">
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
))
AdminSettingsPreview.displayName = 'AdminSettingsPreview'
