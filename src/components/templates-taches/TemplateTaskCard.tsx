import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pencil, Trash2, Clock, ToggleLeft, ToggleRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { ModeletTache } from "@/hooks/tasks/useModelesTaches"
import type { Category } from "@/hooks/catalogue/useCategories"
import { useUpdateModeleTache, useDeleteModeleTache } from "@/hooks/tasks/useModelesTaches"
import { EditTemplateDialog } from "./EditTemplateDialog"
import { cn } from "@/lib/utils"

interface TemplateTaskCardProps {
  modele: ModeletTache
  categories: Category[]
}

const priorityConfig = {
  low: { label: "Basse", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Moyenne", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  high: { label: "Haute", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" }
}

export function TemplateTaskCard({ modele, categories }: TemplateTaskCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  
  const updateModele = useUpdateModeleTache()
  const deleteModele = useDeleteModeleTache()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: modele.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleToggleActif = () => {
    updateModele.mutate({
      id: modele.id,
      data: { actif: !modele.actif }
    })
  }

  const handleDelete = () => {
    deleteModele.mutate(modele.id)
    setDeleteOpen(false)
  }

  const priority = priorityConfig[modele.priorite] || priorityConfig.medium

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
          isDragging && "opacity-50 shadow-lg",
          !modele.actif && "opacity-60"
        )}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded touch-none"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("font-medium", !modele.actif && "line-through")}>
              {modele.titre}
            </span>
            {modele.categorie && (
              <Badge 
                variant="outline" 
                style={{ 
                  borderColor: modele.categorie.couleur,
                  color: modele.categorie.couleur 
                }}
              >
                {modele.categorie.nom}
              </Badge>
            )}
            <Badge className={priority.className}>
              {priority.label}
            </Badge>
          </div>
          {modele.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {modele.description}
            </p>
          )}
          {modele.delai_jours !== undefined && modele.delai_jours > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>J+{modele.delai_jours}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleActif}
            title={modele.actif ? "Désactiver" : "Activer"}
            aria-label={modele.actif ? "Désactiver le modèle" : "Activer le modèle"}
          >
            {modele.actif ? (
              <ToggleRight className="h-5 w-5 text-green-600" />
            ) : (
              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditOpen(true)} aria-label="Modifier">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive" aria-label="Supprimer">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditTemplateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        modele={modele}
        categories={categories}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le template "{modele.titre}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
