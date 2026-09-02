import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Volume2, Eye, Clock } from "lucide-react";
import { useState } from "react";

export function EmailNotificationSettings() {
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [notifSound, setNotifSound] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState("realtime");
  const [notifFilter, setNotifFilter] = useState("all");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Configurez comment vous souhaitez être notifié des nouveaux emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Desktop Notifications */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="desktop-notifs">Notifications bureau</Label>
            <p className="text-sm text-muted-foreground">
              Afficher les notifications pour les nouveaux emails
            </p>
          </div>
          <Switch
            id="desktop-notifs"
            checked={desktopNotifs}
            onCheckedChange={setDesktopNotifs}
          />
        </div>

        {/* Sound */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="notif-sound">Son de notification</Label>
              <p className="text-sm text-muted-foreground">
                Jouer un son lors de l'arrivée d'un email
              </p>
            </div>
          </div>
          <Switch
            id="notif-sound"
            checked={notifSound}
            onCheckedChange={setNotifSound}
          />
        </div>

        {/* Preview */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="show-preview">Aperçu dans la notification</Label>
              <p className="text-sm text-muted-foreground">
                Afficher un extrait du contenu de l'email
              </p>
            </div>
          </div>
          <Switch
            id="show-preview"
            checked={showPreview}
            onCheckedChange={setShowPreview}
          />
        </div>

        {/* Sync Frequency */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label>Fréquence de synchronisation</Label>
          </div>
          <Select value={syncFrequency} onValueChange={setSyncFrequency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">Temps réel</SelectItem>
              <SelectItem value="5min">Toutes les 5 minutes</SelectItem>
              <SelectItem value="15min">Toutes les 15 minutes</SelectItem>
              <SelectItem value="manual">Manuel uniquement</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Plus fréquent = consommation de batterie plus élevée
          </p>
        </div>

        {/* Notification Filter */}
        <div className="space-y-2">
          <Label>Filtrer les notifications</Label>
          <Select value={notifFilter} onValueChange={setNotifFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les emails</SelectItem>
              <SelectItem value="priority">Prioritaires uniquement</SelectItem>
              <SelectItem value="unread">Non lus uniquement</SelectItem>
              <SelectItem value="none">Aucune notification</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
