import { useState } from 'react'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import { Brain, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { invokeEdge } from "@/services/edgeFunctions";
import { useQueryClient } from '@tanstack/react-query'

interface SimulatorDataExtractorProps {
  etablissementId: string
}

export function SimulatorDataExtractor({ etablissementId }: SimulatorDataExtractorProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState('')
  const queryClient = useQueryClient()

  const requestSimulatorData = () => {
    setIsAnalyzing(true)
    setProgress('📡 Récupération des données du simulateur...')
    
    const iframe = document.querySelector('iframe[title="Simulateur de devis Marque"]') as HTMLIFrameElement
    
    if (!iframe?.contentWindow) {
      toast.error('❌ Simulateur non chargé')
      setIsAnalyzing(false)
      setProgress('')
      return
    }

    // Timeout de 30 secondes pour la réponse du simulateur
    const timeout = setTimeout(() => {
      setIsAnalyzing(false)
      setProgress('')
      toast.error('❌ Le simulateur n\'a pas répondu (timeout)', {
        description: 'Vérifiez que le simulateur est bien chargé et configuré'
      })
      window.removeEventListener('message', handleMessage)
    }, 30000)

    const handleMessage = async (event: MessageEvent) => {
      // Vérifier l'origine pour la sécurité
      if (event.origin !== 'https://simulateur.exploitant.example.org') return
      
      if (event.data.type === 'SIMULATOR_DATA') {
        clearTimeout(timeout)
        window.removeEventListener('message', handleMessage)
        
        try {
          // Analyser les données reçues
          await analyzeSimulatorData(event.data.data)
        } catch (error: unknown) {
          debug.error('Erreur lors de l\'analyse:', error)
          toast.error('❌ Erreur lors de l\'analyse', {
            description: sanitizeSupabaseError(error)
          })
          setIsAnalyzing(false)
          setProgress('')
        }
      }
    }

    window.addEventListener('message', handleMessage)

    // Envoyer la requête au simulateur
    iframe.contentWindow.postMessage(
      { type: 'REQUEST_SIMULATOR_DATA', source: 'marque-crm' },
      'https://simulateur.exploitant.example.org'
    )
  }

  const analyzeSimulatorData = async (simulatorData: any) => {
    try {
      setProgress('🤖 GPT-5 analyse les données...')
      
      // Appeler la fonction edge avec les données du simulateur
      const data = await invokeEdge<any>('analyze-simulator-data', {
          etablissement_id: etablissementId,
          simulator_data: simulatorData
        });
      setProgress('💾 Mise à jour de l\'établissement...')

      // Invalider les queries pour rafraîchir l'UI
      await queryClient.invalidateQueries({ queryKey: ['etablissement', etablissementId] })

      setProgress('✅ Analyse terminée !')
      
      toast.success('✅ Analyse terminée avec succès !', {
        description: 'Les données financières ont été extraites et enregistrées.'
      })

      // Reset après 1 seconde
      setTimeout(() => {
        setIsAnalyzing(false)
        setProgress('')
      }, 1000)

    } catch (error: unknown) {
      debug.error('Erreur lors de l\'analyse:', error)
      throw error
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          onClick={requestSimulatorData}
          disabled={isAnalyzing}
          size="lg"
          className="w-full sm:w-auto"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4 mr-2" />
              🤖 Récupérer et analyser le devis
            </>
          )}
        </Button>
      </div>
      
      {progress && (
        <div className="text-sm text-muted-foreground animate-pulse">
          {progress}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Configurez d'abord le devis dans le simulateur ci-dessus, puis cliquez sur ce bouton.
        GPT-5 extraira automatiquement toutes les données financières.
      </p>
    </div>
  )
}
