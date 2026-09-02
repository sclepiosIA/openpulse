import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Mail, Phone, User, Edit, Trash2, Loader2, AlertTriangle, Sparkles, Users } from "lucide-react"
import { useContacts, type Contact } from "@/hooks/crm/useContacts"
import { CallButton } from "@/components/cti/CallButton"
import { useCallContext } from "@/contexts/CallContext"
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types'
import { ContactForm } from "@/components/forms/ContactForm"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ContactFieldBadge } from "@/components/contacts/ContactFieldBadge"

interface EtablissementContactsProps {
  etablissementId: string
}

export function EtablissementContacts({ etablissementId }: EtablissementContactsProps) {
  const navigate = useNavigate()
  const { startCall } = useCallContext()
  const { contacts, isLoading, error, addContact, updateContact, deleteContact, assignToGroup } = useContacts(etablissementId)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const navigateToCompose = (email: string, name?: string) => {
    const params = new URLSearchParams({ compose: 'true', to: email })
    if (name) params.set('toName', name)
    navigate(`/emails?${params.toString()}`)
  }

  const getTypeContactBadge = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case "cliniciens":
        return <Badge className="bg-blue-500 text-white">Cliniciens</Badge>
      case "administration":
        return <Badge className="bg-purple-500 text-white">Administration</Badge>
      case "informatique":
        return <Badge className="bg-green-500 text-white">Informatique</Badge>
      case "dim":
        return <Badge className="bg-orange-500 text-white">DIM</Badge>
      case "secretariat":
        return <Badge className="bg-pink-500 text-white">Secrétariat</Badge>
      default:
        return <Badge variant="outline">Autre</Badge>
    }
  }

  const handleAddContact = async (data: Omit<TablesInsert<'contacts'>, 'etablissement_id'>) => {
    setIsSubmitting(true)
    try {
      await addContact(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateContact = async (data: Omit<TablesInsert<'contacts'>, 'etablissement_id'>) => {
    if (!editingContact) return
    setIsSubmitting(true)
    try {
      await updateContact(editingContact.id, data as TablesUpdate<'contacts'>)
      setEditingContact(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteContact = async () => {
    if (!deletingContact) return
    setIsSubmitting(true)
    try {
      await deleteContact(deletingContact.id)
      setDeletingContact(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssignToGroup = async (contactId: string) => {
    setIsSubmitting(true)
    try {
      await assignToGroup(contactId)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Impossible de charger les contacts. Vérifiez vos permissions ou contactez un administrateur.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Contacts</h3>
          <p className="text-sm text-muted-foreground">
            {contacts.length} contact{contacts.length > 1 ? 's' : ''} enregistré{contacts.length > 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Aucun contact</CardTitle>
            <CardDescription className="text-center mb-4">
              Commencez par ajouter les contacts de cet établissement pour faciliter la communication.
            </CardDescription>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter le premier contact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Liste des contacts</CardTitle>
            <CardDescription>
              Gérez les contacts de cet établissement
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Fonction</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">
                            {contact.prenom} {contact.nom}
                          </div>
                          {contact.created_source === 'email_ai' && (
                            <Badge variant="secondary" className="ml-1">
                              <Sparkles className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          )}
                          {contact.latest_source && ['email', 'fhf', 'linkedin', 'manual'].includes(contact.latest_source) && (
                            <ContactFieldBadge 
                              source={contact.latest_source as 'email' | 'fhf' | 'linkedin' | 'manual'}
                              updatedAt={contact.latest_update}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{contact.fonction}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => navigateToCompose(contact.email!, `${contact.prenom || ''} ${contact.nom}`.trim())}
                                className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer"
                              >
                                <Mail className="w-3 h-3" />
                                <span className="underline">{contact.email}</span>
                              </button>
                            </div>
                          )}
                          {contact.telephone && (
                            <div className="flex items-center gap-2">
                              <CallButton
                                phoneNumber={contact.telephone}
                                displayName={`${contact.prenom || ''} ${contact.nom}`.trim() || contact.telephone}
                                contactId={contact.id}
                                etablissementId={etablissementId}
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-primary"
                                label={contact.telephone}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTypeContactBadge(contact.type_contact)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {contact.email && (
                              <DropdownMenuItem onClick={() => navigateToCompose(contact.email!, `${contact.prenom || ''} ${contact.nom}`.trim())}>
                                <Mail className="w-4 h-4 mr-2" />
                                Envoyer un email
                              </DropdownMenuItem>
                            )}
                            {contact.telephone && (
                              <DropdownMenuItem onClick={() => startCall({
                                phoneNumber: contact.telephone!,
                                displayName: `${contact.prenom || ''} ${contact.nom}`.trim(),
                                contactId: contact.id,
                                etablissementId,
                              })}>
                                <Phone className="w-4 h-4 mr-2" />
                                Appeler
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleAssignToGroup(contact.id)}>
                              <Users className="w-4 h-4 mr-2" />
                              Attribuer au groupe
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeletingContact(contact)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-4">
              {contacts.map((contact) => (
                <Card key={contact.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="font-medium">
                          {contact.prenom} {contact.nom}
                        </h4>
                        {contact.created_source === 'email_ai' && (
                          <Badge variant="secondary">
                            <Sparkles className="h-3 w-3 mr-1" />
                            IA
                          </Badge>
                        )}
                        {getTypeContactBadge(contact.type_contact)}
                        {contact.latest_source && ['email', 'fhf', 'linkedin', 'manual'].includes(contact.latest_source) && (
                          <ContactFieldBadge 
                            source={contact.latest_source as 'email' | 'fhf' | 'linkedin' | 'manual'}
                            updatedAt={contact.latest_update}
                          />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {contact.fonction}
                      </p>
                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <button
                              onClick={() => navigateToCompose(contact.email!, `${contact.prenom || ''} ${contact.nom}`.trim())}
                              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer"
                            >
                              <Mail className="w-3 h-3" />
                              <span className="underline">{contact.email}</span>
                            </button>
                          </div>
                        )}
                        {contact.telephone && (
                          <div className="flex items-center gap-1 text-sm">
                            <CallButton
                              phoneNumber={contact.telephone}
                              displayName={`${contact.prenom || ''} ${contact.nom}`.trim() || contact.telephone}
                              contactId={contact.id}
                              etablissementId={etablissementId}
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-primary"
                              label={contact.telephone}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {contact.email && (
                          <DropdownMenuItem onClick={() => navigateToCompose(contact.email!, `${contact.prenom || ''} ${contact.nom}`.trim())}>
                            <Mail className="w-4 h-4 mr-2" />
                            Envoyer un email
                          </DropdownMenuItem>
                        )}
                        {contact.telephone && (
                          <DropdownMenuItem onClick={() => startCall({
                            phoneNumber: contact.telephone!,
                            displayName: `${contact.prenom || ''} ${contact.nom}`.trim(),
                            contactId: contact.id,
                            etablissementId,
                          })}>
                            <Phone className="w-4 h-4 mr-2" />
                            Appeler
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleAssignToGroup(contact.id)}>
                          <Users className="w-4 h-4 mr-2" />
                          Attribuer au groupe
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeletingContact(contact)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Contact Form */}
      <ContactForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAddContact}
        isLoading={isSubmitting}
      />

      {/* Edit Contact Form */}
      <ContactForm
        isOpen={!!editingContact}
        onClose={() => setEditingContact(null)}
        onSubmit={handleUpdateContact}
        onUpdate={handleUpdateContact}
        contact={editingContact || undefined}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingContact} onOpenChange={(open) => !open && setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le contact</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le contact "{deletingContact?.prenom} {deletingContact?.nom}" ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
