import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Trash2, Settings, Inbox, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useInAppNotifications,
  type InAppNotification,
} from "@/hooks/dashboard/useInAppNotifications";
import { usePageTitle } from "@/hooks/shared/usePageTitle";

const TYPE_LABELS: Record<InAppNotification["type"], string> = {
  ai_suggestion: "Suggestion IA",
  task_assignment: "Tâche assignée",
  task_completion: "Tâche terminée",
  establishment_update: "Établissement",
  mention: "Mention",
  other: "Autre",
};

const TYPE_DOT: Record<InAppNotification["type"], string> = {
  ai_suggestion: "bg-purple-500",
  task_assignment: "bg-blue-500",
  task_completion: "bg-emerald-500",
  establishment_update: "bg-amber-500",
  mention: "bg-pink-500",
  other: "bg-muted-foreground",
};

function getTargetUrl(n: InAppNotification): string | null {
  if (!n.related_id || !n.related_type) return null;
  switch (n.related_type) {
    case "etablissement":
      return `/etablissements/${n.related_id}`;
    case "tache":
      return `/todos`;
    case "ai_suggestion":
      return `/parametres/jarvis`;
    case "email":
      return `/emails`;
    default:
      return null;
  }
}

type FilterValue = "all" | "unread" | InAppNotification["type"];

export default function CentreNotifications() {
  usePageTitle("Centre de notifications");
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterValue>("all");

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useInAppNotifications();

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.is_read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const stats = useMemo(() => {
    const byType = notifications.reduce<Record<string, number>>((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1;
      return acc;
    }, {});
    return { total: notifications.length, unread: unreadCount, byType };
  }, [notifications, unreadCount]);

  const handleClick = (n: InAppNotification) => {
    if (!n.is_read) markAsRead(n.id);
    const url = getTargetUrl(n);
    if (url) navigate(url);
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Centre de notifications</h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} notification{stats.total > 1 ? "s" : ""} —{" "}
              {stats.unread} non lue{stats.unread > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead()}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate("/profil?tab=notifications")}>
            <Settings className="h-4 w-4 mr-2" />
            Préférences
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Non lues</p>
            <p className="text-2xl font-semibold text-primary">{stats.unread}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Suggestions IA</p>
            <p className="text-2xl font-semibold">{stats.byType.ai_suggestion || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tâches</p>
            <p className="text-2xl font-semibold">
              {(stats.byType.task_assignment || 0) + (stats.byType.task_completion || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtrer
            </CardTitle>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterValue)} className="mt-2">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="unread">Non lues</TabsTrigger>
              <TabsTrigger value="ai_suggestion">IA</TabsTrigger>
              <TabsTrigger value="task_assignment">Tâches</TabsTrigger>
              <TabsTrigger value="establishment_update">Établissements</TabsTrigger>
              <TabsTrigger value="mention">Mentions</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Aucune notification {filter !== "all" ? "pour ce filtre" : ""}
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((n) => {
                  const url = getTargetUrl(n);
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "p-4 flex gap-3 hover:bg-muted/40 transition-colors",
                        !n.is_read && "bg-primary/5",
                        url && "cursor-pointer"
                      )}
                      onClick={() => url && handleClick(n)}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 mt-2 rounded-full shrink-0",
                          TYPE_DOT[n.type]
                        )}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn("text-sm truncate", !n.is_read && "font-semibold")}>
                              {n.title}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {n.message}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {TYPE_LABELS[n.type]}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(n.id);
                            }}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
