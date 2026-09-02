/**
 * JarvisSettingsContent - Contenu des paramètres Jarvis (sans wrapper Sheet)
 *
 * Composant réutilisable pour afficher les paramètres Jarvis dans un onglet
 * ou dans un Sheet si nécessaire ailleurs.
 * V11: Ajout des paramètres Wake Word
 */

import { Settings, Bell, Mic, Clock, Zap, Shield } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useJarvisPreferences } from '@/hooks/jarvis/useJarvisPreferences'
import { useAuth } from '@/hooks/shared/useAuth'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface SettingsSectionProps {
  icon: React.ReactNode
  title: string
  color: string
  children: React.ReactNode
}

function SettingsSection({ icon, title, color, children }: SettingsSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className={cn('p-2 rounded-xl ring-1 ring-border/30', color)}>{icon}</div>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="space-y-4 pl-1">{children}</div>
    </section>
  )
}

export function JarvisSettingsContent() {
  const { user } = useAuth()
  const { preferences, updatePreferences, isUpdating, isLoading } = useJarvisPreferences(user?.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Impossible de charger les préférences
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-marque-grille px-5 py-5">
        <motion.div
          className="absolute rounded-full blur-2xl opacity-20"
          style={{
            width: 60,
            height: 60,
            background: 'hsl(197 64% 60% / 0.3)',
            right: '15%',
            top: '30%',
          }}
          animate={{ y: [0, -6, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative flex items-center gap-3">
          <div className="p-2 rounded-xl bg-card/10 backdrop-blur-sm border border-white/20">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">Paramètres Jarvis</h3>
            <p className="text-xs text-white/70">
              Configurez le comportement de votre assistant IA
            </p>
          </div>
        </div>

        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-3"
          viewBox="0 0 1440 20"
          preserveAspectRatio="none"
        >
          <path
            d="M0,10 C240,17 480,3 720,10 C960,17 1200,3 1440,10 L1440,20 L0,20 Z"
            fill="hsl(var(--background))"
          />
        </svg>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Activation générale */}
        <SettingsSection
          icon={<Zap className="h-4 w-4 text-amber-500" />}
          title="Général"
          color="bg-gradient-to-br from-amber-500/15 to-amber-500/5"
        >
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
            <div>
              <Label htmlFor="enabled" className="font-medium">
                Jarvis activé
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Activer l'assistant proactif</p>
            </div>
            <Switch
              id="enabled"
              checked={preferences.enabled}
              onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
              disabled={isUpdating}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
            <div>
              <Label htmlFor="proactive" className="font-medium">
                Mode proactif
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suggestions automatiques sur événements
              </p>
            </div>
            <Switch
              id="proactive"
              checked={preferences.proactive_mode}
              onCheckedChange={(checked) => updatePreferences({ proactive_mode: checked })}
              disabled={isUpdating}
            />
          </div>
        </SettingsSection>

        <Separator className="bg-border/50" />

        {/* Voice settings */}
        <SettingsSection
          icon={<Mic className="h-4 w-4 text-sky-500" />}
          title="Voix"
          color="bg-gradient-to-br from-sky-500/15 to-sky-500/5"
        >
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
            <div>
              <Label htmlFor="voice" className="font-medium">
                Commandes vocales
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Activer "Jarvis, ..."</p>
            </div>
            <Switch
              id="voice"
              checked={preferences.voice_enabled}
              onCheckedChange={(checked) => updatePreferences({ voice_enabled: checked })}
              disabled={isUpdating}
            />
          </div>

          {preferences.voice_enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/20">
                <Label className="text-sm">Mot d'activation</Label>
                <Select
                  value={preferences.wake_word || 'Jarvis'}
                  onValueChange={(value) => updatePreferences({ wake_word: value })}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Jarvis">🎙️ Jarvis</SelectItem>
                    <SelectItem value="Assistant">🤖 Assistant</SelectItem>
                    <SelectItem value="Hey Jarvis">👋 Hey Jarvis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                <div className="flex justify-between">
                  <Label className="text-sm">Vitesse de la voix</Label>
                  <span className="text-sm font-medium text-primary">
                    {preferences.voice_speed}x
                  </span>
                </div>
                <Slider
                  value={[preferences.voice_speed || 1]}
                  onValueChange={([value]) => updatePreferences({ voice_speed: value })}
                  min={0.5}
                  max={2}
                  step={0.1}
                  disabled={isUpdating}
                  className="py-1"
                />
              </div>
            </motion.div>
          )}
        </SettingsSection>

        <Separator className="bg-border/50" />

        {/* Notification settings */}
        <SettingsSection
          icon={<Bell className="h-4 w-4 text-purple-500" />}
          title="Notifications"
          color="bg-gradient-to-br from-purple-500/15 to-purple-500/5"
        >
          <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/30">
            <Label className="text-sm font-medium">Fréquence des notifications</Label>
            <Select
              value={preferences.notification_frequency || 'immediate'}
              onValueChange={(value: 'immediate' | 'batched_hourly' | 'batched_daily') =>
                updatePreferences({ notification_frequency: value })
              }
              disabled={isUpdating}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">⚡ Immédiate</SelectItem>
                <SelectItem value="batched_hourly">⏰ Groupée (horaire)</SelectItem>
                <SelectItem value="batched_daily">📅 Groupée (quotidienne)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingsSection>

        <Separator className="bg-border/50" />

        {/* Quiet hours */}
        <SettingsSection
          icon={<Clock className="h-4 w-4 text-emerald-500" />}
          title="Heures de silence"
          color="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5"
        >
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
            <div>
              <Label htmlFor="quiet" className="font-medium">
                Activer les heures de silence
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pas de notifications pendant ces heures
              </p>
            </div>
            <Switch
              id="quiet"
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) => updatePreferences({ quiet_hours_enabled: checked })}
              disabled={isUpdating}
            />
          </div>

          {preferences.quiet_hours_enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/20">
                <Label className="text-sm">Début</Label>
                <Select
                  value={preferences.quiet_hours_start || '22:00'}
                  onValueChange={(value) => updatePreferences({ quiet_hours_start: value })}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0')
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/20">
                <Label className="text-sm">Fin</Label>
                <Select
                  value={preferences.quiet_hours_end || '07:00'}
                  onValueChange={(value) => updatePreferences({ quiet_hours_end: value })}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0')
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </SettingsSection>

        <Separator className="bg-border/50" />

        {/* AI settings */}
        <SettingsSection
          icon={<Shield className="h-4 w-4 text-pink-500" />}
          title="Seuils IA"
          color="bg-gradient-to-br from-pink-500/15 to-pink-500/5"
        >
          <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex justify-between">
              <div>
                <Label className="font-medium">Seuil de confiance minimum</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Actions sous ce seuil ne seront pas proposées
                </p>
              </div>
              <span className="text-sm font-bold text-primary">
                {Math.round((preferences.confidence_threshold || 0.85) * 100)}%
              </span>
            </div>
            <Slider
              value={[(preferences.confidence_threshold || 0.85) * 100]}
              onValueChange={([value]) => updatePreferences({ confidence_threshold: value / 100 })}
              min={50}
              max={99}
              step={1}
              disabled={isUpdating}
              className="py-1"
            />
          </div>

          <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex justify-between">
              <div>
                <Label className="font-medium">Auto-approbation au-dessus de</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Actions au-dessus de ce seuil s'exécutent automatiquement
                </p>
              </div>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {Math.round((preferences.auto_approve_above || 0.95) * 100)}%
              </span>
            </div>
            <Slider
              value={[(preferences.auto_approve_above || 0.95) * 100]}
              onValueChange={([value]) => updatePreferences({ auto_approve_above: value / 100 })}
              min={90}
              max={100}
              step={1}
              disabled={isUpdating}
              className="py-1"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
            <div>
              <Label htmlFor="sources" className="font-medium">
                Inclure les sources
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Afficher les articles KB utilisés
              </p>
            </div>
            <Switch
              id="sources"
              checked={preferences.include_sources}
              onCheckedChange={(checked) => updatePreferences({ include_sources: checked })}
              disabled={isUpdating}
            />
          </div>

          {/* Note explicative sur le mode autonome */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <span className="text-lg leading-none">💡</span>
              <span>
                Jarvis exécute automatiquement les actions courantes (tâches, rappels, RDV). Les
                actions sensibles (envoi d'email, suppression, modifications critiques) requièrent
                <strong className="text-foreground"> toujours votre confirmation</strong> via un
                bouton.
              </span>
            </p>
          </div>
        </SettingsSection>
      </div>
    </ScrollArea>
  )
}
