import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Calendar, Upload, Download, Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { DossierRH } from '@/hooks/tasks/useOnboardingOffboarding'
import {
  useRHOnboardingDocuments,
  useUploadRHOnboardingDocument,
  useDeleteRHOnboardingDocument,
  downloadRHOnboardingDocument,
} from '@/hooks/hr/useRHOnboardingDocuments'

interface DossierRHChecklistProps {
  dossier: DossierRH
  onUpdate: (dossier: DossierRH) => void
  profileId: string
  onboardingId?: string | null
}

const DOSSIER_ITEMS = [
  { key: 'cv', label: 'CV', hasRef: true, hasType: false, hasOrganisme: false },
  { key: 'contrat', label: 'Contrat de travail', hasRef: true, hasType: true, hasOrganisme: false },
  { key: 'mutuelle', label: 'Mutuelle', hasRef: true, hasType: false, hasOrganisme: true },
  {
    key: 'charte',
    label: 'Charte informatique',
    hasRef: false,
    hasType: false,
    hasOrganisme: false,
  },
  {
    key: 'solde_tout_compte',
    label: 'Solde de tout compte',
    hasRef: false,
    hasType: false,
    hasOrganisme: false,
  },
]

export function DossierRHChecklist({
  dossier,
  onUpdate,
  profileId,
  onboardingId,
}: DossierRHChecklistProps) {
  const [editedDossier, setEditedDossier] = useState(dossier)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [newAutreLabel, setNewAutreLabel] = useState('')
  const [newAutreDescription, setNewAutreDescription] = useState('')
  const [showAddAutre, setShowAddAutre] = useState(false)

  const { data: documents = [] } = useRHOnboardingDocuments(profileId)
  const uploadDocument = useUploadRHOnboardingDocument()
  const deleteDocument = useDeleteRHOnboardingDocument()

  const handleCheckboxChange = (key: string, checked: boolean) => {
    const updated = {
      ...editedDossier,
      [key]: {
        ...editedDossier[key as keyof DossierRH],
        status: checked,
        date: checked ? new Date().toISOString().split('T')[0] : null,
      },
    }
    setEditedDossier(updated)
    onUpdate(updated)
  }

  const handleFieldChange = (key: string, field: string, value: string) => {
    const updated = {
      ...editedDossier,
      [key]: {
        ...editedDossier[key as keyof DossierRH],
        [field]: value,
      },
    }
    setEditedDossier(updated)
    onUpdate(updated)
  }

  const handleFileUpload = async (documentType: string, file: File, documentLabel?: string) => {
    setUploadingFor(documentType)
    try {
      await uploadDocument.mutateAsync({
        file,
        profileId,
        onboardingId,
        documentType,
        documentLabel,
      })
    } finally {
      setUploadingFor(null)
    }
  }

  const handleFileDelete = async (docId: string, cheminFichier: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      await deleteDocument.mutateAsync({ id: docId, cheminFichier, profileId })
    }
  }

  const handleAddAutre = () => {
    if (!newAutreLabel.trim()) {
      toast.error('Veuillez saisir un titre pour le document')
      return
    }

    const updated = {
      ...editedDossier,
      autre: [
        ...(editedDossier.autre || []),
        { label: newAutreLabel, description: newAutreDescription },
      ],
    }
    setEditedDossier(updated)
    onUpdate(updated)
    setNewAutreLabel('')
    setNewAutreDescription('')
    setShowAddAutre(false)
  }

  const handleRemoveAutre = (index: number) => {
    const updated = {
      ...editedDossier,
      autre: editedDossier.autre?.filter((_, i) => i !== index) || [],
    }
    setEditedDossier(updated)
    onUpdate(updated)
  }

  const getDocumentsForType = (type: string, label?: string) => {
    if (type === 'autre' && label) {
      return documents.filter((d) => d.document_type === type && d.document_label === label)
    }
    return documents.filter((d) => d.document_type === type)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Dossier RH
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {DOSSIER_ITEMS.map((item) => {
          const itemData = editedDossier[item.key as keyof DossierRH]
          // Vérifier que ce n'est pas la propriété "autre" (qui est un tableau)
          if (item.key === 'autre' || Array.isArray(itemData)) return null

          const isChecked = itemData?.status === true

          return (
            <div key={item.key} className="space-y-2 pb-4 border-b last:border-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={item.key}
                  checked={isChecked}
                  onCheckedChange={(checked) => handleCheckboxChange(item.key, checked as boolean)}
                />
                <Label htmlFor={item.key} className="font-medium cursor-pointer">
                  {item.label}
                </Label>
              </div>

              {isChecked && (
                <div className="ml-6 space-y-2">
                  {item.hasRef && (
                    <div className="grid grid-cols-4 items-center gap-2">
                      <Label htmlFor={`${item.key}-ref`} className="text-sm text-muted-foreground">
                        Référence
                      </Label>
                      <Input
                        id={`${item.key}-ref`}
                        value={(itemData as any)?.ref || ''}
                        onChange={(e) => handleFieldChange(item.key, 'ref', e.target.value)}
                        className="col-span-3"
                        placeholder="Numéro de référence"
                      />
                    </div>
                  )}

                  {item.hasType && (
                    <div className="grid grid-cols-4 items-center gap-2">
                      <Label htmlFor={`${item.key}-type`} className="text-sm text-muted-foreground">
                        Type
                      </Label>
                      <Input
                        id={`${item.key}-type`}
                        value={(itemData as any)?.type || ''}
                        onChange={(e) => handleFieldChange(item.key, 'type', e.target.value)}
                        className="col-span-3"
                        placeholder="CDI, CDD, etc."
                      />
                    </div>
                  )}

                  {item.hasOrganisme && (
                    <div className="grid grid-cols-4 items-center gap-2">
                      <Label
                        htmlFor={`${item.key}-organisme`}
                        className="text-sm text-muted-foreground"
                      >
                        Organisme
                      </Label>
                      <Input
                        id={`${item.key}-organisme`}
                        value={(itemData as any)?.organisme || ''}
                        onChange={(e) => handleFieldChange(item.key, 'organisme', e.target.value)}
                        className="col-span-3"
                        placeholder="Nom de l'organisme"
                      />
                    </div>
                  )}

                  {itemData && 'date' in itemData && itemData.date && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Reçu le {new Date(itemData.date).toLocaleDateString('fr-FR')}
                    </div>
                  )}

                  {/* Section upload et documents */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Pièces jointes</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={uploadingFor === item.key}
                        onClick={() => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (file) handleFileUpload(item.key, file)
                          }
                          input.click()
                        }}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        {uploadingFor === item.key ? 'Upload...' : 'Ajouter'}
                      </Button>
                    </div>

                    {/* Liste des documents */}
                    <div className="space-y-1">
                      {getDocumentsForType(item.key).map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded text-xs"
                        >
                          <span className="truncate flex-1">{doc.nom_fichier}</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() =>
                                downloadRHOnboardingDocument(doc.chemin_fichier, doc.nom_fichier)
                              }
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() => handleFileDelete(doc.id, doc.chemin_fichier)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {getDocumentsForType(item.key).length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Aucun document</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Section "Autre" */}
        <div className="pt-4 border-t space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Autres documents</Label>
            <Button size="sm" variant="outline" onClick={() => setShowAddAutre(!showAddAutre)}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>

          {showAddAutre && (
            <Card className="p-4 space-y-3 bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="autre-label">Titre du document *</Label>
                <Input
                  id="autre-label"
                  value={newAutreLabel}
                  onChange={(e) => setNewAutreLabel(e.target.value)}
                  placeholder="Ex: Attestation de formation, Certificat..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autre-description">Description (optionnel)</Label>
                <Textarea
                  id="autre-description"
                  value={newAutreDescription}
                  onChange={(e) => setNewAutreDescription(e.target.value)}
                  placeholder="Informations complémentaires..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddAutre}>
                  Ajouter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddAutre(false)
                    setNewAutreLabel('')
                    setNewAutreDescription('')
                  }}
                >
                  Annuler
                </Button>
              </div>
            </Card>
          )}

          {/* Liste des documents "Autre" */}
          <div className="space-y-3">
            {editedDossier.autre?.map((autreItem, index) => (
              <div
                key={`autre-${index}-${autreItem.label ?? ''}`}
                className="space-y-2 p-3 border rounded"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{autreItem.label}</div>
                    {autreItem.description && (
                      <p className="text-xs text-muted-foreground mt-1">{autreItem.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => handleRemoveAutre(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Upload pour documents "autre" */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={uploadingFor === `autre_${index}`}
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) handleFileUpload('autre', file, autreItem.label)
                        }
                        input.click()
                      }}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {uploadingFor === `autre_${index}` ? 'Upload...' : 'Ajouter fichier'}
                    </Button>
                  </div>

                  {/* Liste des fichiers */}
                  <div className="space-y-1">
                    {getDocumentsForType('autre', autreItem.label).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded text-xs"
                      >
                        <span className="truncate flex-1">{doc.nom_fichier}</span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              downloadRHOnboardingDocument(doc.chemin_fichier, doc.nom_fichier)
                            }
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => handleFileDelete(doc.id, doc.chemin_fichier)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {getDocumentsForType('autre', autreItem.label).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Aucun document</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
