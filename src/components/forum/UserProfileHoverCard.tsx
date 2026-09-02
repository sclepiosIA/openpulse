import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ForumAvatar } from "./ForumAvatar";
import { Badge } from "@/components/ui/badge";
import { useForumUserStats } from "@/hooks/forum/useForumBookmarks";
import { MessageSquare, FileText, TrendingUp } from "lucide-react";

interface UserProfileHoverCardProps {
  userId?: string | null;
  nom?: string | null;
  prenom?: string | null;
  role?: string | null;
  service?: string | null;
  etablissement?: string | null;
  children: React.ReactNode;
}

export function UserProfileHoverCard({
  userId,
  nom,
  prenom,
  role,
  service,
  etablissement,
  children,
}: UserProfileHoverCardProps) {
  const { data: stats } = useForumUserStats(userId ?? undefined);

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" side="top">
        <div className="space-y-4">
          {/* En-tête avec avatar */}
          <div className="flex items-center gap-3">
            <ForumAvatar nom={nom ?? undefined} prenom={prenom ?? undefined} className="h-12 w-12" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {prenom} {nom}
              </p>
              {role && (
                <p className="text-sm text-muted-foreground truncate">{role}</p>
              )}
            </div>
          </div>

          {/* Informations */}
          {(service || etablissement) && (
            <div className="space-y-1 text-sm">
              {service && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Service:</span> {service}
                </p>
              )}
              {etablissement && (
                <p className="text-muted-foreground truncate">
                  <span className="font-medium">Établissement:</span> {etablissement}
                </p>
              )}
            </div>
          )}

          {/* Statistiques */}
          {stats && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="text-lg font-bold">{stats.posts_count}</div>
                  <div className="text-xs text-muted-foreground">Posts</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="text-lg font-bold">{stats.comments_count}</div>
                  <div className="text-xs text-muted-foreground">Commentaires</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="text-lg font-bold">{stats.reputation_score}</div>
                  <div className="text-xs text-muted-foreground">Réputation</div>
                </div>
              </div>

              {/* Badges */}
              {stats.badges && Array.isArray(stats.badges) && stats.badges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Badges</p>
                  <div className="flex flex-wrap gap-1">
                    {stats.badges.map((badge: any) => (
                      <Badge
                        key={`user-badge-${badge.name}`}
                        variant="secondary"
                        className="text-xs gap-1"
                        title={badge.description}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.name}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
