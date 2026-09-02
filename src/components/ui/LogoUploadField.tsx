import { useState, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { uploadPublicFile } from "@/services/storage/publicUploads";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { cn } from "@/lib/utils";

interface LogoUploadFieldProps {
  currentLogoUrl?: string | null;
  entityType: "etablissement" | "partenaire" | "groupe";
  onLogoUploaded: (url: string | null) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-16 h-16",
  md: "w-20 h-20",
  lg: "w-24 h-24",
};

export function LogoUploadField({
  currentLogoUrl,
  entityType,
  onLogoUploaded,
  size = "md",
  className,
}: LogoUploadFieldProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erreur",
        description: "L'image ne doit pas dépasser 2 Mo",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create a temporary ID for new entities
      const tempId = `temp-${Date.now()}`;
      const fileExt = file.name.split(".").pop();
      const fileName = `${entityType}/${tempId}/logo-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { publicUrl } = await uploadPublicFile("entity-logos", fileName, file, { upsert: true });

      setPreviewUrl(publicUrl);
      onLogoUploaded(publicUrl);



      toast({
        title: "Logo uploadé",
        description: "Le logo sera enregistré avec l'entité",
      });
    } catch (error: unknown) {
      const errorMessage = sanitizeSupabaseError(error);
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onLogoUploaded(null);
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden bg-muted/30",
          sizeClasses[size]
        )}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Logo preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Camera className="h-5 w-5" />
            <span className="text-[10px]">Logo</span>
          </div>
        )}
      </div>

      {previewUrl && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          className="p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="text-xs text-muted-foreground">
        <p>Cliquez pour ajouter un logo</p>
        <p>PNG, JPG (max. 2 Mo)</p>
      </div>
    </div>
  );
}
