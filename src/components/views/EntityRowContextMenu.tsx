import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ExternalLink, Link2, Star, StarOff } from 'lucide-react'
import { useFavorites, type FavoriteItem } from '@/hooks/views/useFavorites'
import { toast } from 'sonner'

interface EntityRowContextMenuProps {
  children: React.ReactNode
  favoriteItem: FavoriteItem
  /** Extra menu items appended after the standard ones (e.g. delete). */
  extraItems?: React.ReactNode
}

/**
 * Right-click menu for entity rows.
 * Inspired by Twenty CRM row actions.
 */
export function EntityRowContextMenu({
  children,
  favoriteItem,
  extraItems,
}: EntityRowContextMenuProps) {
  const { isFavorite, toggle } = useFavorites()
  const active = isFavorite(favoriteItem.id, favoriteItem.type)

  const openInNewTab = () => {
    window.open(favoriteItem.url, '_blank', 'noopener,noreferrer')
  }

  const copyLink = async () => {
    const fullUrl = `${window.location.origin}${favoriteItem.url}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast.success('Lien copié')
    } catch {
      toast.error('Impossible de copier le lien')
    }
  }

  const handleToggleFav = () => {
    const added = toggle(favoriteItem)
    toast.success(added ? 'Ajouté aux favoris' : 'Retiré des favoris')
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={openInNewTab}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Ouvrir dans un nouvel onglet
        </ContextMenuItem>
        <ContextMenuItem onClick={copyLink}>
          <Link2 className="h-4 w-4 mr-2" />
          Copier le lien
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleToggleFav}>
          {active ? (
            <>
              <StarOff className="h-4 w-4 mr-2" />
              Retirer des favoris
            </>
          ) : (
            <>
              <Star className="h-4 w-4 mr-2" />
              Ajouter aux favoris
            </>
          )}
        </ContextMenuItem>
        {extraItems && (
          <>
            <ContextMenuSeparator />
            {extraItems}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
