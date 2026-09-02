import { UseFormReturn } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EtablissementForm } from "@/components/etablissement/EtablissementForm";
import { ImportEtablissements } from "@/components/etablissement/ImportEtablissements";
import type { CreateEtablissementData } from "@/hooks/crm/useEtablissements";
import type { ProfileWithRole } from "@/hooks/profile/useProfilesWithRoles";

interface Props {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  createForm: UseFormReturn<CreateEtablissementData>;
  onCreate: (data: CreateEtablissementData) => Promise<void>;
  createPending: boolean;

  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  editForm: UseFormReturn<CreateEtablissementData>;
  onEdit: (data: CreateEtablissementData) => Promise<void>;
  editPending: boolean;

  importOpen: boolean;
  onImportOpenChange: (open: boolean) => void;

  allProfiles?: ProfileWithRole[];
}

export function EtablissementDialogs({
  createOpen, onCreateOpenChange, createForm, onCreate, createPending,
  editOpen, onEditOpenChange, editForm, onEdit, editPending,
  importOpen, onImportOpenChange,
  allProfiles,
}: Props) {
  return (
    <>
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel établissement</DialogTitle>
            <DialogDescription>Créer une fiche pour un nouveau client hospitalier</DialogDescription>
          </DialogHeader>
          <EtablissementForm
            form={createForm}
            onSubmit={onCreate}
            onCancel={() => onCreateOpenChange(false)}
            submitLabel="Créer"
            isLoading={createPending}
            allProfiles={allProfiles}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'établissement</DialogTitle>
            <DialogDescription>Modifier les informations de l'établissement</DialogDescription>
          </DialogHeader>
          <EtablissementForm
            form={editForm}
            onSubmit={onEdit}
            onCancel={() => onEditOpenChange(false)}
            submitLabel="Enregistrer"
            isLoading={editPending}
            allProfiles={allProfiles}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={onImportOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import d'établissements</DialogTitle>
            <DialogDescription>Importez vos établissements depuis un fichier CSV</DialogDescription>
          </DialogHeader>
          <ImportEtablissements />
        </DialogContent>
      </Dialog>
    </>
  );
}
