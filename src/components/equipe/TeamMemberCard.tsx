import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Mail, Building2, Clock, AlertCircle, TrendingUp, Linkedin } from "lucide-react";
import { WorkloadIndicator } from "./WorkloadIndicator";
import { TeamMemberStats } from "@/hooks/hr/useTeamStats";
import { formatLastActivity, getCompletionRateColor } from "@/lib/teamUtils";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface Profile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: string;
  actif?: boolean;
  fonction?: string | null;
  avatar_url?: string | null;
  linkedin_url?: string | null;
}

interface Etablissement {
  id: string;
  nom: string;
  ville: string;
  statut: string;
}

interface TeamMemberCardProps {
  profile: Profile;
  stats: TeamMemberStats;
  assignedProjects: Etablissement[];
  onViewDetails: () => void;
}

const getRoleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return <Badge variant="destructive">Administrateur</Badge>;
    case "manager":
      return <Badge variant="default">Manager</Badge>;
    case "commercial":
      return <Badge className="bg-blue-500 text-white">Commercial</Badge>;
    case "chef_projet":
      return <Badge className="bg-green-500 text-white">Chef de projet</Badge>;
    case "csm":
      return <Badge className="bg-purple-500 text-white">CSM</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
};

function TeamMemberCardComponent({ profile, stats, assignedProjects, onViewDetails }: TeamMemberCardProps) {
  const activeTasks = stats.totalTasks - stats.tasksCompleted;
  const fullName = `${profile.prenom} ${profile.nom}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative">
              <UserAvatar
                avatarUrl={profile.avatar_url}
                name={fullName}
                email={profile.email}
                size="lg"
              />
              {profile.actif !== false && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg truncate">
                  {fullName}
                </CardTitle>
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-[#0A66C2] transition-colors flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    title="Voir le profil LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
              </div>
              {profile.fonction && (
                <CardDescription className="text-xs sm:text-sm font-medium mt-1">
                  {profile.fonction}
                </CardDescription>
              )}
              <CardDescription className="flex items-center gap-2 mt-1 text-xs sm:text-sm">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{profile.email}</span>
              </CardDescription>
            </div>
          </div>
          <div className="flex-shrink-0">
            {getRoleBadge(profile.role)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
        {/* Performance Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taux de complétion</span>
            <span className={`font-bold ${getCompletionRateColor(stats.completionRate)}`}>
              {stats.completionRate}%
            </span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
        </div>

        {/* Workload and Tasks */}
        <div className="flex items-center justify-between">
          <WorkloadIndicator workload={stats.workload} taskCount={activeTasks} />
          {stats.tasksOverdue > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              {stats.tasksOverdue} en retard
            </Badge>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
          <div>
            <div className="text-lg font-bold text-primary">{stats.totalProjects}</div>
            <div className="text-xs text-muted-foreground">Projets</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.totalTasks}</div>
            <div className="text-xs text-muted-foreground">Tâches</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{stats.tasksCompleted}</div>
            <div className="text-xs text-muted-foreground">Terminées</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-2 text-xs">
          {stats.avgCompletionTime > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>Délai moyen: {stats.avgCompletionTime}j</span>
            </div>
          )}
          {stats.lastActivity && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatLastActivity(stats.lastActivity)}</span>
            </div>
          )}
        </div>

        {/* Assigned Projects Preview */}
        {assignedProjects.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span>Projets ({assignedProjects.length})</span>
            </h4>
            <div className="space-y-1">
              {assignedProjects.slice(0, 2).map((etablissement) => (
                <div key={etablissement.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded min-w-0">
                  <span className="font-medium truncate flex-1 mr-2">{etablissement.nom}</span>
                  <span className="text-muted-foreground flex-shrink-0">{etablissement.ville}</span>
                </div>
              ))}
              {assignedProjects.length > 2 && (
                <p className="text-xs text-muted-foreground pl-2">
                  Et {assignedProjects.length - 2} autre(s)...
                </p>
              )}
            </div>
          </div>
        )}

        {/* View Details Button */}
        <Button variant="outline" className="w-full" onClick={onViewDetails}>
          Voir les détails
        </Button>
      </CardContent>
    </Card>
  );
}

// Memoized export to prevent unnecessary re-renders in team lists
export const TeamMemberCard = memo(TeamMemberCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.profile.id === nextProps.profile.id &&
    prevProps.profile.actif === nextProps.profile.actif &&
    prevProps.stats.totalTasks === nextProps.stats.totalTasks &&
    prevProps.stats.tasksCompleted === nextProps.stats.tasksCompleted &&
    prevProps.stats.completionRate === nextProps.stats.completionRate &&
    prevProps.assignedProjects.length === nextProps.assignedProjects.length
  );
});
