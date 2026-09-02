import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, CalendarDays, Building2, Sparkles } from "lucide-react";
import {
  ClientPortalTask,
  useClientPortalTasks,
  useDeleteClientPortalTask,
  useUpdateClientPortalTask,
} from "@/hooks/portail/useClientPortalTasks";
import { TaskFormDialog } from "./TaskFormDialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  etablissementId: string;
}

const STATUS_LABEL: Record<string, string> = { todo: "À faire", in_progress: "En cours", done: "Terminé" };
const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  todo: "secondary",
  in_progress: "default",
  done: "outline",
};

export function TaskList({ etablissementId }: Props) {
  const { data: tasks = [], isLoading } = useClientPortalTasks(etablissementId);
  const update = useUpdateClientPortalTask();
  const del = useDeleteClientPortalTask();

  const [phaseFilter, setPhaseFilter] = useState<"all" | "deploiement" | "production">("all");
  const [editTask, setEditTask] = useState<ClientPortalTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    if (phaseFilter === "all") return tasks;
    return tasks.filter((t) => t.phase === phaseFilter);
  }, [tasks, phaseFilter]);

  const marqueTasks = filtered.filter((t) => t.assignee === "marque");
  const etabTasks = filtered.filter((t) => t.assignee === "etablissement");

  const toggleDone = (t: ClientPortalTask) => {
    update.mutate({
      id: t.id,
      patch: { statut: t.statut === "done" ? "todo" : "done", done_by: "marque" },
    });
  };

  const renderTask = (t: ClientPortalTask) => {
    const isClientRequest = t.created_by === "etablissement";
    return (
      <div
        key={t.id}
        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      >
        <Checkbox
          checked={t.statut === "done"}
          onCheckedChange={() => toggleDone(t)}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={`font-medium text-sm ${t.statut === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {t.titre}
                </h4>
                {isClientRequest && (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />
                    Demande client
                  </Badge>
                )}
                <Badge variant={STATUS_VARIANT[t.statut]} className="text-xs">
                  {STATUS_LABEL[t.statut]}
                </Badge>
                {t.phase && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {t.phase}
                  </Badge>
                )}
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</p>
              )}
              {t.comment && (
                <p className="text-xs text-muted-foreground mt-1 italic">💬 {t.comment}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {t.due_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(t.due_date), "d MMM yyyy", { locale: fr })}
                  </span>
                )}
                <span>Créée le {format(new Date(t.created_at), "d MMM", { locale: fr })}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTask(t)} aria-label="Modifier">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Supprimer cette tâche ?")) {
                    del.mutate({ id: t.id, etablissement_id: t.etablissement_id });
                  }
                }} aria-label="Supprimer">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="deploiement">Déploiement</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle tâche
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Côté OpenPulse
              <Badge variant="secondary" className="ml-auto">{marqueTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : marqueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune tâche</p>
            ) : (
              marqueTasks.map(renderTask)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Côté Établissement
              <Badge variant="secondary" className="ml-auto">{etabTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : etabTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune tâche</p>
            ) : (
              etabTasks.map(renderTask)
            )}
          </CardContent>
        </Card>
      </div>

      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        etablissementId={etablissementId}
        defaultAssignee="etablissement"
      />
      <TaskFormDialog
        open={!!editTask}
        onOpenChange={(v) => !v && setEditTask(null)}
        etablissementId={etablissementId}
        task={editTask}
      />
    </div>
  );
}
