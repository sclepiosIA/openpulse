import { useEffect } from "react"
import { debug } from "@/lib/debug"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import type { PartenaireContact } from "@/hooks/crm/usePartenairesContacts"

const partenaireContactSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().optional().or(z.literal("")),
  fonction: z.string().optional().or(z.literal("")),
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")).refine(
    (val) => !val || val.length === 0 || z.string().email().safeParse(val).success,
    "Format d'email invalide"
  ),
  telephone: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  est_contact_principal: z.boolean().default(false)
})

type PartenaireContactFormData = z.infer<typeof partenaireContactSchema>

interface PartenaireContactFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PartenaireContactFormData) => Promise<void>
  onUpdate?: (data: PartenaireContactFormData) => Promise<void>
  contact?: PartenaireContact
  isLoading?: boolean
}

export function PartenaireContactForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onUpdate, 
  contact, 
  isLoading = false 
}: PartenaireContactFormProps) {
  const isEditing = !!contact

  const form = useForm<PartenaireContactFormData>({
    resolver: zodResolver(partenaireContactSchema),
    defaultValues: {
      nom: contact?.nom || "",
      prenom: contact?.prenom || "",
      fonction: contact?.fonction || "",
      email: contact?.email || "",
      telephone: contact?.telephone || "",
      notes: contact?.notes || "",
      est_contact_principal: contact?.est_contact_principal || false
    }
  })

  useEffect(() => {
    if (contact && isOpen) {
      form.reset({
        nom: contact.nom || "",
        prenom: contact.prenom || "",
        fonction: contact.fonction || "",
        email: contact.email || "",
        telephone: contact.telephone || "",
        notes: contact.notes || "",
        est_contact_principal: contact.est_contact_principal || false
      })
    } else if (!contact && isOpen) {
      form.reset({
        nom: "",
        prenom: "",
        fonction: "",
        email: "",
        telephone: "",
        notes: "",
        est_contact_principal: false
      })
    }
  }, [contact, isOpen, form])

  const handleSubmit = async (data: PartenaireContactFormData) => {
    try {
      const contactData: PartenaireContactFormData = {
        ...data,
        nom: data.nom || "",
        prenom: data.prenom || undefined,
        fonction: data.fonction || undefined,
        email: data.email || undefined,
        telephone: data.telephone || undefined,
        notes: data.notes || undefined
      }

      if (isEditing && onUpdate) {
        await onUpdate(contactData)
      } else {
        await onSubmit(contactData)
      }
      
      onClose()
      
      setTimeout(() => {
        form.reset()
      }, 150)
    } catch (error) {
      debug.error('Error saving contact:', error)
    }
  }

  const handleClose = () => {
    onClose()
    
    setTimeout(() => {
      form.reset()
    }, 150)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le contact" : "Ajouter un contact"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Modifier les informations du contact" 
              : "Ajouter un nouveau contact pour ce partenaire"
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Dupont" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="Jean" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="fonction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fonction</FormLabel>
                  <FormControl>
                    <Input placeholder="Directeur commercial" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="01 99 00 12 34" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notes additionnelles..."
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="est_contact_principal"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Contact principal
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Marquer comme contact principal pour ce partenaire
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
