import { useState, useMemo } from "react";
import { debug } from "@/lib/debug";
import { Plus, Building2, Check, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEtablissements, useCreateEtablissement } from "@/hooks/crm/useEtablissements";
import { useAddEtablissementToGroupe } from "@/hooks/crm/useEtablissementGroupes";
import { Skeleton } from "@/components/ui/skeleton";
import { EtablissementForm } from '@/components/etablissement/EtablissementForm';
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles";
import { cn } from "@/lib/utils";
import type { Etablissement, CreateEtablissementData } from "@/hooks/crm/useEtablissements";

interface AddEtablissementToGroupeDialogProps {
  groupeId: string;
  existingEtablissementIds: string[];
}

export function AddEtablissementToGroupeDialog({
  groupeId,
  existingEtablissementIds,
}: AddEtablissementToGroupeDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"select" | "create">("select");
  const [selectedEtablissementId, setSelectedEtablissementId] = useState<string>("");
  const [estPrincipal, setEstPrincipal] = useState(false);
  const [roleGroupe, setRoleGroupe] = useState<string>("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: etablissements, isLoading } = useEtablissements();
  const { data: allProfiles } = useProfilesWithRoles();
  const createEtablissement = useCreateEtablissement();
  const addMutation = useAddEtablissementToGroupe();

  // Form for creating new establishment
  const form = useForm<CreateEtablissementData>({
    defaultValues: {
      nom: "",
      type: "CH",
      ville: "",
      region: "",
      statut: "Prospect",
      date_prise_contact: new Date().toISOString().split('T')[0],
    }
  });

  // Filter out establishments already in the group
  const availableEtablissements = etablissements?.filter(
    (etab: Etablissement) => !existingEtablissementIds.includes(etab.id)
  ) || [];

  // Filter establishments based on search query for combobox
  const filteredEtablissements = useMemo(() => {
    if (!searchQuery.trim()) return availableEtablissements.slice(0, 50);
    const query = searchQuery.toLowerCase();
    return availableEtablissements
      .filter((etab: Etablissement) =>
        etab.nom.toLowerCase().includes(query) ||
        etab.ville?.toLowerCase().includes(query) ||
        etab.type?.toLowerCase().includes(query)
      )
      .slice(0, 50);
  }, [availableEtablissements, searchQuery]);

  const handleAdd = async () => {
    if (!selectedEtablissementId) return;

    await addMutation.mutateAsync({
      etablissement_id: selectedEtablissementId,
      groupe_id: groupeId,
      est_etablissement_principal: estPrincipal,
      role_dans_groupe: roleGroupe || undefined,
    });

    setOpen(false);
    setSelectedEtablissementId("");
    setEstPrincipal(false);
    setRoleGroupe("");
  };

  const handleCreate = async (data: CreateEtablissementData) => {
    try {
      // 1. Create the establishment
      const newEtab = await createEtablissement.mutateAsync(data);
      
      // 2. Add it to the group automatically
      if (newEtab?.id) {
        await addMutation.mutateAsync({
          etablissement_id: newEtab.id,
          groupe_id: groupeId,
          est_etablissement_principal: false,
          role_dans_groupe: undefined,
        });
      }
      
      // 3. Reset and close
      form.reset();
      setOpen(false);
      setActiveTab("select");
    } catch (error) {
      debug.error('Erreur lors de la création:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un établissement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un établissement au groupe</DialogTitle>
          <DialogDescription>
            Sélectionnez un établissement existant ou créez-en un nouveau
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "select" | "create")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Sélectionner</TabsTrigger>
            <TabsTrigger value="create">Créer nouveau</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : availableEtablissements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Tous les établissements sont déjà dans ce groupe
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Établissement * ({availableEtablissements.length} disponibles)</Label>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedEtablissementId
                          ? availableEtablissements.find((e: Etablissement) => e.id === selectedEtablissementId)?.nom
                          : "Rechercher un établissement..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Rechercher par nom, ville ou type..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>Aucun établissement trouvé</CommandEmpty>
                          <CommandGroup>
                            {filteredEtablissements.map((etab: Etablissement) => (
                              <CommandItem
                                key={etab.id}
                                value={etab.id}
                                onSelect={() => {
                                  setSelectedEtablissementId(etab.id);
                                  setComboboxOpen(false);
                                  setSearchQuery("");
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedEtablissementId === etab.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{etab.nom}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {etab.ville} - {etab.type}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Tapez pour rechercher parmi les {availableEtablissements.length} établissements
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rôle dans le groupe (optionnel)</Label>
                  <Select value={roleGroupe} onValueChange={setRoleGroupe}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Aucun rôle spécifique" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="membre">Membre</SelectItem>
                      <SelectItem value="siege">Siège</SelectItem>
                      <SelectItem value="site_pilote">Site pilote</SelectItem>
                      <SelectItem value="antenne">Antenne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="principal"
                    checked={estPrincipal}
                    onCheckedChange={(checked) => setEstPrincipal(checked as boolean)}
                  />
                  <Label
                    htmlFor="principal"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Définir comme établissement principal du groupe
                  </Label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={!selectedEtablissementId || addMutation.isPending}
                  >
                    {addMutation.isPending ? "Ajout..." : "Ajouter"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="create">
            <EtablissementForm
              form={form}
              onSubmit={handleCreate}
              onCancel={() => setOpen(false)}
              submitLabel="Créer et ajouter au groupe"
              isLoading={createEtablissement.isPending || addMutation.isPending}
              allProfiles={allProfiles}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
