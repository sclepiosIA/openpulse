import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Building2, Clock, Linkedin, ExternalLink, Save, Loader2 } from "lucide-react";
import { TeamMemberStats } from "@/hooks/hr/useTeamStats";
import { formatLastActivity, getCompletionRateColor } from "@/lib/teamUtils";
import { WorkloadIndicator } from "./WorkloadIndicator";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useTaches } from "@/hooks/tasks/useTaches";
import { useEtablissements } from "@/hooks/crm/useEtablissements";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { UserAvatarUpload } from "@/components/ui/UserAvatarUpload";
import { useToast } from "@/hooks/shared/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  prenom: string;
  nom: string;
  email: string;
  role: string;
  actif?: boolean;
  fonction?: string | null;
  avatar_url?: string | null;
  linkedin_url?: string | null;
}

interface TeamMemberDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  stats: TeamMemberStats | null;
  canEditProfiles?: boolean;
  currentUserId?: string | null;
}

export function TeamMemberDetailDialog({ 
  open, 
  onOpenChange, 
  profile, 
  stats, 
  canEditProfiles = false,
  currentUserId 
}: TeamMemberDetailDialogProps) {
  const { data: allTaches } = useTaches();
  const { data: etablissements } = useEtablissements();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Reset state only when profile changes or modal opens
  useEffect(() => {
    if (profile && open) {
      setLinkedinUrl(profile.linkedin_url || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile?.id, open]);

  if (!profile || !stats) return null;

  const memberTasks = allTaches?.filter(t => t.responsable_id === profile.id) || [];
  const memberProjects = etablissements?.filter(e =>
    e.commercial_id === profile.id ||
    e.chef_projet_id === profile.id ||
    e.csm_id === profile.id
  ) || [];

  const fullName = `${profile.prenom} ${profile.nom}`;

  // Data for priority chart
  const priorityData = [
    { name: 'Haute', value: memberTasks.filter(t => t.priorite === 'high').length, fill: '#dc2626' },
    { name: 'Moyenne', value: memberTasks.filter(t => t.priorite === 'medium').length, fill: '#eab308' },
    { name: 'Basse', value: memberTasks.filter(t => t.priorite === 'low').length, fill: '#22c55e' },
  ].filter(d => d.value > 0);

  // Data for status chart
  const statusData = [
    { name: 'Terminé', value: memberTasks.filter(t => t.statut === 'Terminé').length },
    { name: 'En cours', value: memberTasks.filter(t => t.statut === 'En cours').length },
    { name: 'À faire', value: memberTasks.filter(t => t.statut === 'A faire').length },
  ].filter(d => d.value > 0);

  // Validation LinkedIn (BUG-074) : URL obligatoire pointant vers linkedin.com
  const linkedinError = (() => {
    if (!linkedinUrl.trim()) return null; // vide = autorisé (champ optionnel)
    try {
      const u = new URL(linkedinUrl.trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'URL invalide (https requis)';
      if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return 'Doit pointer vers linkedin.com';
      return null;
    } catch {
      return 'URL invalide';
    }
  })();
  const isLinkedinInvalid = linkedinError !== null;

  const handleSaveLinkedin = async () => {
    if (isLinkedinInvalid) {
      toast({ title: 'Lien invalide', description: linkedinError!, variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ linkedin_url: linkedinUrl.trim() || null })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: "Profil mis à jour",
        description: "Le lien LinkedIn a été enregistré.",
      });
      
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = (newAvatarUrl: string | null) => {
    setAvatarUrl(newAvatarUrl);
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <UserAvatar
              avatarUrl={avatarUrl}
              name={fullName}
              email={profile.email}
              size="xl"
            />
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-2xl">{fullName}</DialogTitle>
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-[#0A66C2] transition-colors"
                    title="Voir le profil LinkedIn"
                  >
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
              </div>
              {profile.fonction && (
                <p className="text-sm font-medium text-foreground mt-1">{profile.fonction}</p>
              )}
              <DialogDescription className="mt-1">{profile.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className={`grid w-full ${canEditProfiles ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="projects">Projets</TabsTrigger>
            <TabsTrigger value="tasks">Tâches</TabsTrigger>
            {canEditProfiles && <TabsTrigger value="profile">Profil</TabsTrigger>}
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Taux de complétion</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${getCompletionRateColor(stats.completionRate)}`}>
                      {stats.completionRate}%
                    </div>
                    <Progress value={stats.completionRate} className="mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {stats.tasksCompleted} / {stats.totalTasks} tâches
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Charge de travail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WorkloadIndicator workload={stats.workload} />
                    <div className="mt-4 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">En cours:</span>
                        <span className="font-medium">{stats.tasksInProgress}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">En retard:</span>
                        <span className="font-medium text-red-600">{stats.tasksOverdue}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Délai moyen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">
                      {stats.avgCompletionTime}j
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Temps moyen de complétion
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Dernière activité</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-medium text-muted-foreground">
                      {formatLastActivity(stats.lastActivity)}
                    </div>
                    {stats.lastActivity && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {stats.lastActivity.toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priorityData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Répartition par priorité</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={priorityData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {priorityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {statusData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Répartition par statut</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={statusData}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-4">
              <div className="grid gap-3">
                {memberProjects.map((project) => (
                  <Card key={project.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{project.nom}</CardTitle>
                          <CardDescription>{project.ville} - {project.region}</CardDescription>
                        </div>
                        <Badge variant="outline">{project.statut}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span>{project.type}</span>
                        </div>
                        {project.progression !== null && (
                          <div className="flex items-center gap-2 flex-1">
                            <Progress value={project.progression} className="h-2" />
                            <span className="text-xs text-muted-foreground">{project.progression}%</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {memberProjects.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Aucun projet assigné</p>
                )}
              </div>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-4">
              <div className="grid gap-3">
                {memberTasks.slice(0, 20).map((task) => {
                  const isOverdue = task.echeance && new Date(task.echeance) < new Date() && task.statut !== 'Terminé';
                  return (
                    <Card key={task.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium">{task.titre}</CardTitle>
                          <Badge variant={task.statut === 'Terminé' ? 'default' : 'outline'} className="flex-shrink-0">
                            {task.statut}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {task.priorite && (
                            <Badge variant="outline" className="text-xs">
                              {task.priorite === 'high' ? 'Haute' : task.priorite === 'medium' ? 'Moyenne' : 'Basse'}
                            </Badge>
                          )}
                          {task.echeance && (
                            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(task.echeance).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {memberTasks.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Aucune tâche assignée</p>
                )}
              </div>
            </TabsContent>

            {/* Admin/RH Profile Tab */}
            {canEditProfiles && (
              <TabsContent value="profile" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Photo de profil</CardTitle>
                    <CardDescription>
                      Gérer l'avatar de {fullName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UserAvatarUpload
                      currentAuthUserId={currentUserId || ""}
                      targetAuthUserId={profile.user_id}
                      profileId={profile.id}
                      currentAvatarUrl={avatarUrl}
                      userName={fullName}
                      onAvatarChange={handleAvatarChange}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profil LinkedIn</CardTitle>
                    <CardDescription>
                      Ajouter ou modifier le lien LinkedIn de {fullName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="linkedin-url">URL du profil LinkedIn</Label>
                      <div className="flex gap-2">
                        <Input
                          id="linkedin-url"
                          type="url"
                          placeholder="https://linkedin.com/in/username"
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          aria-invalid={isLinkedinInvalid || undefined}
                          aria-describedby={isLinkedinInvalid ? 'linkedin-url-error' : undefined}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSaveLinkedin}
                          disabled={isSaving || isLinkedinInvalid}
                          size="icon" aria-label="Enregistrer le lien LinkedIn">
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                        {linkedinUrl && (
                          <Button 
                            variant="outline" 
                            size="icon"
                            asChild aria-label="Ouvrir le lien">
                            <a 
                              href={linkedinUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                      {isLinkedinInvalid && (
                        <p id="linkedin-url-error" className="text-sm text-destructive">
                          {linkedinError}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
