import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeMonthToDate } from "@/lib/dateUtils";
import { debug } from "@/lib/debug";
import {
  findProfileByName,
  analyzeBulletin,
  createSalaireFromParsedData,
  showUploadSummary,
  type ParsedBulletinData,
} from "@/components/rh/uploadDocumentHelpers";
import {
  MultiUploadProgressCard,
  SingleAnalyzingCard,
  ParsedBulletinPreviewCard,
  ParseErrorCard,
  UploadResultsSummaryCard,
} from "@/components/rh/UploadDocumentDialogCards";
import { supabase } from "@/integrations/supabase/client";
const formSchema = z.object({
  type_document: z.enum(['contrat', 'bulletin_salaire', 'attestation', 'autre']),
  titre: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  date_document: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onUpload: (data: FormData & { file: File }) => Promise<{
    id: string;
    storage_path: string;
  }>;
  onSalaireCreated?: () => void;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  profileId,
  onUpload,
  onSalaireCreated,
}: UploadDocumentDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedBulletinData | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [uploadResults, setUploadResults] = useState<Array<{file: string; success: boolean; error?: string}>>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type_document: 'autre',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (uploadQueue.length === 0) {
      return;
    }

    setIsUploading(true);
    setIsAnalyzing(true);
    setParseError(null);
    setUploadResults([]);
    
    const results: Array<{file: string; success: boolean; error?: string}> = [];
    
    try {
      // Traitement séquentiel de tous les fichiers
      for (let i = 0; i < uploadQueue.length; i++) {
        const file = uploadQueue[i];
        setCurrentUploadIndex(i);
        
        try {
          // 1. Upload du fichier et récupérer directement l'ID du document créé
          const uploadedDoc = await onUpload({ ...data, file });
          
          // 2. Si c'est un bulletin de salaire, analyser CE document spécifique
          if (data.type_document === 'bulletin_salaire') {
            const parsedData = await analyzeBulletin(
              uploadedDoc.id,
              uploadedDoc.storage_path,
              profileId,
            );

            
            // Créer automatiquement si confiance >= 70%
            if (parsedData && parsedData.confidence >= 70) {
              await createSalaireFromParsedData(parsedData, uploadedDoc.id, profileId);
            }
          }
          
          results.push({ file: file.name, success: true });
        } catch (error: unknown) {
          debug.error(`Erreur pour ${file.name}:`, error);
          results.push({ 
            file: file.name, 
            success: false, 
            error: error instanceof Error ? error.message : 'Erreur inconnue' 
          });
        }
      }
      
      // Afficher le récapitulatif
      setUploadResults(results);
      showUploadSummary(results);
      
      // Si tout est OK, réinitialiser et fermer
      if (results.every(r => r.success)) {
        form.reset();
        setSelectedFile(null);
        setUploadQueue([]);
        onSalaireCreated?.();
        onOpenChange(false);
      }
    } catch (error) {
      debug.error("Erreur globale lors de l'upload:", error);
      toast.error("Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const handleValidateSalaire = async () => {
    if (!parsedData) {
      toast.error('Aucune donnée analysée');
      return;
    }

    // Vérifier que les champs obligatoires sont présents
    if (!parsedData.mois || parsedData.salaire_brut === null || parsedData.salaire_net === null) {
      toast.error('Données manquantes : impossible de créer le salaire automatiquement');
      return;
    }

    try {
      // ✅ Chercher l'employé par nom/prénom
      let targetProfileId = await findProfileByName(
        parsedData.employe?.nom,
        parsedData.employe?.prenom
      );

      if (!targetProfileId) {
        debug.warn('⚠️ Employé non trouvé par nom, utilisation du profileId de la fiche');
        targetProfileId = profileId;
      } else if (targetProfileId !== profileId) {
        toast.warning('⚠️ Employé détecté différent de la fiche', {
          description: `Le bulletin concerne ${parsedData.employe?.prenom} ${parsedData.employe?.nom}`
        });
      }

      // Normaliser le mois au format YYYY-MM-01 (protection robuste)
      const moisNormalized = normalizeMonthToDate(parsedData.mois);
      
      // Vérifier que le document existe vraiment si on a un documentId
      let validDocumentId: string | null = null;
      if (documentId) {
        const { data: docExists } = await supabase
          .from('rh_documents_employes')
          .select('id')
          .eq('id', documentId)
          .maybeSingle();

        if (docExists) {
          validDocumentId = documentId;
        } else {
          debug.warn('Document non trouvé:', documentId);
        }
      }
      
      const { error } = await supabase
        .from('rh_salaires_mensuels')
        .insert({
          profile_id: targetProfileId,
          mois: moisNormalized,
          salaire_brut: parsedData.salaire_brut,
          salaire_net: parsedData.salaire_net,
          cotisations_salariales: parsedData.cotisations_salariales,
          cotisations_patronales: parsedData.cotisations_patronales,
          primes: parsedData.primes,
          heures_supplementaires: parsedData.heures_supplementaires,
          source_type: 'auto_bulletin',
          source_document_id: validDocumentId,
        });

      if (error) throw error;

      toast.success('Salaire créé automatiquement !');
      form.reset();
      setSelectedFile(null);
      setParsedData(null);
      setDocumentId(null);
      onSalaireCreated?.();
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      const errorCode = (error as Record<string, unknown>)?.code as string || "";
      const errorDetail = (error as Record<string, unknown>)?.details as string || "";
      debug.error('Erreur création salaire:', error);
      toast.error(`Erreur création salaire: ${errorMessage}`, {
        description: errorCode ? `Code SQL: ${errorCode}${errorDetail ? ` - ${errorDetail}` : ''}` : undefined,
      });
    }
  };

  const handleCancel = () => {
    form.reset();
    setSelectedFile(null);
    setParsedData(null);
    setDocumentId(null);
    setParseError(null);
    setUploadQueue([]);
    setUploadResults([]);
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const filesArray = Array.from(files);
      setUploadQueue(filesArray);
      setSelectedFile(filesArray[0]);
      setCurrentUploadIndex(0);
      
      // Auto-remplir le titre avec le premier fichier si vide
      if (!form.getValues("titre")) {
        form.setValue("titre", filesArray[0].name);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Uploader un document</DialogTitle>
          <DialogDescription>
            Ajouter un document RH (contrat, bulletin, attestation, etc.)
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Zone de drop */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground mb-2">
                {uploadQueue.length > 0 ? (
                  <div>
                    <span className="font-medium text-foreground">
                      {uploadQueue.length} fichier{uploadQueue.length > 1 ? 's' : ''} sélectionné{uploadQueue.length > 1 ? 's' : ''}
                    </span>
                    <div className="text-xs mt-1">
                      {uploadQueue.map((f, i) => (
                        <div key={`upload-${f.name}-${f.size}-${i}`}>{f.name}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  "Cliquez pour sélectionner un ou plusieurs fichiers"
                )}
              </div>
              <Input
                type="file"
                onChange={handleFileChange}
                className="cursor-pointer"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                multiple
              />
              {uploadQueue.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Total: {(uploadQueue.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="type_document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de document</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="contrat">Contrat de travail</SelectItem>
                      <SelectItem value="bulletin_salaire">Bulletin de salaire</SelectItem>
                      <SelectItem value="attestation">Attestation</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="titre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Contrat CDI - 2025" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date_document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date du document (optionnel)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    Pour les bulletins de salaire, sélectionner le mois concerné
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informations complémentaires..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isUploading && uploadQueue.length > 1 && (
              <MultiUploadProgressCard
                currentUploadIndex={currentUploadIndex}
                total={uploadQueue.length}
                currentFileName={uploadQueue[currentUploadIndex]?.name}
              />
            )}

            {isAnalyzing && uploadQueue.length === 1 && <SingleAnalyzingCard />}

            {parsedData && !isAnalyzing && <ParsedBulletinPreviewCard parsedData={parsedData} />}

            {parseError && !isAnalyzing && <ParseErrorCard message={parseError} />}

            {uploadResults.length > 0 && !isUploading && (
              <UploadResultsSummaryCard results={uploadResults} />
            )}

            {/* Boutons */}
            <div className="flex justify-end gap-2 pt-4">
              {uploadResults.length > 0 && !isUploading ? (
                // Après l'upload, afficher seulement "Fermer"
                <Button
                  type="button"
                  onClick={handleCancel}
                >
                  Fermer
                </Button>
              ) : parsedData && uploadQueue.length === 1 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    onClick={handleValidateSalaire}
                  >
                    ✅ Valider et créer le salaire
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isUploading || isAnalyzing}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={uploadQueue.length === 0 || isUploading || isAnalyzing}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Upload {currentUploadIndex + 1}/{uploadQueue.length}
                      </>
                    ) : (
                      `Uploader ${uploadQueue.length} fichier${uploadQueue.length > 1 ? 's' : ''}`
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
