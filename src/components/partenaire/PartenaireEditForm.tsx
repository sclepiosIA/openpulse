import { useForm } from "react-hook-form"
import { debug } from "@/lib/debug"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUpdatePartenaire, Partenaire } from "@/hooks/crm/usePartenaires"
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles"
import { PartenaireForm } from '@/components/partenaire/PartenaireForm'
import { UpdatePartenaireSchema, CreatePartenaireData } from '@/lib/validations'
import { useEffect, useState } from "react"
import { EntityLogoUpload } from "@/components/ui/EntityLogoUpload"
import { useQueryClient } from "@tanstack/react-query"

interface PartenaireEditFormProps {
  partenaire: Partenaire | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PartenaireEditForm({ partenaire, open, onOpenChange }: PartenaireEditFormProps) {
  const { data: allProfiles } = useProfilesWithRoles()
  const updatePartenaire = useUpdatePartenaire()
  const queryClient = useQueryClient()
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null)
  
  const form = useForm<CreatePartenaireData>({
    resolver: zodResolver(UpdatePartenaireSchema),
    defaultValues: {
      nom: "",
      type_partenaire: "institutionnel",
      logo_url: "",
      sous_type: "",
      adresse: "",
      code_postal: "",
      ville: "",
      region: "",
      pays: "France",
      telephone: "",
      email: "",
      site_web: "",
      email_domains: [],
      statut_relation: "prospect",
      date_debut_partenariat: "",
      date_fin_partenariat: "",
      responsable_marque_id: "",
      engagement_score: 0,
      dernier_contact: "",
      prochaine_action: "",
      valeur_partenariat: undefined,
      notes: "",
      tags: [],
    }
  })

  // Remplir le formulaire avec les données du partenaire
  useEffect(() => {
    if (partenaire) {
      setCurrentLogoUrl(partenaire.logo_url || null)
      form.reset({
        nom: partenaire.nom,
        type_partenaire: partenaire.type_partenaire,
        logo_url: partenaire.logo_url || "",
        sous_type: partenaire.sous_type || "",
        adresse: partenaire.adresse || "",
        code_postal: partenaire.code_postal || "",
        ville: partenaire.ville || "",
        region: partenaire.region || "",
        pays: partenaire.pays || "France",
        telephone: partenaire.telephone || "",
        email: partenaire.email || "",
        site_web: partenaire.site_web || "",
        email_domains: partenaire.email_domains || [],
        statut_relation: partenaire.statut_relation,
        date_debut_partenariat: partenaire.date_debut_partenariat || "",
        date_fin_partenariat: partenaire.date_fin_partenariat || "",
        responsable_marque_id: partenaire.responsable_marque_id || "",
        engagement_score: partenaire.engagement_score,
        dernier_contact: partenaire.dernier_contact || "",
        prochaine_action: partenaire.prochaine_action || "",
        valeur_partenariat: partenaire.valeur_partenariat || undefined,
        notes: partenaire.notes || "",
        tags: partenaire.tags || [],
      })
    }
  }, [partenaire, form])

  const handleLogoChange = (newUrl: string | null) => {
    setCurrentLogoUrl(newUrl)
    // Invalider le cache pour rafraîchir les données
    queryClient.invalidateQueries({ queryKey: ['partenaire', partenaire?.id] })
  }

  const onSubmit = async (data: CreatePartenaireData) => {
    if (!partenaire) return
    
    try {
      await updatePartenaire.mutateAsync({
        id: partenaire.id,
        ...data,
        logo_url: data.logo_url === "" ? null : data.logo_url,
        responsable_marque_id: data.responsable_marque_id === "" || data.responsable_marque_id === "none" ? null : data.responsable_marque_id,
        date_debut_partenariat: data.date_debut_partenariat === "" ? null : data.date_debut_partenariat,
        date_fin_partenariat: data.date_fin_partenariat === "" ? null : data.date_fin_partenariat,
        dernier_contact: data.dernier_contact === "" ? null : data.dernier_contact,
        prochaine_action: data.prochaine_action === "" ? null : data.prochaine_action,
        email: data.email === "" ? null : data.email,
        site_web: data.site_web === "" ? null : data.site_web,
        sous_type: data.sous_type === "" ? null : data.sous_type,
        adresse: data.adresse === "" ? null : data.adresse,
        code_postal: data.code_postal === "" ? null : data.code_postal,
        ville: data.ville === "" ? null : data.ville,
        region: data.region === "" ? null : data.region,
        telephone: data.telephone === "" ? null : data.telephone,
        notes: data.notes === "" ? null : data.notes,
        valeur_partenariat: data.valeur_partenariat || null,
      })
      
      onOpenChange(false)
    } catch (error) {
      debug.error('Error updating partenaire:', error)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le partenaire</DialogTitle>
          <DialogDescription>
            Modifiez les informations du partenaire
          </DialogDescription>
        </DialogHeader>

        {/* Logo upload section */}
        {partenaire && (
          <div className="flex items-center gap-4 pb-4 border-b">
            <EntityLogoUpload
              entityType="partenaire"
              entityId={partenaire.id}
              entityName={partenaire.nom}
              currentLogoUrl={currentLogoUrl}
              onLogoChange={handleLogoChange}
              size="lg"
            />
            <div>
              <p className="text-sm font-medium">Logo du partenaire</p>
              <p className="text-xs text-muted-foreground">
                Cliquez sur l'avatar pour modifier le logo (max 2 Mo)
              </p>
            </div>
          </div>
        )}

        <PartenaireForm
          form={form}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          submitLabel="Enregistrer les modifications"
          isLoading={updatePartenaire.isPending}
          allProfiles={allProfiles}
        />
      </DialogContent>
    </Dialog>
  )
}
