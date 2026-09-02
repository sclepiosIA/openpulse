import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye } from "lucide-react";
import { TeamMemberStats } from "@/hooks/hr/useTeamStats";
import { WorkloadIndicator } from "./WorkloadIndicator";
import { getCompletionRateColor } from "@/lib/teamUtils";

interface Profile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: string;
  actif?: boolean;
  fonction?: string | null;
}

interface TeamTableViewProps {
  profiles: Profile[];
  stats: Record<string, TeamMemberStats>;
  onViewDetails: (profile: Profile) => void;
}

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    commercial: 'Commercial',
    chef_projet: 'Chef de projet',
    csm: 'CSM',
  };
  return labels[role] || role;
};

export function TeamTableView({ profiles, stats, onViewDetails }: TeamTableViewProps) {
  return (
    <div className="overflow-x-auto -mx-3 sm:mx-0">
      <div className="border rounded-lg inline-block min-w-full">
        <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Fonction</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead className="text-center">Projets</TableHead>
            <TableHead className="text-center">Tâches</TableHead>
            <TableHead>Complétion</TableHead>
            <TableHead>Charge</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => {
            const memberStats = stats[profile.id];
            if (!memberStats) return null;

            return (
              <TableRow key={profile.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {profile.prenom} {profile.nom}
                    </div>
                    <div className="text-xs text-muted-foreground">{profile.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {profile.fonction ? (
                    <span className="text-sm font-medium">{profile.fonction}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getRoleLabel(profile.role)}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-medium">{memberStats.totalProjects}</span>
                </TableCell>
                <TableCell className="text-center">
                  <div className="space-y-1">
                    <span className="font-medium">{memberStats.totalTasks}</span>
                    {memberStats.tasksOverdue > 0 && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {memberStats.tasksOverdue}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 min-w-[120px]">
                    <div className="flex items-center justify-between text-sm">
                      <span className={getCompletionRateColor(memberStats.completionRate)}>
                        {memberStats.completionRate}%
                      </span>
                    </div>
                    <Progress value={memberStats.completionRate} className="h-2" />
                  </div>
                </TableCell>
                <TableCell>
                  <WorkloadIndicator 
                    workload={memberStats.workload} 
                    taskCount={memberStats.totalTasks - memberStats.tasksCompleted}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(profile)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
