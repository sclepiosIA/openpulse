import { useState } from 'react'
import DOMPurify from 'dompurify'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Sparkles,
  X,
  Wand2,
  Languages,
  FileCheck,
  Minimize2,
  Maximize2,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { callContractAiAssist } from '@/services/contrats/contractAiAssist'
import { toast } from 'sonner'

interface ContractAIToolbarProps {
  content: string
  sectionTitle: string
  onApply: (newContent: string) => void
  onClose: () => void
}

type AIAction = 'simplify' | 'formalize' | 'expand' | 'shorten' | 'check' | 'translate' | 'custom'

const AI_ACTIONS = [
  {
    id: 'simplify' as const,
    label: 'Simplifier',
    icon: Minimize2,
    description: 'Rendre plus accessible',
  },
  { id: 'formalize' as const, label: 'Formaliser', icon: Maximize2, description: 'Ton juridique' },
  { id: 'expand' as const, label: 'Développer', icon: Wand2, description: 'Ajouter des détails' },
  { id: 'shorten' as const, label: 'Résumer', icon: Minimize2, description: 'Version concise' },
  { id: 'check' as const, label: 'Vérifier', icon: FileCheck, description: 'Cohérence juridique' },
  {
    id: 'translate' as const,
    label: 'Traduire EN',
    icon: Languages,
    description: 'Version anglaise',
  },
]

export function ContractAIToolbar({
  content,
  sectionTitle,
  onApply,
  onClose,
}: ContractAIToolbarProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [selectedAction, setSelectedAction] = useState<AIAction | null>(null)

  const handleAction = async (action: AIAction, prompt?: string) => {
    setIsProcessing(true)
    setError(null)
    setResult(null)
    setSelectedAction(action)

    try {
      const data = await callContractAiAssist({
        action,
        content,
        sectionTitle,
        customPrompt: prompt,
      })

      if (data?.result) {
        setResult(data.result)
      } else if (data?.error) {
        throw new Error(data.error)
      }
    } catch (err: unknown) {
      debug.error('AI Error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du traitement IA'
      setError(errorMessage)
      toast.error('Erreur IA', { description: errorMessage })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApply = () => {
    if (result) {
      onApply(result)
      setResult(null)
      toast.success('Modifications appliquées')
    }
  }

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      handleAction('custom', customPrompt)
    }
  }

  return (
    <Card className="mx-4 my-2 p-3 border-purple-200 bg-gradient-to-r from-purple-50/50 to-blue-50/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium">Assistant IA Contrats</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Fermer"
          title="Fermer"
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-3">
        {AI_ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant={selectedAction === action.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleAction(action.id)}
            disabled={isProcessing}
            className={cn('text-xs', selectedAction === action.id && 'bg-purple-600')}
          >
            <action.icon className="h-3 w-3 mr-1" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Custom prompt */}
      <div className="flex gap-2 mb-3">
        <Textarea
          placeholder="Ou décrivez votre demande personnalisée..."
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          className="min-h-[60px] text-sm resize-none"
          disabled={isProcessing}
        />
        <Button
          onClick={handleCustomSubmit}
          disabled={isProcessing || !customPrompt.trim()}
          size="sm"
          className="shrink-0"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Loading state */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analyse en cours...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive py-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Suggestion générée
            </Badge>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleApply}>
                Appliquer
              </Button>
            </div>
          </div>
          <div
            className="text-sm bg-card border rounded-md p-3 max-h-[200px] overflow-auto prose prose-sm"
            // safe: DOMPurify.sanitize applied inline before injection
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result) }}
          />
        </div>
      )}
    </Card>
  )
}
