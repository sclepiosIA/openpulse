import {
  Link2, FolderOpen, Lock, Server, BarChart3,
  MessageSquare, Calendar, MapPin, Code, Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { IconeApplication } from '@/hooks/shared/useApplicationsExternes'

/**
 * Correspondance entre le nom d'icône enregistré en base et le composant.
 *
 * La base ne peut pas stocker un composant : elle stocke un nom. Cette table
 * vit à part pour que l'écran de configuration et le menu résolvent le même
 * nom de la même façon — deux tables divergentes donneraient une icône à
 * l'édition et une autre à l'affichage.
 */
export const ICONES_PAR_NOM: Record<IconeApplication, LucideIcon> = {
  lien: Link2,
  dossier: FolderOpen,
  coffre: Lock,
  serveur: Server,
  graphique: BarChart3,
  message: MessageSquare,
  agenda: Calendar,
  carte: MapPin,
  code: Code,
  boutique: Store,
}

/** Repli explicite : un nom inconnu ne doit pas faire disparaître l'entrée. */
export function iconeApplication(nom: string): LucideIcon {
  return ICONES_PAR_NOM[nom as IconeApplication] ?? Link2
}
