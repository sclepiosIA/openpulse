import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export function DataCompletionGuide() {
  return (
    <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="w-5 h-5" />
          Guide de saisie des métriques réelles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <strong>📊 NPS Score (0-10):</strong> Demandez au client de noter leur satisfaction globale.
          Enquêtes recommandées tous les 3 mois.
        </div>
        <div>
          <strong>🎫 Tickets Support:</strong> Vérifiez dans votre outil de ticketing (Freshdesk, Zendesk, etc.)
          le nombre de tickets actuellement ouverts pour ce client.
        </div>
        <div>
          <strong>💰 CA Annuel:</strong> Le système calcule automatiquement le CA depuis le palier réalisé.
          Si incorrect, vérifiez les tarifs dans la fiche établissement.
        </div>
        <div>
          <strong>✅ Adoption:</strong> Renseignez les taux d'utilisation de la cotation et de complétion
          des dossiers (disponibles dans les stats Metabase).
        </div>
      </CardContent>
    </Card>
  )
}
