import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNotificationPreferences } from "@/hooks/notifications/useNotificationPreferences";
import { Bell, BellOff, Mail, Sparkles, Clock, CheckCircle, Building2, Users } from "lucide-react";
import { PushPreferencesPanel } from "@/components/notifications/PushPreferencesPanel";
import { useState, useEffect } from "react";

export function NotificationPreferences() {
  const { preferences, updatePreferences, isUpdating } = useNotificationPreferences();
  const [localPreferences, setLocalPreferences] = useState(preferences);

  // Sync local state with server state
  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleSave = () => {
    updatePreferences(localPreferences);
  };

  const handleEmailNotificationChange = (key: string, field: string, value: any) => {
    setLocalPreferences({
      ...localPreferences,
      email_notifications: {
        ...localPreferences.email_notifications,
        [key]: {
          ...localPreferences.email_notifications[key as keyof typeof localPreferences.email_notifications],
          [field]: value,
        },
      },
    });
  };

  const handleInAppNotificationChange = (key: string, value: boolean) => {
    setLocalPreferences({
      ...localPreferences,
      in_app_notifications: {
        ...localPreferences.in_app_notifications,
        [key]: value,
      },
    });
  };

  const handleQuietHoursChange = (field: string, value: any) => {
    setLocalPreferences({
      ...localPreferences,
      quiet_hours: {
        ...localPreferences.quiet_hours,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Push Notifications Panel - with Test button */}
      <PushPreferencesPanel />

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notifications par email
          </CardTitle>
          <CardDescription>
            Configurez les notifications que vous souhaitez recevoir par email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Suggestions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <Label htmlFor="ai-suggestions-email" className="font-semibold">
                  Suggestions IA
                </Label>
              </div>
              <Switch
                id="ai-suggestions-email"
                checked={localPreferences.email_notifications.ai_suggestions.enabled}
                onCheckedChange={(checked) =>
                  handleEmailNotificationChange('ai_suggestions', 'enabled', checked)
                }
              />
            </div>
            {localPreferences.email_notifications.ai_suggestions.enabled && (
              <div className="ml-6 space-y-2">
                <Label className="text-sm text-muted-foreground">Fréquence</Label>
                <Select
                  value={localPreferences.email_notifications.ai_suggestions.frequency}
                  onValueChange={(value) =>
                    handleEmailNotificationChange('ai_suggestions', 'frequency', value)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidien (8h00)</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire (lundi 8h00)</SelectItem>
                    <SelectItem value="never">Jamais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Task Reminders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Label htmlFor="task-reminders-email" className="font-semibold">
                  Rappels de tâches
                </Label>
              </div>
              <Switch
                id="task-reminders-email"
                checked={localPreferences.email_notifications.task_reminders.enabled}
                onCheckedChange={(checked) =>
                  handleEmailNotificationChange('task_reminders', 'enabled', checked)
                }
              />
            </div>
            {localPreferences.email_notifications.task_reminders.enabled && (
              <div className="ml-6 space-y-2">
                <Label className="text-sm text-muted-foreground">Fréquence</Label>
                <Select
                  value={localPreferences.email_notifications.task_reminders.frequency}
                  onValueChange={(value) =>
                    handleEmailNotificationChange('task_reminders', 'frequency', value)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidien</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="never">Jamais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Urgent Tasks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <Label htmlFor="urgent-tasks-email" className="font-semibold">
                  Tâches urgentes
                </Label>
              </div>
              <Switch
                id="urgent-tasks-email"
                checked={localPreferences.email_notifications.urgent_tasks.enabled}
                onCheckedChange={(checked) =>
                  handleEmailNotificationChange('urgent_tasks', 'enabled', checked)
                }
              />
            </div>
            {localPreferences.email_notifications.urgent_tasks.enabled && (
              <div className="ml-6 space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Alerter si échéance dans moins de (jours)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={localPreferences.email_notifications.urgent_tasks.threshold_days}
                  onChange={(e) =>
                    handleEmailNotificationChange('urgent_tasks', 'threshold_days', parseInt(e.target.value))
                  }
                  className="w-[200px]"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Establishment Updates */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-600" />
              <Label htmlFor="establishment-updates-email" className="font-semibold">
                Mises à jour des établissements
              </Label>
            </div>
            <Switch
              id="establishment-updates-email"
              checked={localPreferences.email_notifications.establishment_updates.enabled}
              onCheckedChange={(checked) =>
                handleEmailNotificationChange('establishment_updates', 'enabled', checked)
              }
            />
          </div>

          <Separator />

          {/* Team Mentions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <Label htmlFor="team-mentions-email" className="font-semibold">
                Mentions de l'équipe
              </Label>
            </div>
            <Switch
              id="team-mentions-email"
              checked={localPreferences.email_notifications.team_mentions.enabled}
              onCheckedChange={(checked) =>
                handleEmailNotificationChange('team_mentions', 'enabled', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications dans l'application
          </CardTitle>
          <CardDescription>
            Notifications affichées en temps réel dans l'interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-suggestions-app">Suggestions IA</Label>
            <Switch
              id="ai-suggestions-app"
              checked={localPreferences.in_app_notifications.ai_suggestions}
              onCheckedChange={(checked) =>
                handleInAppNotificationChange('ai_suggestions', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="task-assignments-app">Assignations de tâches</Label>
            <Switch
              id="task-assignments-app"
              checked={localPreferences.in_app_notifications.task_assignments}
              onCheckedChange={(checked) =>
                handleInAppNotificationChange('task_assignments', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="task-completions-app">Tâches terminées</Label>
            <Switch
              id="task-completions-app"
              checked={localPreferences.in_app_notifications.task_completions}
              onCheckedChange={(checked) =>
                handleInAppNotificationChange('task_completions', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="status-changes-app">Changements de statut</Label>
            <Switch
              id="status-changes-app"
              checked={localPreferences.in_app_notifications.establishment_status_changes}
              onCheckedChange={(checked) =>
                handleInAppNotificationChange('establishment_status_changes', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="mentions-app">Commentaires et mentions</Label>
            <Switch
              id="mentions-app"
              checked={localPreferences.in_app_notifications.comments_mentions}
              onCheckedChange={(checked) =>
                handleInAppNotificationChange('comments_mentions', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Heures de silence
          </CardTitle>
          <CardDescription>
            Désactiver les notifications pendant certaines heures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours-enabled">Activer les heures de silence</Label>
            <Switch
              id="quiet-hours-enabled"
              checked={localPreferences.quiet_hours.enabled}
              onCheckedChange={(checked) =>
                handleQuietHoursChange('enabled', checked)
              }
            />
          </div>

          {localPreferences.quiet_hours.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Début</Label>
                <Input
                  type="time"
                  value={localPreferences.quiet_hours.start_time}
                  onChange={(e) =>
                    handleQuietHoursChange('start_time', e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input
                  type="time"
                  value={localPreferences.quiet_hours.end_time}
                  onChange={(e) =>
                    handleQuietHoursChange('end_time', e.target.value)
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isUpdating}>
          {isUpdating ? "Enregistrement..." : "Enregistrer les préférences"}
        </Button>
      </div>
    </div>
  );
}
