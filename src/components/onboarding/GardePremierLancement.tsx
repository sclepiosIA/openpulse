/**
 * Garde de premier lancement.
 *
 * Intercalée entre l'authentification et l'application : tant que l'instance
 * n'est pas configurée, un administrateur ne voit que l'assistant.
 *
 * TROIS CAS, ET TROIS COMPORTEMENTS DISTINCTS
 * - L'administrateur voit l'assistant, et ne peut pas le contourner : c'est le
 *   seul moment où la configuration est certaine d'être faite.
 * - Un utilisateur non administrateur voit un message d'attente. Lui présenter
 *   l'assistant serait cruel — la sécurité au niveau ligne refuserait l'écriture
 *   à la dernière étape, après qu'il a tout saisi.
 * - Si l'état de configuration n'a pas pu être lu, on laisse passer. Ouvrir
 *   l'assistant dans le doute ferait réécrire une configuration existante ;
 *   laisser passer ne fait, au pire, que retarder la configuration d'une
 *   instance neuve.
 */
import type { ReactNode } from 'react'
import { FullPageLoader } from '@/components/ui/full-page-loader'
import { useConfigurationInstance } from '@/hooks/shared/useConfigurationInstance'
import { useUserRole } from '@/hooks/shared/useUserRole'
import { AssistantPremierLancement } from './AssistantPremierLancement'

export function GardePremierLancement({ children }: { children: ReactNode }) {
  const { chargement, aConfigurer, indetermine } = useConfigurationInstance()
  const { role, isLoading: roleEnCours } = useUserRole()

  if (chargement || roleEnCours) return <FullPageLoader />

  // Dans le doute, on n'interrompt pas : voir l'en-tête de ce fichier.
  if (indetermine || !aConfigurer) return <>{children}</>

  if (role === 'admin') return <AssistantPremierLancement />

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Configuration en attente</h1>
        <p className="text-muted-foreground">
          Cette instance vient d’être installée et n’a pas encore été configurée. Un administrateur
          doit renseigner l’identité de votre organisation avant que l’application puisse être
          utilisée.
        </p>
        <p className="text-sm text-muted-foreground">
          Si vous êtes administrateur, déconnectez-vous et reconnectez-vous : votre rôle est
          peut-être en cache.
        </p>
      </div>
    </div>
  )
}

export default GardePremierLancement
