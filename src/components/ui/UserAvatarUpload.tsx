import { useState, useRef, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Camera, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";

interface UserAvatarUploadProps {
  /** L'ID auth (auth.uid()) de l'utilisateur connecté */
  currentAuthUserId: string;
  /** L'ID auth (user_id) du profil cible si différent (admin modifiant un autre) */
  targetAuthUserId?: string;
  /** L'ID du profil dans la table profiles (pour la mise à jour DB) */
  profileId: string;
  currentAvatarUrl?: string | null;
  userName: string;
  onAvatarChange?: (newUrl: string | null) => void;
  size?: "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  md: "h-20 w-20",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

export function UserAvatarUpload({
  currentAuthUserId,
  targetAuthUserId,
  profileId,
  currentAvatarUrl,
  userName,
  onAvatarChange,
  size = "lg",
  className,
}: UserAvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Pour le stockage: utiliser le user_id (auth.uid())
  const storageUserId = targetAuthUserId || currentAuthUserId;

  // Synchronize previewUrl when currentAvatarUrl or profile changes
  useEffect(() => {
    setPreviewUrl(currentAvatarUrl || null);
  }, [currentAvatarUrl, profileId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Format non supporté",
        description: "Veuillez sélectionner une image (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 2 Mo",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Delete old avatar if exists
      if (previewUrl && previewUrl.includes("user-avatars")) {
        const oldPath = previewUrl.split("/user-avatars/")[1];
        if (oldPath) {
          await supabase.storage.from("user-avatars").remove([oldPath]);
        }
      }

      // Generate unique filename using auth user_id for storage path
      const fileExt = file.name.split(".").pop();
      const fileName = `${storageUserId}/${Date.now()}.${fileExt}`;

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("user-avatars")
        .getPublicUrl(fileName);

      const newUrl = urlData.publicUrl;

      // Update profile in database using profile.id
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", profileId);

      if (updateError) throw updateError;

      setPreviewUrl(newUrl);
      onAvatarChange?.(newUrl);

      toast({
        title: "Photo mise à jour",
        description: "La photo de profil a été mise à jour avec succès",
      });
    } catch (error) {
      debug.error("Error uploading avatar:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la photo de profil",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploading(true);

    try {
      // Delete from storage
      if (previewUrl && previewUrl.includes("user-avatars")) {
        const oldPath = previewUrl.split("/user-avatars/")[1];
        if (oldPath) {
          await supabase.storage.from("user-avatars").remove([oldPath]);
        }
      }

      // Update profile using profile.id
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profileId);

      if (error) throw error;

      setPreviewUrl(null);
      onAvatarChange?.(null);

      toast({
        title: "Photo supprimée",
        description: "La photo de profil a été supprimée",
      });
    } catch (error) {
      debug.error("Error removing avatar:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la photo de profil",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("relative inline-block group", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className={cn("relative", sizeClasses[size])}>
        <UserAvatar
          avatarUrl={previewUrl}
          name={userName}
          size={size}
          className="w-full h-full"
        />

        {/* Overlay on hover */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center gap-1 rounded-full",
            "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <>
              <Camera className="h-5 w-5 text-white" />
              {previewUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAvatar();
                  }}
                  className="absolute top-0 right-0 p-1 bg-destructive rounded-full text-destructive-foreground hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-2">
        Cliquez pour modifier
      </p>
    </div>
  );
}

export default UserAvatarUpload;
