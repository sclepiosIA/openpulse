import { useState, useRef } from 'react'
import { debug } from '@/lib/debug'
import { Camera, X, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { EntityAvatar } from './EntityAvatar'
import { Button } from './button'

interface EntityLogoUploadProps {
  entityType: 'etablissement' | 'groupe' | 'partenaire'
  entityId: string
  entityName: string
  currentLogoUrl?: string | null
  onLogoChange: (newUrl: string | null) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
}

export function EntityLogoUpload({
  entityType,
  entityId,
  entityName,
  currentLogoUrl,
  onLogoChange,
  size = 'md',
  className,
}: EntityLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2 Mo")
      return
    }

    setIsUploading(true)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${entityType}/${entityId}/logo-${Date.now()}.${fileExt}`

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/entity-logos/')[1]
        if (oldPath) {
          await supabase.storage.from('entity-logos').remove([oldPath])
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('entity-logos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage.from('entity-logos').getPublicUrl(fileName)

      // Update database
      const tableName =
        entityType === 'etablissement'
          ? 'etablissements'
          : entityType === 'groupe'
            ? 'groupes_etablissements'
            : 'partenaires'

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ logo_url: urlData.publicUrl })
        .eq('id', entityId)

      if (updateError) throw updateError

      onLogoChange(urlData.publicUrl)
      toast.success('Logo mis à jour')
    } catch (error) {
      debug.error('Error uploading logo:', error)
      toast.error("Erreur lors de l'upload du logo")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return

    setIsUploading(true)

    try {
      // Delete from storage
      const oldPath = currentLogoUrl.split('/entity-logos/')[1]
      if (oldPath) {
        await supabase.storage.from('entity-logos').remove([oldPath])
      }

      // Update database
      const tableName =
        entityType === 'etablissement'
          ? 'etablissements'
          : entityType === 'groupe'
            ? 'groupes_etablissements'
            : 'partenaires'

      const { error } = await supabase.from(tableName).update({ logo_url: null }).eq('id', entityId)

      if (error) throw error

      onLogoChange(null)
      toast.success('Logo supprimé')
    } catch (error) {
      debug.error('Error removing logo:', error)
      toast.error('Erreur lors de la suppression du logo')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className={cn('relative group', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className={cn('relative', sizeClasses[size])}>
        <EntityAvatar
          name={entityName}
          logoUrl={currentLogoUrl}
          size={size === 'sm' ? 'lg' : 'xl'}
          className={sizeClasses[size]}
        />

        {/* Overlay on hover */}
        <div
          className={cn(
            'absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100',
            'flex items-center justify-center gap-1 transition-opacity cursor-pointer',
            isUploading && 'opacity-100'
          )}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-card/20"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Changer le logo"
                title="Changer le logo"
              >
                <Camera className="h-4 w-4" />
              </Button>
              {currentLogoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-card/20"
                  onClick={handleRemoveLogo}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
