import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProfilesMap } from '@/hooks/profile/useProfilesMap'
import { debug } from '@/lib/debug'
import {
  sanitizeFileName,
  normalizeMonthToDate,
  findProfileByName,
  type ParsedBulletinData,
  type BulletinUploadResult,
} from './bulkUploadBulletinsHelpers'
import { BulkUploadBulletinsResultRow } from './BulkUploadBulletinsResultRow'

interface BulkUploadBulletinsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted?: () => void
}

export function BulkUploadBulletinsDialog({
  open,
  onOpenChange,
  onCompleted,
}: BulkUploadBulletinsDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [results, setResults] = useState<BulletinUploadResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const { map: profilesMap } = useProfilesMap()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debug.log('📁 Files selected:', e.target.files?.length)
    if (e.target.files) {
      processFiles(Array.from(e.target.files))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    debug.log('📥 Files dropped:', e.dataTransfer.files.length)
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const processFiles = (allFiles: File[]) => {
    const files = allFiles.filter((f) => f.type === 'application/pdf')

    debug.log('✅ PDF files:', files.length, 'out of', allFiles.length)

    if (files.length < allFiles.length) {
      toast.warning(
        `${allFiles.length - files.length} fichier(s) ignoré(s) - Seuls les PDF sont acceptés`
      )
    }

    if (files.length === 0) {
      toast.error('Aucun fichier PDF détecté')
      return
    }

    if (files.length > 50) {
      toast.warning('Maximum 50 fichiers - Les premiers 50 seront traités')
    }

    const filesToProcess = files.slice(0, 50)
    setSelectedFiles(filesToProcess)
    setResults(filesToProcess.map((f) => ({ fileName: f.name, status: 'pending' })))

    toast.success(`${filesToProcess.length} fichier(s) PDF prêt(s) à être traité(s)`)
  }

  const normalizeMonthToDate = (monthString: string): string => {
    if (/^\d{4}-\d{2}$/.test(monthString)) {
      return `${monthString}-01`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(monthString)) {
      return monthString.substring(0, 8) + '01'
    }
    return monthString
  }

  // Fonction utilitaire pour créer les enregistrements (document + salaire)
  const createRecordsForProfile = async (
    file: File,
    index: number,
    profileId: string,
    parsedData: ParsedBulletinData,
    timestamp: number,
    sanitizedFileName: string
  ): Promise<void> => {
    // Upload file to employee's storage
    const storagePath = `${profileId}/${timestamp}_${sanitizedFileName}`
    const { error: finalUploadError } = await supabase.storage
      .from('rh-documents')
      .upload(storagePath, file, { upsert: false })

    if (finalUploadError) throw new Error(`Upload final échoué: ${finalUploadError.message}`)

    // NOTE: Ne pas utiliser getPublicUrl sur un bucket privé
    // Les URLs signées seront générées à la demande via useRHDocuments.getDocumentUrl()
    // Stocker uniquement le storage_path, pas d'URL publique

    // Create document record
    const { data: docData, error: docError } = await supabase
      .from('rh_documents_employes')
      .insert({
        profile_id: profileId,
        type_document: 'bulletin_salaire',
        titre: `Bulletin ${parsedData.mois}`,
        storage_path: storagePath,
        date_document: parsedData.mois
          ? new Date(parsedData.mois).toISOString()
          : new Date().toISOString(),
      })
      .select()
      .single() // safe: guaranteed-row

    if (docError) throw new Error(`Création document échouée: ${docError.message}`)

    // Check for duplicate
    const moisNormalized = parsedData.mois ? normalizeMonthToDate(parsedData.mois) : null

    if (!moisNormalized) {
      throw new Error('Mois invalide')
    }

    const { data: existing } = await supabase
      .from('rh_salaires_mensuels')
      .select('id')
      .eq('profile_id', profileId)
      .eq('mois', moisNormalized)
      .maybeSingle()

    if (existing) {
      throw new Error(`Doublon détecté pour ${parsedData.mois}`)
    }

    // Validation des données requises
    if (!parsedData.salaire_brut || !parsedData.salaire_net) {
      throw new Error('Données salaire manquantes')
    }

    // Create salary record
    const { error: salaireError } = await supabase.from('rh_salaires_mensuels').insert({
      profile_id: profileId,
      mois: moisNormalized,
      salaire_brut: parsedData.salaire_brut,
      salaire_net: parsedData.salaire_net,
      net_paye: parsedData.salaire_net_a_payer,
      cotisations_salariales: parsedData.cotisations_salariales,
      cotisations_patronales: parsedData.cotisations_patronales,
      primes: parsedData.primes,
      heures_supplementaires: parsedData.heures_supplementaires,
      source_type: 'auto_bulletin',
      source_document_id: docData.id,
    })

    if (salaireError) throw new Error(`Création salaire échouée: ${salaireError.message}`)

    // Success
    setResults((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              status: 'success',
              mois: parsedData.mois || undefined,
              salaireBrut: parsedData.salaire_brut || undefined,
              salaireNet: parsedData.salaire_net || undefined,
            }
          : r
      )
    )
  }

  const processBulletin = async (file: File, index: number): Promise<void> => {
    setCurrentIndex(index)

    try {
      // Update status to analyzing
      setResults((prev) => prev.map((r, i) => (i === index ? { ...r, status: 'analyzing' } : r)))

      // Upload file temporarily to storage
      const timestamp = Date.now()
      const sanitizedFileName = sanitizeFileName(file.name)
      debug.log(`📄 Processing: "${file.name}" → "${sanitizedFileName}"`)
      const tempPath = `temp/${timestamp}_${sanitizedFileName}`

      const { error: uploadError } = await supabase.storage
        .from('rh-documents')
        .upload(tempPath, file, { upsert: false })

      if (uploadError) throw new Error(`Upload échoué: ${uploadError.message}`)

      // Wait a bit for storage to be ready
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Call parse-bulletin-temp edge function
      const { data: parseResult, error: parseError } = await supabase.functions.invoke(
        'parse-bulletin-temp',
        {
          body: { storage_path: tempPath },
        }
      )

      // Delete temp file
      await supabase.storage.from('rh-documents').remove([tempPath])

      if (parseError) throw new Error(`Analyse échouée: ${parseError.message}`)
      if (!parseResult?.data) throw new Error('Aucune donnée extraite')

      const parsedData: ParsedBulletinData = parseResult.data

      // 🔍 Log détaillé des données extraites
      debug.log('🔍 Données extraites du PDF', {
        nom: parsedData.employe?.nom,
        prenom: parsedData.employe?.prenom,
        confidence: parsedData.confidence,
      })

      // Check confidence
      if (parsedData.confidence < 50) {
        throw new Error(`Confiance trop faible (${parsedData.confidence}%)`)
      }

      // Find employee by name
      const { profileId, matchType } = await findProfileByName(
        parsedData.employe?.nom,
        parsedData.employe?.prenom,
        parsedData.employe?.numero_securite_sociale
      )

      if (!profileId) {
        // Stocker les données pour permettre la sélection manuelle
        setResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? {
                  ...r,
                  status: 'error',
                  error: `Employé non trouvé: ${parsedData.employe?.prenom} ${parsedData.employe?.nom}. Veuillez associer manuellement.`,
                  employeeName:
                    `${parsedData.employe?.prenom ?? ''} ${parsedData.employe?.nom ?? ''}`.trim(),
                  parsedData,
                  canAssociateManually: true,
                }
              : r
          )
        )

        // Continuer avec le prochain fichier au lieu de throw
        return
      }

      // Update status to uploading
      setResults((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                status: 'uploading',
                profileId,
                matchType,
                employeeName: `${parsedData.employe?.prenom} ${parsedData.employe?.nom}`,
                parsedData,
              }
            : r
        )
      )

      // Appeler la fonction utilitaire pour créer les enregistrements
      await createRecordsForProfile(
        file,
        index,
        profileId,
        parsedData,
        timestamp,
        sanitizedFileName
      )
    } catch (error: unknown) {
      debug.error(`Error processing ${file.name}:`, error)
      setResults((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                status: 'error',
                error: error instanceof Error ? error.message : 'Erreur inconnue',
              }
            : r
        )
      )
    }
  }

  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Aucun fichier sélectionné')
      return
    }

    debug.log('🚀 Starting batch processing of', selectedFiles.length, 'files')
    setIsProcessing(true)

    for (let i = 0; i < selectedFiles.length; i++) {
      debug.log(`📄 Processing file ${i + 1}/${selectedFiles.length}:`, selectedFiles[i].name)
      await processBulletin(selectedFiles[i], i)
      // Small delay between files
      if (i < selectedFiles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    setIsProcessing(false)

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length

    debug.log('✅ Batch processing completed:', { successCount, errorCount })

    if (successCount > 0) {
      toast.success(`${successCount} bulletin(s) traité(s) avec succès`, {
        description: errorCount > 0 ? `${errorCount} erreur(s)` : undefined,
        duration: 5000,
      })
    }

    if (errorCount > 0 && successCount === 0) {
      toast.error(`Échec du traitement de ${errorCount} bulletin(s)`, {
        description: 'Vérifiez les erreurs ci-dessus',
        duration: 5000,
      })
    }

    if (onCompleted && successCount > 0) {
      onCompleted()
    }
  }

  const handleManualAssociate = async (index: number) => {
    const result = results[index]
    const file = selectedFiles[index]
    const profileId = result.manualProfileId
    const parsedData = result.parsedData

    if (!profileId) {
      toast.error('Veuillez sélectionner un employé')
      return
    }

    if (!parsedData) {
      toast.error('Données du bulletin manquantes')
      return
    }

    try {
      // Mettre à jour l'état
      setResults((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                status: 'uploading',
                error: undefined,
                profileId,
                matchType: 'manual',
                employeeName: profilesMap?.get(profileId)
                  ? `${profilesMap.get(profileId)!.prenom} ${profilesMap.get(profileId)!.nom}`
                  : result.employeeName,
              }
            : r
        )
      )

      // Créer les enregistrements
      const timestamp = Date.now()
      const sanitizedFileName = sanitizeFileName(file.name)
      await createRecordsForProfile(
        file,
        index,
        profileId,
        parsedData,
        timestamp,
        sanitizedFileName
      )

      toast.success('Bulletin associé avec succès')
    } catch (error: unknown) {
      debug.error('Erreur association manuelle:', error)
      setResults((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                status: 'error',
                error: sanitizeSupabaseError(error),
                canAssociateManually: true,
              }
            : r
        )
      )
      toast.error(`Erreur: ${sanitizeSupabaseError(error)}`)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedFiles([])
      setResults([])
      setCurrentIndex(0)
      onOpenChange(false)
    }
  }

  const progressPercentage =
    selectedFiles.length > 0
      ? Math.round(
          (results.filter((r) => r.status === 'success' || r.status === 'error').length /
            selectedFiles.length) *
            100
        )
      : 0

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Upload multiple de bulletins de salaire</DialogTitle>
          <DialogDescription>
            Uploadez plusieurs bulletins en une seule fois. L'association aux employés se fera
            automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selectedFiles.length === 0 && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-primary/50 hover:border-primary hover:bg-primary/5'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload
                className={`h-16 w-16 mx-auto mb-4 transition-colors ${
                  isDragging ? 'text-primary animate-bounce' : 'text-primary'
                }`}
              />
              <h3 className="text-lg font-semibold mb-2">
                {isDragging
                  ? '📥 Déposez vos fichiers ici'
                  : 'Sélectionnez vos bulletins de salaire'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Glissez-déposez vos bulletins PDF ici ou cliquez sur le bouton ci-dessous
              </p>
              <input
                type="file"
                multiple
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="bulk-file-input"
                disabled={isProcessing}
              />
              <label htmlFor="bulk-file-input">
                <Button size="lg" asChild>
                  <span className="cursor-pointer">
                    <Upload className="mr-2 h-5 w-5" />
                    Choisir des fichiers PDF
                  </span>
                </Button>
              </label>
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium mb-2">📋 Fonctionnalités automatiques :</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>✅ Analyse automatique par GPT-5</li>
                  <li>✅ Association automatique aux employés</li>
                  <li>✅ Création automatique des salaires mensuels</li>
                  <li>⚡ Traitement de plusieurs bulletins en une fois</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Format : PDF uniquement • Max 20 MB/fichier • Max 50 fichiers
              </p>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {isProcessing
                      ? `Traitement en cours... (${currentIndex + 1}/${selectedFiles.length})`
                      : `${selectedFiles.length} fichier(s) sélectionné(s)`}
                  </p>
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFiles([])
                        setResults([])
                      }}
                    >
                      Annuler
                    </Button>
                  )}
                </div>
                {isProcessing && <Progress value={progressPercentage} className="h-2" />}
              </div>

              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <BulkUploadBulletinsResultRow
                      key={`bulk-bull-${index}-${result.fileName ?? ''}`}
                      result={result}
                      index={index}
                      profilesMap={profilesMap}
                      isProcessing={isProcessing}
                      onManualProfileChange={(i, value) =>
                        setResults((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, manualProfileId: value } : r))
                        )
                      }
                      onManualAssociate={handleManualAssociate}
                    />
                  ))}
                </div>
              </ScrollArea>

              {!isProcessing && results.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium text-green-600">✅ {successCount} succès</span>
                    {errorCount > 0 && (
                      <span className="ml-3 font-medium text-red-600">
                        ❌ {errorCount} erreur(s)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                  {isProcessing ? 'En cours...' : 'Fermer'}
                </Button>
                {!isProcessing && results.every((r) => r.status === 'pending') && (
                  <Button onClick={handleStartProcessing}>
                    <Upload className="h-4 w-4 mr-2" />
                    Lancer le traitement
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
