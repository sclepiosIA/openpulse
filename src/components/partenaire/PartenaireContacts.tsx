import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { linkify } from '@/lib/linkify'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Mail,
  Phone,
  User,
  Star,
  Sparkles,
  Check,
  X,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import {
  usePartenairesContacts,
  useCreatePartenaireContact,
  useUpdatePartenaireContact,
  useDeletePartenaireContact,
  PartenaireContact,
} from '@/hooks/crm/usePartenairesContacts'
import { usePendingContactsByPartenaire } from '@/hooks/crm/usePendingContactsByPartenaire'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PartenaireContactForm } from '@/components/forms/PartenaireContactForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface PartenaireContactsProps {
  partenaireId: string
}

export function PartenaireContacts({ partenaireId }: PartenaireContactsProps) {
  const navigate = useNavigate()
  const { contacts, isLoading } = usePartenairesContacts(partenaireId)
  const {
    pendingContacts,
    isLoading: isLoadingPending,
    approvePendingContact,
    rejectPendingContact,
    isApproving,
    isRejecting,
  } = usePendingContactsByPartenaire(partenaireId)
  const [showForm, setShowForm] = useState(false)
  const [hasShownNotification, setHasShownNotification] = useState(false)
  const [selectedContact, setSelectedContact] = useState<PartenaireContact | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<PartenaireContact | null>(null)

  const createContact = useCreatePartenaireContact()
  const updateContact = useUpdatePartenaireContact()
  const deleteContact = useDeletePartenaireContact()

  // Notification pour les nouveaux contacts détectés
  useEffect(() => {
    if (!isLoadingPending && pendingContacts.length > 0 && !hasShownNotification) {
      toast.success(
        `${pendingContacts.length} nouveau${pendingContacts.length > 1 ? 'x' : ''} contact${pendingContacts.length > 1 ? 's' : ''} détecté${pendingContacts.length > 1 ? 's' : ''} par I.A.`,
        {
          description: 'Vérifiez et validez les contacts en attente ci-dessous.',
          duration: 5000,
        }
      )
      setHasShownNotification(true)
    }
  }, [pendingContacts.length, isLoadingPending, hasShownNotification])

  const handleCreate = async (data: any) => {
    await createContact.mutateAsync({
      ...data,
      partenaire_id: partenaireId,
    })
    setShowForm(false)
  }

  const handleUpdate = async (data: any) => {
    if (!selectedContact) return
    await updateContact.mutateAsync({
      id: selectedContact.id,
      partenaire_id: partenaireId,
      ...data,
    })
    setShowForm(false)
    setSelectedContact(null)
  }

  const handleDelete = async () => {
    if (!contactToDelete) return
    await deleteContact.mutateAsync({
      id: contactToDelete.id,
      partenaire_id: partenaireId,
    })
    setDeleteConfirmOpen(false)
    setContactToDelete(null)
  }

  const openEditForm = (contact: PartenaireContact) => {
    setSelectedContact(contact)
    setShowForm(true)
  }

  const openDeleteDialog = (contact: PartenaireContact) => {
    setContactToDelete(contact)
    setDeleteConfirmOpen(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setSelectedContact(null)
  }

  if (isLoading) {
    return <div>Chargement...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Contacts ({contacts.length})
          {pendingContacts.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingContacts.length} en attente
            </Badge>
          )}
        </h3>
        <Button
          onClick={() => {
            setSelectedContact(null)
            setShowForm(true)
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un contact
        </Button>
      </div>

      {/* Contacts en attente de validation */}
      {pendingContacts.length > 0 && (
        <Card className="border-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              {pendingContacts.length} Contact{pendingContacts.length > 1 ? 's' : ''} détecté
              {pendingContacts.length > 1 ? 's' : ''} par l'IA
            </CardTitle>
            <CardDescription>
              Ces contacts ont été automatiquement détectés dans les emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingContacts.map((pc) => (
              <div
                key={pc.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-background"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {pc.extracted_data.prenom} {pc.extracted_data.nom}
                  </p>
                  {pc.extracted_data.email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Mail className="h-3 w-3" />
                      {pc.extracted_data.email}
                    </p>
                  )}
                  {pc.extracted_data.fonction && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {pc.extracted_data.fonction}
                    </p>
                  )}
                  <Badge variant="outline" className="text-xs mt-2">
                    Confiance: {Math.round((pc.confidence || 0) * 100)}%
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approvePendingContact(pc.id)}
                    disabled={isApproving || isRejecting}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectPendingContact(pc.id)}
                    disabled={isApproving || isRejecting}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Ignorer
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucun contact</p>
            <p className="text-sm text-muted-foreground mt-2">
              Commencez par ajouter un contact pour ce partenaire
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <Card key={contact.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      {contact.prenom} {contact.nom}
                      {contact.est_contact_principal && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                      {contact.created_source === 'email_ai' && (
                        <Badge variant="secondary">
                          <Sparkles className="h-3 w-3 mr-1" />
                          IA
                        </Badge>
                      )}
                    </CardTitle>
                    {contact.fonction && <CardDescription>{contact.fonction}</CardDescription>}
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.est_contact_principal && <Badge variant="secondary">Principal</Badge>}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditForm(contact)}
                      className="h-8 w-8"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(contact)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({ compose: 'true', to: contact.email! })
                        const name = `${contact.prenom || ''} ${contact.nom}`.trim()
                        if (name) params.set('toName', name)
                        navigate(`/emails?${params.toString()}`)
                      }}
                      className="hover:underline text-left"
                    >
                      {contact.email}
                    </button>
                  </div>
                )}
                {contact.telephone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.telephone}`} className="hover:underline">
                      {contact.telephone}
                    </a>
                  </div>
                )}
                {contact.notes && (
                  <p className="text-sm text-muted-foreground mt-2 pt-2 border-t whitespace-pre-wrap break-words">
                    {linkify(contact.notes)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PartenaireContactForm
        isOpen={showForm}
        onClose={closeForm}
        onSubmit={handleCreate}
        onUpdate={handleUpdate}
        contact={selectedContact || undefined}
        isLoading={createContact.isPending || updateContact.isPending}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le contact{' '}
              <strong>
                {contactToDelete?.prenom} {contactToDelete?.nom}
              </strong>{' '}
              ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteContact.isPending}
            >
              {deleteContact.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
