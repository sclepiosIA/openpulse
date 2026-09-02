import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/shared/use-toast"
import { supabase } from "@/lib/supabaseBrowser"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { debug } from "@/lib/debug"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ResetResult {
  etablissement_id: string
  etablissement_nom: string
  anciennes_taches: number
  nouvelles_taches: number
}

export function ResetProspectTasksButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleResetTasks = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('reset_prospect_tasks_to_model')
      
      if (error) {
        debug.error('Erreur lors de la réinitialisation:', error)
        toast({
          title: "Erreur",
          description: "Impossible de réinitialiser les tâches prospect",
          variant: "destructive"
        })
        return
      }

      const results = data as ResetResult[]
      const totalProspects = results.length
      const totalOldTasks = results.reduce((sum, r) => sum + r.anciennes_taches, 0)
      const totalNewTasks = results.reduce((sum, r) => sum + r.nouvelles_taches, 0)

      toast({
        title: "Réinitialisation terminée",
        description: `${totalProspects} prospects traités : ${totalOldTasks} anciennes tâches supprimées, ${totalNewTasks} nouvelles tâches créées`
      })

      debug.log('Résultats détaillés:', results)
    } catch (error) {
      debug.error('Erreur:', error)
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Réinitialiser les tâches prospects
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Réinitialiser les tâches prospects
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action va :
            <br />• Supprimer <strong>toutes</strong> les tâches existantes des établissements prospects
            <br />• Créer uniquement les tâches du modèle "Commercial"
            <br />• Remettre la progression à 0%
            <br /><br />
            <strong>Cette action est irréversible.</strong> Êtes-vous sûr de vouloir continuer ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleResetTasks} className="bg-orange-600 hover:bg-orange-700">
            Réinitialiser
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
