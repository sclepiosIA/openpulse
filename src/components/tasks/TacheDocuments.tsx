import { invokeEdge } from "@/services/edgeFunctions";
import { useState, useRef, useEffect } from "react"
import { debug } from "@/lib/debug"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Eye,
  Image,
  File,
  Sparkles,
  Mail,
} from "lucide-react"
import { useTachesDocuments, useUploadTacheDocument, useDeleteTacheDocument, getDocumentUrl } from "@/hooks/tasks/useTachesDocuments"
import { useAuth } from "@/components/AuthProvider"
import { useProfiles } from "@/hooks/profile/useProfiles"
import { useToast } from "@/hooks/shared/use-toast"
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

interface TacheDocumentsProps {
  tacheId: string
  tacheTitre: string
  etablissementId?: string
}

export function TacheDocuments({ tacheId, tacheTitre, etablissementId }: TacheDocumentsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewDocumentPath, setPreviewDocumentPath] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const { data: profiles } = useProfiles()
  const { toast } = useToast()
  
  const currentUserProfile = profiles?.find(p => p.user_id === user?.id)
  const normalizedTitre = tacheTitre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  
  const { data: documents, isLoading } = useTachesDocuments(tacheId)
  const uploadDocument = useUploadTacheDocument()
  const deleteDocument = useDeleteTacheDocument()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files))
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user || !currentUserProfile) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un fichier",
        variant: "destructive"
      })
      return
    }

    // Check if this is a medical-economic study (match exact normalized title)
    const isMedicalStudy = normalizedTitre.includes('etude medico economique');
    
    if (isMedicalStudy) {
      setIsAnalyzing(true)
      toast({
        title: "🤖 Analyse IA en cours",
        description: `${selectedFiles.length} document(s) seront analysés automatiquement...`,
      })
    } else {
      toast({
        title: "📤 Upload en cours",
        description: `Upload de ${selectedFiles.length} fichier(s)...`,
      })
    }

    try {
      // Upload all files in parallel
      await Promise.all(
        selectedFiles.map(file => {
          debug.log('📤 Uploading document:', {
            tacheTitre,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            etablissementId,
            isMedicoTask: tacheTitre.toLowerCase().includes('medico')
          })
          
          return uploadDocument.mutateAsync({
            tacheId,
            file: file,
            currentUserId: currentUserProfile.id,
            tacheInfo: {
              titre: tacheTitre,
              etablissement_id: etablissementId || ''
            }
          })
        })
      )
      
      toast({
        title: "✅ Upload terminé",
        description: `${selectedFiles.length} document(s) uploadé(s) avec succès`,
      })
      
      // Reset analyzing state after a delay (analysis happens async)
      if (isMedicalStudy) {
        setTimeout(() => setIsAnalyzing(false), 5000)
      }
    } catch (error) {
      setIsAnalyzing(false)
      toast({
        title: "❌ Erreur",
        description: "Certains fichiers n'ont pas pu être uploadés",
        variant: "destructive"
      })
    }

    setSelectedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (filePath: string) => {
    try {
      const url = await getDocumentUrl(filePath)
      if (url) {
        window.open(url, '_blank')
      }
    } catch (error) {
      debug.error('Error downloading document:', error)
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le document",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (documentId: string, filePath: string) => {
    await deleteDocument.mutateAsync({ documentId, filePath })
  }

  const handleManualAnalysis = async (documentId: string, filePath: string) => {
    if (!etablissementId) {
      toast({
        title: "Erreur",
        description: "Impossible de lancer l'analyse sans établissement",
        variant: "destructive"
      })
      return
    }

    setIsAnalyzing(true)
    toast({
      title: "🤖 Analyse IA lancée",
      description: "Extraction des données en cours...",
    })

    const { supabase } = await import('@/lib/supabaseBrowser')
    try {
      await invokeEdge<any>('analyze-medical-economic-study', {
        document_id: documentId,
        file_path: filePath,
        etablissement_id: etablissementId
      });
      setIsAnalyzing(false)
      toast({
        title: "✅ Analyse terminée",
        description: "Les données ont été extraites et enregistrées avec succès",
      })
    } catch (error) {
      setIsAnalyzing(false)
      toast({
        title: "❌ Erreur d'analyse",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Taille inconnue'
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    return `${kb.toFixed(1)} KB`
  }

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <File className="w-4 h-4" />
    
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />
    if (mimeType.includes('pdf')) return <FileText className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  const isPreviewable = (mimeType?: string) => {
    if (!mimeType) return false
    return mimeType.startsWith('image/') || 
           mimeType.includes('pdf') || 
           mimeType.includes('text/')
  }

  if (isLoading) {
    return <div className="p-4">Chargement des documents...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Documents - {tacheTitre}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Analysis Indicator */}
        {isAnalyzing && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Sparkles className="w-5 h-5 animate-pulse text-primary" />
            <span className="text-sm font-medium">Analyse IA en cours des données de l'étude...</span>
          </div>
        )}
        
        {/* Upload Section */}
        <div className="border-2 border-dashed border-muted rounded-lg p-4">
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="flex-1"
              multiple
            />
            <Button 
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploadDocument.isPending}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploadDocument.isPending ? 'Upload...' : `Uploader${selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ''}`}
            </Button>
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-sm font-medium text-muted-foreground">
                {selectedFiles.length} fichier(s) sélectionné(s):
              </div>
              {selectedFiles.map((file, index) => (
                <div key={`selfile-${file.name}-${file.size}-${index}`} className="text-sm text-muted-foreground ml-2">
                  • {file.name} ({formatFileSize(file.size)})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents List - Grouped by type */}
        <div className="space-y-4">
          {(() => {
            // Group documents by document_type
            const grouped = documents?.reduce((acc, doc) => {
              const type = doc.document_type || 'Autres';
              if (!acc[type]) acc[type] = [];
              acc[type].push(doc);
              return acc;
            }, {} as Record<string, typeof documents>);

            return Object.entries(grouped || {}).map(([docType, docs]) => (
              <div key={docType} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{docType}</h4>
                  <Badge variant="outline" className="text-xs">
                    {docs.length} document{docs.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                
                {docs.map((document) => (
                  <div 
                    key={document.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      document.is_latest_version 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getFileIcon(document.type_mime)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{document.nom_fichier}</span>
                          {document.version_number && document.version_number > 1 && (
                            <Badge 
                              variant={document.is_latest_version ? "default" : "secondary"} 
                              className="text-xs"
                            >
                              v{document.version_number}
                            </Badge>
                          )}
                          {document.is_latest_version && (
                            <Badge variant="default" className="text-xs">
                              Dernière
                            </Badge>
                          )}
                          {document.auto_detected && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Auto
                            </Badge>
                          )}
                          {document.source_type === 'email' && (
                            <Badge variant="secondary" className="text-xs">
                              <Mail className="w-3 h-3 mr-1" />
                              Email
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatFileSize(document.taille_fichier)} • {new Date(document.created_at).toLocaleDateString('fr-FR')}
                          {document.detection_confidence && (
                            <span className="ml-2">
                              • Confiance: {(document.detection_confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
              
              <div className="flex items-center gap-2">
                {isPreviewable(document.type_mime) && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setPreviewDocumentPath(document.chemin_fichier)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>{document.nom_fichier}</DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 overflow-hidden">
                        {previewDocumentPath && (
                          <DocumentPreview filePath={previewDocumentPath} fileName={document.nom_fichier} />
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                {/* Manual AI Analysis Button for EME tasks */}
                {normalizedTitre.includes('etude medico economique') && 
                 etablissementId && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleManualAnalysis(document.id, document.chemin_fichier)}
                    disabled={isAnalyzing}
                    title="Analyser avec IA"
                  >
                    <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                  </Button>
                )}
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDownload(document.chemin_fichier)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDelete(document.id, document.chemin_fichier)}
                  disabled={deleteDocument.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                  </div>
                </div>
              ))}
            </div>
          ));
          })()}
          
          {documents?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun document pour cette tâche</p>
              <p className="text-sm">Uploadez des fichiers pour commencer</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Document Preview Component
const DocumentPreview = ({ filePath, fileName }: { filePath: string; fileName: string }) => {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUrl = async () => {
      try {
        const url = await getDocumentUrl(filePath)
        setDocumentUrl(url)
      } catch (error) {
        debug.error('Error loading document URL:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUrl()
  }, [filePath])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!documentUrl) {
    return <div className="p-4 text-center text-muted-foreground">Impossible de charger le document</div>
  }

  return (
    <iframe
      src={documentUrl}
      className="w-full h-[60vh] border rounded"
      title={fileName}
    />
  )
}