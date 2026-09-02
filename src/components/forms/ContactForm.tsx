import { useEffect, useRef, useCallback } from "react"
import { debug } from "@/lib/debug"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { Contact } from "@/hooks/crm/useContacts"

const contactSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().optional().or(z.literal("")),
  fonction: z.string().min(1, "La fonction est requise"),
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")).refine(
    (val) => !val || val.length === 0 || z.string().email().safeParse(val).success,
    "Format d'email invalide"
  ),
  telephone: z.string().optional().or(z.literal("")),
  type_contact: z.string().optional().or(z.literal("")),
  est_contact_principal: z.boolean().default(false)
})

type ContactFormData = z.infer<typeof contactSchema>

interface ContactFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ContactFormData) => Promise<void>
  onUpdate?: (data: ContactFormData) => Promise<void>
  contact?: Contact
  isLoading?: boolean
}

export function ContactForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onUpdate, 
  contact, 
  isLoading = false 
}: ContactFormProps) {
  const isEditing = !!contact
  // Track dialog state to prevent race conditions
  const isClosingRef = useRef(false)

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nom: contact?.nom || "",
      prenom: contact?.prenom || "",
      fonction: contact?.fonction || "",
      email: contact?.email || "",
      telephone: contact?.telephone || "",
      type_contact: contact?.type_contact || "",
      est_contact_principal: contact?.est_contact_principal || false
    }
  })

  // Pré-remplir le formulaire quand le contact change
  useEffect(() => {
    if (contact && isOpen) {
      form.reset({
        nom: contact.nom || "",
        prenom: contact.prenom || "",
        fonction: contact.fonction || "",
        email: contact.email || "",
        telephone: contact.telephone || "",
        type_contact: contact.type_contact || "",
        est_contact_principal: contact.est_contact_principal || false
      })
    }
  }, [contact, isOpen, form])

  const handleSubmit = async (data: ContactFormData) => {
    if (isClosingRef.current) return
    
    try {
      const contactData = {
        ...data,
        nom: data.nom || "",
        fonction: data.fonction || "",
        prenom: data.prenom || undefined,
        email: data.email || undefined,
        telephone: data.telephone || undefined,
        type_contact: data.type_contact || undefined
      }

      if (isEditing && onUpdate) {
        await onUpdate(contactData)
      } else {
        await onSubmit(contactData)
      }
      
      // Mark as closing to prevent double actions
      isClosingRef.current = true
      onClose()
    } catch (error) {
      if (import.meta.env.DEV) {
        debug.error('Error saving contact:', error)
      }
    }
  }

  // Safe close handler using onOpenChange pattern
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && !isClosingRef.current) {
      isClosingRef.current = true
      onClose()
    }
  }, [onClose])

  // Reset closing ref when dialog opens and reset form
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false
    } else {
      // Reset form when dialog fully closes (not during close animation)
      const timer = setTimeout(() => {
        form.reset({
          nom: "",
          prenom: "",
          fonction: "",
          email: "",
          telephone: "",
          type_contact: "",
          est_contact_principal: false
        })
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen, form])

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le contact" : "Ajouter un contact"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Modifier les informations du contact" 
              : "Ajouter un nouveau contact pour cet établissement"
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
                  <FormLabel>Fonction *</FormLabel>
                  <FormControl>
                    <Input placeholder="Directeur des systèmes d'information" {...field} />
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
              name="type_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de contact</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cliniciens">Cliniciens</SelectItem>
                      <SelectItem value="administration">Administration</SelectItem>
                      <SelectItem value="informatique">Informatique</SelectItem>
                      <SelectItem value="dim">DIM (Département d'Informatique Médicale)</SelectItem>
                      <SelectItem value="secretariat">Secrétariat</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
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