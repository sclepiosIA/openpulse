import React, { useState } from 'react';
import {
  Inbox,
  Calendar,
  CalendarDays,
  AlertCircle,
  Building2,
  User,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTodoProjects } from '@/hooks/tasks/useTodoProjects';
import { useUnifiedTodoStats, TodoFilter } from '@/hooks/tasks/useUnifiedTodos';
import { useEtablissements } from '@/hooks/crm/useEtablissements';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useClearDoneTodos } from '@/hooks/tasks/useClearDoneTodos';
import { CreateProjectModal } from './modals/CreateProjectModal';
import { cn } from '@/lib/utils';

interface TodoSidebarProps {
  selectedFilter: TodoFilter;
  selectedProjectId: string | null;
  selectedEtablissementId: string | null;
  onSelectFilter: (filter: TodoFilter) => void;
  onSelectProject: (projectId: string) => void;
  onSelectEtablissement: (etablissementId: string) => void;
  showDone: boolean;
  onShowDoneChange: (show: boolean) => void;
}

export function TodoSidebar({
  selectedFilter,
  selectedProjectId,
  selectedEtablissementId,
  onSelectFilter,
  onSelectProject,
  onSelectEtablissement,
  showDone,
  onShowDoneChange,
}: TodoSidebarProps) {
  const { data: profile } = useCurrentProfile();
  const { data: stats } = useUnifiedTodoStats();
  const { data: projects = [] } = useTodoProjects();
  const { data: etablissements = [] } = useEtablissements();
  const clearDoneTodos = useClearDoneTodos();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [etablissementsOpen, setEtablissementsOpen] = useState(true);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  // Filter etablissements where user is commercial, chef_projet, or csm
  const myEtablissements = etablissements.filter(e => 
    e.commercial_id === profile?.id || 
    e.chef_projet_id === profile?.id ||
    e.csm_id === profile?.id
  );

  const filters: { key: TodoFilter; label: string; icon: React.ReactNode; count?: number; color?: string }[] = [
    { key: 'all', label: 'Inbox', icon: <Inbox className="h-4 w-4" />, count: stats?.total },
    { key: 'today', label: "Aujourd'hui", icon: <Calendar className="h-4 w-4" />, count: stats?.today, color: 'text-orange-500' },
    { key: 'week', label: 'Cette semaine', icon: <CalendarDays className="h-4 w-4" />, count: stats?.week },
    { key: 'overdue', label: 'En retard', icon: <AlertCircle className="h-4 w-4" />, count: stats?.overdue, color: 'text-destructive' },
  ];

  const sources: { key: TodoFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'etablissement', label: 'Établissements', icon: <Building2 className="h-4 w-4" /> },
    { key: 'personal', label: 'Personnel', icon: <User className="h-4 w-4" /> },
    { key: 'shared', label: 'Partagé', icon: <Users className="h-4 w-4" /> },
  ];

  const handleClearDoneTodos = () => {
    if (confirm('Supprimer toutes les tâches terminées ?')) {
      clearDoneTodos.mutate();
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      {/* Main Filters */}
      <div className="space-y-1">
        {filters.map((f) => {
          const isSelected = selectedFilter === f.key && !selectedProjectId && !selectedEtablissementId;
          return (
            <Button
              key={f.key}
              variant={isSelected ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 rounded-lg transition-all',
                isSelected && 'bg-primary/10 text-primary border-l-4 border-primary',
                f.color && !isSelected && f.color
              )}
              onClick={() => onSelectFilter(f.key)}
            >
              {f.icon}
              <span className="flex-1 text-left">{f.label}</span>
              {f.count !== undefined && f.count > 0 && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  f.color ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                )}>
                  {f.count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="my-4 border-t border-primary/10" />

      {/* Source Filters */}
      <div className="space-y-1">
        {sources.map((s) => {
          const isSelected = selectedFilter === s.key && !selectedProjectId && !selectedEtablissementId;
          return (
            <Button
              key={s.key}
              variant={isSelected ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 rounded-lg transition-all',
                isSelected && 'bg-primary/10 text-primary border-l-4 border-primary'
              )}
              onClick={() => onSelectFilter(s.key)}
            >
              {s.icon}
              <span className="flex-1 text-left">{s.label}</span>
            </Button>
          );
        })}
      </div>

      <div className="my-4 border-t border-primary/10" />

      {/* Projects */}
      <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
        <div className="flex items-center justify-between mb-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-2 h-8 text-muted-foreground rounded-lg">
              {projectsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="text-xs font-medium uppercase">Projets</span>
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary"
            onClick={() => setIsCreateProjectOpen(true)} aria-label="Ajouter">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <CollapsibleContent className="space-y-1">
          {projects.map((project) => (
            <Button
              key={project.id}
              variant={selectedProjectId === project.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 rounded-lg transition-all',
                selectedProjectId === project.id && 'bg-primary/10 text-primary border-l-4 border-primary'
              )}
              onClick={() => onSelectProject(project.id)}
            >
              <div 
                className="h-3 w-3 rounded-sm" 
                style={{ backgroundColor: project.color }}
              />
              <span className="flex-1 text-left truncate">{project.name}</span>
              {project.is_shared && <Users className="h-3 w-3 text-muted-foreground" />}
            </Button>
          ))}
          {projects.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">
              Aucun projet
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="my-4 border-t border-primary/10" />

      {/* Etablissements */}
      <Collapsible open={etablissementsOpen} onOpenChange={setEtablissementsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 px-2 h-8 text-muted-foreground mb-1 rounded-lg">
            {etablissementsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className="text-xs font-medium uppercase">Mes Établissements</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1">
          {myEtablissements.slice(0, 10).map((etab) => (
            <Button
              key={etab.id}
              variant={selectedEtablissementId === etab.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 rounded-lg transition-all',
                selectedEtablissementId === etab.id && 'bg-primary/10 text-primary border-l-4 border-primary'
              )}
              onClick={() => onSelectEtablissement(etab.id)}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left truncate">{etab.nom}</span>
            </Button>
          ))}
          {myEtablissements.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">
              Aucun établissement
            </p>
          )}
          {myEtablissements.length > 10 && (
            <p className="text-xs text-muted-foreground px-3 py-1">
              +{myEtablissements.length - 10} autres
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear done todos button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-red-50/80 mb-2 rounded-lg border border-transparent hover:border-destructive/20 transition-all"
        onClick={handleClearDoneTodos}
        disabled={clearDoneTodos.isPending}
      >
        <Trash2 className="h-4 w-4" />
        Vider les terminées
      </Button>

      {/* Show completed toggle */}
      <div className="flex items-center gap-2 py-2">
        <Checkbox
          id="show-done"
          checked={showDone}
          onCheckedChange={(checked) => onShowDoneChange(checked === true)}
        />
        <Label htmlFor="show-done" className="text-sm text-muted-foreground cursor-pointer">
          Afficher terminées
        </Label>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
      />
    </div>
  );
}
