import { Card } from "@/components/ui/card";
import { MessageSquare, TrendingUp, Users, Calendar } from "lucide-react";
import { useMemo } from "react";
import { ForumPost } from "@/types/forum";

interface ForumStatsProps {
  posts: ForumPost[];
}

export function ForumStats({ posts }: ForumStatsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const totalPosts = posts.length;
    const weeklyPosts = posts.filter(p => new Date(p.created_at) >= oneWeekAgo).length;
    const totalComments = posts.reduce((sum, p) => sum + (p.nombre_commentaires || 0), 0);
    
    // Active members (unique users who posted in the last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeMembers = new Set(
      posts
        .filter(p => new Date(p.created_at) >= thirtyDaysAgo)
        .map(p => p.user_id)
    ).size;

    return {
      totalPosts,
      weeklyPosts,
      totalComments,
      activeMembers
    };
  }, [posts]);

  const statCards = [
    {
      icon: MessageSquare,
      label: "Posts totaux",
      value: stats.totalPosts,
      color: "text-primary"
    },
    {
      icon: TrendingUp,
      label: "Cette semaine",
      value: stats.weeklyPosts,
      color: "text-green-600 dark:text-green-400"
    },
    {
      icon: Calendar,
      label: "Commentaires",
      value: stats.totalComments,
      color: "text-blue-600 dark:text-blue-400"
    },
    {
      icon: Users,
      label: "Membres actifs",
      value: stats.activeMembers,
      color: "text-purple-600 dark:text-purple-400"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={`forum-stat-${stat.label}`} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <stat.icon className={`h-8 w-8 ${stat.color}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}
