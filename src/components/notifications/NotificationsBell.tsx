import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Settings, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useInAppNotifications,
  type InAppNotification,
} from "@/hooks/dashboard/useInAppNotifications";

const typeColor: Record<InAppNotification["type"], string> = {
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

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useInAppNotifications();

  const handleClick = (n: InAppNotification) => {
    if (!n.is_read) markAsRead(n.id);
    const url = getTargetUrl(n);
    if (url) {
      setOpen(false);
      navigate(url);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 hover:bg-primary/10"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
        >
          <Bell className="h-5 w-5 text-foreground/80" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-semibold flex items-center justify-center rounded-full"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 shadow-xl border-border/60"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => markAllAsRead()}
                title="Tout marquer comme lu"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setOpen(false);
                navigate("/profil?tab=notifications");
              }}
              title="Paramètres"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[440px]">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucune notification
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "group relative px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors",
                    !n.is_read && "bg-primary/[0.04]"
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full mt-1.5 shrink-0",
                        typeColor[n.type] || "bg-muted-foreground"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            !n.is_read ? "font-semibold" : "font-medium"
                          )}
                        >
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: false,
                            locale: fr,
                          })}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.is_read && (
                        <button
                          className="h-6 w-6 rounded hover:bg-primary/10 flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                          title="Marquer comme lu"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        className="h-6 w-6 rounded hover:bg-destructive/10 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="border-t border-border/60 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-8"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
            >
              Voir toutes les notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
