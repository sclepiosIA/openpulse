import { useState, useEffect } from "react"
import { debug } from "@/lib/debug"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import {
  FileText,
  Download,
  Calendar,
  User,
  Search,
  Eye,
  Trash2,
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useDeleteTacheDocument, getDocumentUrl } from "@/hooks/tasks/useTachesDocuments"
import { useToast } from "@/hooks/shared/use-toast"

interface EtablissementDocumentsProps {
  etablissementId: string
}

interface DocumentWithTask {
  id: string
  nom_fichier: string
  chemin_fichier: string
  type_mime?: string
  taille_fichier?: number
  created_at: string
  updated_at: string
  uploaded_by?: string
  tache_titre?: string
  tache_id: string
  uploader_nom?: string
  uploader_prenom?: string
}

export function EtablissementDocuments({ etablissementId }: EtablissementDocumentsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [previewDocument, setPreviewDocument] = useState<DocumentWithTask | null>(null)
  const { toast } = useToast()
  const deleteDocumentMutation = useDeleteTacheDocument(etablissementId)

  // Récupérer tous les documents de l'établissement via les tâches
  const { data: allDocuments, isLoading } = useQuery({
    queryKey: ['etablissement-documents', etablissementId],
    queryFn: async () => {
      // D'abord récupérer toutes les tâches de l'établissement
      const { data: taches } = await supabase
        .from('taches')
        .select('id, titre')
        .eq('etablissement_id', etablissementId)

      if (!taches || taches.length === 0) return []

      const tacheIds = taches.map(t => t.id)

      // Chunking pour éviter les erreurs 400 (IDs avec suffixes _occ_YYYY-MM-DD)
      const CHUNK_SIZE = 30
      const allDocuments: any[] = []
      
      for (let i = 0; i < tacheIds.length; i += CHUNK_SIZE) {
        const chunk = tacheIds.slice(i, i + CHUNK_SIZE)
        
        const { data: documents } = await supabase
          .from('taches_documents')
          .select(`
            *,
            profiles:uploaded_by(nom, prenom)
          `)
          .in('tache_id', chunk)
        
        if (documents) allDocuments.push(...documents)
      }

      if (allDocuments.length === 0) return []
      
      // Trier après agrégation
      allDocuments.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Combiner avec les infos des tâches
      return allDocuments.map((doc: any) => ({
        ...doc,
        tache_titre: taches.find(t => t.id === doc.tache_id)?.titre || 'Tâche inconnue',
        uploader_nom: doc.profiles?.nom,
        uploader_prenom: doc.profiles?.prenom
      })) as DocumentWithTask[]
    },
    enabled: !!etablissementId
  })

  // Filtrer les documents
  const filteredDocuments = allDocuments?.filter(doc => {
    const matchesSearch = doc.nom_fichier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.tache_titre || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = selectedType === "all" || 
                       (doc.type_mime && doc.type_mime.startsWith(selectedType))
    
    return matchesSearch && matchesType
  })

  // Types de fichiers pour le filtre
  const fileTypes = [
    { value: "all", label: "Tous les types" },
    { value: "image", label: "Images" },
    { value: "application/pdf", label: "PDF" },
    { value: "application/vnd", label: "Office" },
    { value: "text", label: "Texte" },
  ]

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Taille inconnue"
    const sizes = ['o', 'Ko', 'Mo', 'Go']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const downloadDocument = async (document: DocumentWithTask) => {
    try {
      const { data, error } = await supabase.storage
        .from('taches-documents')
        .download(document.chemin_fichier)

      if (error) throw error

      // Créer un lien de téléchargement sécurisé
      const url = URL.createObjectURL(data)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document.nom_fichier
      a.style.display = 'none'
      
      // Ajout sécurisé au DOM avec nettoyage automatique
      window.document.body.appendChild(a)
      a.click()
      
      // Nettoyage sécurisé pour éviter les erreurs removeChild
      try {
        // Vérifier que l'élément est toujours dans le DOM avant suppression
        if (a.parentNode === window.document.body) {
          window.document.body.removeChild(a)
        }
      } catch (cleanupError) {
        debug.warn('Warning: DOM element cleanup failed:', cleanupError)
      } finally {
        // Toujours révoquer l'URL pour libérer la mémoire
        URL.revokeObjectURL(url)
      }

      toast({
        title: "Téléchargement réussi",
        description: `${document.nom_fichier} téléchargé avec succès.`
      })
    } catch (error) {
      debug.error('Erreur téléchargement:', error)
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le fichier.",
        variant: "destructive"
      })
    }
  }

  const handleDeleteDocument = async (document: DocumentWithTask) => {
    try {
      await deleteDocumentMutation.mutateAsync({
        documentId: document.id,
        filePath: document.chemin_fichier
      })
    } catch (error) {
      debug.error('Erreur suppression:', error)
    }
  }

  const isPreviewable = (mimeType?: string) => {
    if (!mimeType) return false
    return (
      mimeType === 'application/pdf' ||
      mimeType.startsWith('image/') ||
      mimeType.startsWith('text/') ||
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType.includes('sheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('presentation')
    )
  }

// Document Preview Component
const DocumentPreview = ({ document }: { document: DocumentWithTask }) => {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUrl = async () => {
      try {
        const url = await getDocumentUrl(document.chemin_fichier)
        setDocumentUrl(url)
      } catch (error) {
        debug.error('Error loading document URL:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUrl()
  }, [document.chemin_fichier])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!documentUrl || !document.type_mime) {
    return <div className="p-4 text-center text-muted-foreground">Impossible de prévisualiser ce fichier</div>
  }

  // PDF
  if (document.type_mime === 'application/pdf') {
    return (
      <iframe
        src={documentUrl}
        className="w-full h-[70vh] border-0"
        title={`Aperçu de ${document.nom_fichier}`}
      />
    )
  }

  // Images
  if (document.type_mime.startsWith('image/')) {
    return (
      <div className="flex justify-center p-4">
        <img
          src={documentUrl}
          alt={document.nom_fichier}
          className="max-w-full max-h-[70vh] object-contain"
        />
      </div>
    )
  }

  // Documents Office
  if (
    document.type_mime.includes('word') ||
    document.type_mime.includes('document') ||
    document.type_mime.includes('sheet') ||
    document.type_mime.includes('excel') ||
    document.type_mime.includes('powerpoint') ||
    document.type_mime.includes('presentation')
  ) {
    const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentUrl)}`
    return (
      <iframe
        src={officeViewerUrl}
        className="w-full h-[70vh] border-0"
        title={`Aperçu de ${document.nom_fichier}`}
      />
    )
  }

  // Fichiers texte
  if (document.type_mime.startsWith('text/')) {
    return (
      <iframe
        src={documentUrl}
        className="w-full h-[70vh] border-0"
        title={`Aperçu de ${document.nom_fichier}`}
      />
    )
  }

  return <div className="p-4 text-center text-muted-foreground">Format de fichier non supporté pour la prévisualisation</div>
}

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText className="h-4 w-4" />
    
    if (mimeType.startsWith('image/')) return <Eye className="h-4 w-4" />
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText className="h-4 w-4 text-green-500" />
    
    return <FileText className="h-4 w-4" />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Documents de l'établissement</h3>
          <p className="text-sm text-muted-foreground">
            Tous les documents associés aux tâches de cet établissement
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex h-10 w-full sm:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fileTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Separator />

      {filteredDocuments?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun document trouvé</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || selectedType !== "all" 
                ? "Aucun document ne correspond à vos critères de recherche."
                : "Aucun document n'a encore été ajouté aux tâches de cet établissement."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDocuments?.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-start space-x-4 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted flex-shrink-0">
                      {getFileIcon(document.type_mime)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{document.nom_fichier}</h4>
                      <p className="text-sm text-muted-foreground">
                        Tâche: {document.tache_titre}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(document.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        </div>
                        
                        {document.uploader_nom && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {document.uploader_prenom} {document.uploader_nom}
                          </div>
                        )}
                        
                        <span>{formatFileSize(document.taille_fichier)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:ml-4">
                    {isPreviewable(document.type_mime) && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewDocument(document)}
                            className="gap-2 justify-center"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="hidden xs:inline">Voir</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] p-2 sm:p-6">
                          <DialogHeader className="px-2 sm:px-0">
                            <DialogTitle className="truncate text-sm sm:text-base">{document.nom_fichier}</DialogTitle>
                          </DialogHeader>
                          <div className="overflow-hidden rounded">
                            {previewDocument && <DocumentPreview document={previewDocument} />}
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadDocument(document)}
                      className="gap-2 justify-center"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden xs:inline">Télécharger</span>
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 justify-center text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden xs:inline">Supprimer</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm sm:text-base">Supprimer le document</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">
                            Êtes-vous sûr de vouloir supprimer le document "{document.nom_fichier}" ? 
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="w-full sm:w-auto">Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDocument(document)}
                            className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}