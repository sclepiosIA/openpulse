import { Star, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useFavorites } from '@/hooks/views/useFavorites'
import { cn } from '@/lib/utils'

/**
 * Sidebar section listing pinned workspace favorites.
 * Renders nothing when there are no favorites — no visual clutter.
 */
export function FavoritesSidebarSection() {
  const { favorites, remove } = useFavorites()
  const { state } = useSidebar()

  if (favorites.length === 0) return null

  return (
    <SidebarGroup className="py-2">
      {state === 'expanded' && (
        <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <Star className="h-3 w-3 fill-current" />
          <span>Favoris</span>
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {favorites.slice(0, 10).map((fav) => (
            <SidebarMenuItem key={`${fav.type}-${fav.id}`}>
              <SidebarMenuButton
                asChild
                tooltip={state === 'collapsed' ? fav.title : undefined}
                className="group/fav"
              >
                <NavLink
                  to={fav.url}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2',
                      isActive && 'bg-primary/10 text-primary',
                    )
                  }
                >
                  <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                  <span className="truncate flex-1">{fav.title}</span>
                  {state === 'expanded' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        remove(fav.id, fav.type)
                      }}
                      className="opacity-0 group-hover/fav:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                      aria-label={`Retirer ${fav.title} des favoris`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
