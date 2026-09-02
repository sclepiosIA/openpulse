import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForumPosts } from "@/hooks/forum/useForumPosts";
import { useTopContributors } from "@/hooks/forum/useForumBookmarks";
import { ForumAvatar } from "./ForumAvatar";
import { TrendingUp, Trophy, MessageSquare, FileText } from "lucide-react";

export function ForumStatsPanel() {
  const { data: posts } = useForumPosts();
  const { data: topContributors } = useTopContributors(5);

  const totalPosts = posts?.length || 0;
  const totalComments = posts?.reduce((sum, post) => sum + (post.nombre_commentaires || 0), 0) || 0;
  const totalViews = posts?.reduce((sum, post) => sum + (post.nombre_vues || 0), 0) || 0;

  // Calculer les thèmes tendances
  const themeCounts = posts?.reduce((acc, post) => {
    acc[post.theme] = (acc[post.theme] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const trendingThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const themeLabels: Record<string, string> = {
    pmsi: "PMSI",
    smr: "SMR",
    urgences: "Urgences",
    completion_dossier: "Complétion dossier",
    dictee_vocale: "Dictée vocale",
    astuces: "Astuces",
    bugs: "Bugs",
    support: "Support",
    autre: "Autre"
  };

  return (
    <div className="space-y-6 sticky top-6">
      {/* Statistiques globales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Statistiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Posts</span>
              </div>
              <span className="text-lg font-bold">{totalPosts}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Commentaires</span>
              </div>
              <span className="text-lg font-bold">{totalComments}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top contributeurs */}
      {topContributors && topContributors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Contributeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topContributors.map((contributor: any, index) => (
                <div
                  key={contributor.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </div>
                  <ForumAvatar
                    nom={contributor.etablissement_users.nom}
                    prenom={contributor.etablissement_users.prenom}
                    className="h-8 w-8"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {contributor.etablissement_users.prenom} {contributor.etablissement_users.nom}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{contributor.posts_count} posts</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {contributor.reputation_score}
                      </span>
                    </div>
                  </div>
                  {contributor.badges && contributor.badges.length > 0 && (
                    <div className="flex gap-1">
                      {contributor.badges.slice(0, 2).map((badge: any) => (
                        <span key={`contrib-badge-${badge.name}`} className="text-lg" title={badge.name}>
                          {badge.icon}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thèmes tendances */}
      {trendingThemes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              🔥 Tendances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trendingThemes.map(([theme, count]) => (
                <div
                  key={theme}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {themeLabels[theme] || theme}
                  </span>
                  <Badge variant="secondary" className="ml-2">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
