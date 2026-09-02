import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClientPortalTask,
  ClientPortalTaskAssignee,
  ClientPortalTaskStatus,
  useCreateClientPortalTask,
  useUpdateClientPortalTask,
} from "@/hooks/portail/useClientPortalTasks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  etablissementId: string;
  task?: ClientPortalTask | null;
  defaultAssignee?: ClientPortalTaskAssignee;
}

export function TaskFormDialog({ open, onOpenChange, etablissementId, task, defaultAssignee = "etablissement" }: Props) {
  const isEdit = !!task;
  const create = useCreateClientPortalTask();
  const update = useUpdateClientPortalTask();
  const pending = create.isPending || update.isPending;

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<ClientPortalTaskAssignee>(defaultAssignee);
  const [phase, setPhase] = useState<"deploiement" | "production" | "none">("none");
  const [statut, setStatut] = useState<ClientPortalTaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) {
      setTitre(task?.titre ?? "");
      setDescription(task?.description ?? "");
      setAssignee(task?.assignee ?? defaultAssignee);
      setPhase((task?.phase as any) ?? "none");
      setStatut(task?.statut ?? "todo");
      setDueDate(task?.due_date ?? "");
      setComment(task?.comment ?? "");
    }
  }, [open, task, defaultAssignee]);

  const handleSubmit = async () => {
    if (!titre.trim()) return;
    const payload = {
      etablissement_id: etablissementId,
      titre: titre.trim(),
      description: description.trim() || null,
      assignee,
      phase: phase === "none" ? null : phase,
      due_date: dueDate || null,
      comment: comment.trim() || null,
      statut,
    };
    try {
      if (isEdit && task) {
        await update.mutateAsync({ id: task.id, patch: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      /* toast handled */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la tâche" : "Nouvelle tâche portail client"}</DialogTitle>
          <DialogDescription>
            Tâche échangée entre OpenPulse et l'établissement, visible dans l'espace client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpt-titre">Titre *</Label>
            <Input id="cpt-titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Transmettre la liste des utilisateurs" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpt-desc">Description</Label>
            <Textarea id="cpt-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Assigné à</Label>
              <Select value={assignee} onValueChange={(v) => setAssignee(v as ClientPortalTaskAssignee)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="etablissement">Établissement</SelectItem>
                  <SelectItem value="marque">OpenPulse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phase</Label>
              <Select value={phase} onValueChange={(v) => setPhase(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  <SelectItem value="deploiement">Déploiement</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v as ClientPortalTaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpt-due">Échéance</Label>
              <Input id="cpt-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpt-comment">Commentaire</Label>
            <Textarea id="cpt-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={pending || !titre.trim()}>
            {pending ? "..." : isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
