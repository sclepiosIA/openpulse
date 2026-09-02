import { ReactNode, useState } from 'react'
import { List } from 'lucide-react'
import { TutorielSidebar } from './TutorielSidebar'
import { TutorielSearch } from './TutorielSearch'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface TutorielLayoutProps {
  children: ReactNode
  currentModuleId?: string
  currentSectionId?: string
}

/**
 * Mise en page des pages de tutoriel.
 *
 * POURQUOI LE SOMMAIRE N'EST PLUS UNE COLONNE
 * Cette page vit DANS la coque de l'application, qui affiche déjà sa barre de
 * navigation à gauche (App.tsx rend <AppSidebar /> puis les routes dans
 * <SidebarInset>). Un second <aside> permanent de 288 px donnait donc deux
 * menus latéraux côte à côte au-delà de 1024 px, et rognait d'autant la
 * lecture — qui est tout l'objet d'un tutoriel.
 *
 * Le sommaire garde ses deux fonctions, la recherche et la navigation entre
 * modules ; il s'ouvre en panneau, à la demande, comme le tiroir mobile de la
 * coque. Le bouton reste visible en permanence, donc rien n'est caché : c'est
 * un déplacement, pas une suppression.
 */
export function TutorielLayout({
  children,
  currentModuleId,
  currentSectionId,
}: TutorielLayoutProps) {
  const [sommaireOuvert, setSommaireOuvert] = useState(false)

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Sheet open={sommaireOuvert} onOpenChange={setSommaireOuvert}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <List className="h-4 w-4" aria-hidden="true" />
              Sommaire
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto p-0">
            <SheetHeader className="border-b p-4 text-left">
              <SheetTitle>Sommaire du tutoriel</SheetTitle>
              <SheetDescription>
                Cherchez un sujet, ou passez d'un module à l'autre.
              </SheetDescription>
            </SheetHeader>
            <div className="border-b p-4">
              <TutorielSearch />
            </div>
            <div onClick={() => setSommaireOuvert(false)}>
              <TutorielSidebar
                currentModuleId={currentModuleId}
                currentSectionId={currentSectionId}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
