import { Badge } from "@/components/ui/badge";
import { Flame, Sparkles, TrendingUp } from "lucide-react";
import { useMemo } from "react";

interface PostBadgesProps {
  createdAt: string;
  upvotes: number;
  commentsCount: number;
  views: number;
}

export function PostBadges({ createdAt, upvotes, commentsCount, views }: PostBadgesProps) {
  const badges = useMemo(() => {
    const result = [];
    const now = new Date();
    const postDate = new Date(createdAt);
    const hoursAgo = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

    // Badge "Nouveau" - moins de 24h
    if (hoursAgo < 24) {
      result.push({
        icon: Sparkles,
        label: "Nouveau",
        variant: "default" as const,
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse",
      });
    }

    // Badge "Hot" - beaucoup d'engagement récent
    const engagementScore = upvotes * 2 + commentsCount * 3 + views * 0.1;
    if (engagementScore > 50 && hoursAgo < 72) {
      result.push({
        icon: Flame,
        label: "Hot",
        variant: "destructive" as const,
        className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      });
    }

    // Badge "Tendance" - croissance rapide
    if (upvotes > 10 || (commentsCount > 5 && hoursAgo < 48)) {
      result.push({
        icon: TrendingUp,
        label: "Tendance",
        variant: "secondary" as const,
        className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      });
    }

    return result;
  }, [createdAt, upvotes, commentsCount, views]);

  if (badges.length === 0) return null;

  return (
    <>
      {badges.map((badge) => {
        const Icon = badge.icon;
        return (
          <Badge
            key={`badge-${badge.label}`}
            variant={badge.variant}
            className={`gap-1 ${badge.className}`}
          >
            <Icon className="h-3 w-3" />
            {badge.label}
          </Badge>
        );
      })}
    </>
  );
}
