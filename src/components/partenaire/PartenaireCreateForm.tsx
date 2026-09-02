import { useForm } from "react-hook-form"
import { debug } from "@/lib/debug"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreatePartenaire } from "@/hooks/crm/usePartenaires"
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles"
import { PartenaireForm } from '@/components/partenaire/PartenaireForm'
import { CreatePartenaireSchema, CreatePartenaireData } from '@/lib/validations'

interface PartenaireCreateFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDomain?: string
}

export function PartenaireCreateForm({ open, onOpenChange, initialDomain }: PartenaireCreateFormProps) {
  const { data: allProfiles } = useProfilesWithRoles()
  const createPartenaire = useCreatePartenaire()
  
  const form = useForm<CreatePartenaireData>({
    resolver: zodResolver(CreatePartenaireSchema),
    defaultValues: {
      nom: "",
      type_partenaire: "institutionnel",
      sous_type: "",
      adresse: "",
      code_postal: "",
      ville: "",
      region: "",
      pays: "France",
      telephone: "",
      email: "",
      site_web: "",
      email_domains: initialDomain ? [initialDomain] : [],
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

  const onSubmit = async (data: CreatePartenaireData) => {
    try {
      await createPartenaire.mutateAsync({
        ...data,
        email_domains: initialDomain ? [initialDomain] : (data.email_domains || []),
        responsable_marque_id: data.responsable_marque_id === "" || data.responsable_marque_id === "none" ? undefined : data.responsable_marque_id,
        date_debut_partenariat: data.date_debut_partenariat === "" ? undefined : data.date_debut_partenariat,
        date_fin_partenariat: data.date_fin_partenariat === "" ? undefined : data.date_fin_partenariat,
        dernier_contact: data.dernier_contact === "" ? undefined : data.dernier_contact,
        prochaine_action: data.prochaine_action === "" ? undefined : data.prochaine_action,
        email: data.email === "" ? undefined : data.email,
        site_web: data.site_web === "" ? undefined : data.site_web,
        sous_type: data.sous_type === "" ? undefined : data.sous_type,
        adresse: data.adresse === "" ? undefined : data.adresse,
        code_postal: data.code_postal === "" ? undefined : data.code_postal,
        ville: data.ville === "" ? undefined : data.ville,
        region: data.region === "" ? undefined : data.region,
        telephone: data.telephone === "" ? undefined : data.telephone,
        notes: data.notes === "" ? undefined : data.notes,
      })
      
      form.reset()
      onOpenChange(false)
    } catch (error) {
      debug.error('Error creating partenaire:', error)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau partenaire</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau partenaire institutionnel, industriel ou prestataire
          </DialogDescription>
        </DialogHeader>

        <PartenaireForm
          form={form}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          submitLabel="Créer le partenaire"
          isLoading={createPartenaire.isPending}
          allProfiles={allProfiles}
        />
      </DialogContent>
    </Dialog>
  )
}
