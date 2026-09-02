import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFavorites, type FavoriteItem } from '@/hooks/views/useFavorites'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  item: FavoriteItem
  variant?: 'ghost' | 'outline'
  size?: 'sm' | 'icon'
  className?: string
}

/**
 * Star toggle to pin/unpin an entity to the workspace favorites.
 * Twenty CRM-inspired.
 */
export function FavoriteButton({
  item,
  variant = 'ghost',
  size = 'icon',
  className,
}: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites()
  const active = isFavorite(item.id, item.type)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const added = toggle(item)
    toast.success(added ? 'Ajouté aux favoris' : 'Retiré des favoris')
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      title={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={cn('shrink-0', className)}
    >
      <Star
        className={cn(
          'h-4 w-4 transition-colors',
          active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
        )}
      />
    </Button>
  )
}
