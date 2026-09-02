import { useState } from "react"
import { debug } from "@/lib/debug"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/shared/use-toast"
import { supabase } from "@/lib/supabaseBrowser"
import { useEtablissement } from "@/hooks/crm/useEtablissements"
import { AdminActionButton } from "@/components/security/AdminActionButton"

interface SyncTaskModelsButtonProps {
  etablissementId: string
  onTasksUpdated?: () => void
}

interface SyncResult {
  etablissement_nom: string
  statut_etablissement: string
  taches_creees: number
  taches_supprimees: number
}

export function SyncTaskModelsButton({ etablissementId, onTasksUpdated }: SyncTaskModelsButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const { toast } = useToast()
  const { data: etablissement } = useEtablissement(etablissementId)

  const handleSync = async () => {
    setIsLoading(true)
    try {
      // Appeler la nouvelle fonction qui synchronise toutes les tâches avec les modèles actifs
      const { data, error } = await supabase
        .rpc('sync_all_tasks_with_models', { 
          p_etablissement_id: etablissementId 
        })

      if (error) throw error

      const result = data?.[0]
      
      if (result) {
        setResult({
          etablissement_nom: result.etablissement_nom,
          statut_etablissement: result.statut_etablissement,
          taches_creees: result.taches_creees,
          taches_supprimees: result.taches_supprimees
        })
        
        toast({
          title: "Synchronisation réussie",
          description: `${result.taches_supprimees} tâches supprimées, ${result.taches_creees} tâches créées selon les modèles actifs`
        })
        
        if (onTasksUpdated) {
          onTasksUpdated()
        }
      }
    } catch (error) {
      debug.error('Error syncing task models:', error)
      toast({
        title: "Erreur",
        description: "Impossible de synchroniser les tâches avec les modèles",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'Prospect': return 'bg-blue-500'
      case 'Contractuel': return 'bg-purple-500'
      case 'Conformité': return 'bg-orange-500'
      case 'Déploiement': return 'bg-cyan-500'
      case 'Formation': return 'bg-green-500'
      case 'Go-Live': return 'bg-emerald-500'
      case 'Production': return 'bg-emerald-700'
      default: return 'bg-gray-500'
    }
  }

  // Ne montrer le bouton que si l'établissement existe
  if (!etablissement) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <AdminActionButton
          operationName="Synchronisation des modèles de tâches"
          description="Cette opération va supprimer toutes les tâches existantes et les recréer selon les modèles."
          onConfirm={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="gap-2"
          requireConfirmation={false}
        >
          <RefreshCw className="w-4 h-4" />
          Synchroniser avec les modèles
        </AdminActionButton>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Synchroniser les tâches avec les modèles</DialogTitle>
          <DialogDescription>
            Cette action va supprimer toutes les tâches existantes et les remplacer par TOUTES les tâches 
            des modèles actifs (Commercial, Déploiement et Production).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informations sur l'établissement */}
          <div className="p-4 bg-muted/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div>
                <div className="font-medium">{etablissement.nom}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${getStatusColor(etablissement.statut)} text-white text-xs`}>
                    {etablissement.statut}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {etablissement.ville}, {etablissement.region}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Avertissement */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">Attention</div>
                <div className="text-yellow-700 mt-1">
                  Cette action va supprimer définitivement toutes les tâches existantes et les remplacer 
                  par toutes les tâches actives des modèles (toutes phases). Cette action est irréversible.
                </div>
              </div>
          </div>

          {!result && (
            <div className="text-center py-4">
              <Button 
                onClick={handleSync} 
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Synchronisation en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Lancer la synchronisation
                  </>
                )}
              </Button>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold">Synchronisation terminée</h3>
              </div>

              <div className="p-4 border rounded-lg bg-green-50">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Établissement :</span>
                    <span className="text-sm">{result.etablissement_nom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Statut :</span>
                    <Badge className={`${getStatusColor(result.statut_etablissement)} text-white text-xs`}>
                      {result.statut_etablissement}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Tâches supprimées :</span>
                    <span className="text-sm font-medium text-red-700">
                      {result.taches_supprimees}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Tâches créées :</span>
                    <span className="text-sm font-medium text-green-700">
                      {result.taches_creees}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Button 
                  onClick={() => {
                    setIsOpen(false)
                    setResult(null)
                  }}
                  className="w-full"
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}