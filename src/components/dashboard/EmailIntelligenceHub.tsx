import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Brain, Mail, AlertCircle, Zap, TrendingUp, Building2, ArrowRight, Filter } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useEmailDashboardStats } from "@/hooks/email/useEmailDashboardStats"
import { useAISuggestions } from "@/hooks/ai/useAISuggestions"
import { useEtablissementEmailSuggestions } from "@/hooks/crm/useEtablissementEmailSuggestions"
import { EmailToEtablissementSuggestionCard } from '@/components/email/EmailToEtablissementSuggestionCard'
import { CleanupSuggestionsButton } from "@/components/email/CleanupSuggestionsButton"
import { EmailTaskScanButton } from "@/components/dashboard/EmailTaskScanButton"
import { cn } from "@/lib/utils"
import { IconCircle } from "@/components/ui/icon-circle"
import { GlowBadge } from "@/components/ui/glow-badge"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { EmailIntelligenceAIDialog, getConfidenceColor } from "@/components/dashboard/EmailIntelligenceAIDialog"

export function EmailIntelligenceHub() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiDialogGroupOrder, setAiDialogGroupOrder] = useState<string[]>([])
  const [filterActionType, setFilterActionType] = useState<string>("all")
  const [filterConfidence, setFilterConfidence] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("date")
  const [bulkConfirm, setBulkConfirm] = useState<
    | { kind: 'approve' | 'reject'; etablissementId: string; etablissementNom: string; count: number }
    | null
  >(null)
  const { data: emailStats, isLoading: emailLoading } = useEmailDashboardStats()
  const { 
    suggestions: aiSuggestions, 
    isLoading: aiLoading,
    approveSuggestionAsync: approveAISuggestionAsync,
    rejectSuggestionAsync: rejectAISuggestionAsync,
    isApproving: isApprovingAI,
    isRejecting: isRejectingAI
  } = useAISuggestions()
  const { acceptSuggestion, rejectSuggestion, isAccepting, isRejecting } = useEtablissementEmailSuggestions()
  const [processingSuggestionId, setProcessingSuggestionId] = useState<string | null>(null)

  const isLoading = emailLoading || aiLoading

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-primary to-success" />
        <CardHeader className="bg-gradient-to-r from-violet-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const { newProspects, pendingSuggestions } = emailStats || {
    newProspects: { count: 0, total_ca: 0, prospects: [] },
    pendingSuggestions: { count: 0, avg_confidence: 0, suggestions: [] }
  }

  // Apply filters and sort
  const filteredSuggestions = aiSuggestions?.filter(suggestion => {
    // Filter by action type
    if (filterActionType !== "all" && suggestion.action_type !== filterActionType) {
      return false
    }
    
    // Filter by confidence
    if (filterConfidence === "high" && suggestion.confidence_score < 0.8) {
      return false
    }
    if (filterConfidence === "medium" && (suggestion.confidence_score < 0.6 || suggestion.confidence_score >= 0.8)) {
      return false
    }
    if (filterConfidence === "low" && suggestion.confidence_score >= 0.6) {
      return false
    }
    
    return true
  }).sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    if (sortBy === "confidence") {
      return b.confidence_score - a.confidence_score
    }
    return 0
  }) || []

  const groupedAISuggestions = filteredSuggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.etablissement_id]) {
      acc[suggestion.etablissement_id] = []
    }
    acc[suggestion.etablissement_id].push(suggestion)
    return acc
  }, {} as Record<string, typeof filteredSuggestions>) || {}

  const aiSuggestionsCount = aiSuggestions?.length || 0
  const filteredSuggestionsCount = filteredSuggestions.length
  const etablissementCount = Object.keys(groupedAISuggestions).length
  const orderedGroupedAISuggestionEntries = Object.entries(groupedAISuggestions).sort(([a], [b]) => {
    const indexA = aiDialogGroupOrder.indexOf(a)
    const indexB = aiDialogGroupOrder.indexOf(b)

    if (indexA === -1 && indexB === -1) return 0
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  const handleAIDialogOpenChange = (open: boolean) => {
    if (open) {
      setAiDialogGroupOrder(Object.keys(groupedAISuggestions))
    } else {
      setAiDialogGroupOrder([])
    }
    setAiDialogOpen(open)
  }

  const requestBulk = (
    kind: 'approve' | 'reject',
    etablissementId: string,
    etablissementNom: string,
  ) => {
    const suggestions = groupedAISuggestions[etablissementId] || []
    if (suggestions.length === 0) return
    setBulkConfirm({ kind, etablissementId, etablissementNom, count: suggestions.length })
  }

  const confirmBulk = async () => {
    if (!bulkConfirm) return
    const suggestions = groupedAISuggestions[bulkConfirm.etablissementId] || []
    setBulkConfirm(null)
    for (const suggestion of suggestions) {
      if (bulkConfirm.kind === 'approve') {
        await approveAISuggestionAsync(suggestion.id)
      } else {
        await rejectAISuggestionAsync(suggestion.id)
      }
    }
  }

  const handleApproveOne = async (suggestionId: string) => {
    setProcessingSuggestionId(suggestionId)
    try {
      await approveAISuggestionAsync(suggestionId)
    } finally {
      setProcessingSuggestionId(null)
    }
  }

  const handleRejectOne = async (suggestionId: string) => {
    setProcessingSuggestionId(suggestionId)
    try {
      await rejectAISuggestionAsync(suggestionId)
    } finally {
      setProcessingSuggestionId(null)
    }
  }

  // Calculate global stats based on filtered suggestions
  const avgConfidence = filteredSuggestions.length 
    ? Math.round((filteredSuggestions.reduce((sum, s) => sum + s.confidence_score, 0) / filteredSuggestions.length) * 100) 
    : 0
  const highConfCount = filteredSuggestions.filter(s => s.confidence_score >= 0.8).length
  const lowConfCount = filteredSuggestions.filter(s => s.confidence_score < 0.6).length

  return (
    <>
      <Card className="h-full flex flex-col overflow-hidden">
        {/* Premium accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-primary to-success" />
        
        <CardHeader className="bg-gradient-to-r from-violet-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <IconCircle 
              icon={Brain} 
              variant="gradient" 
              color="primary" 
              size="lg"
              className="bg-gradient-to-br from-violet-500 to-primary"
            />
            <div>
              <CardTitle className="text-lg">Intelligence Email</CardTitle>
              <CardDescription>Analyse IA des derniers 7 jours</CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col">
          <Tabs defaultValue="actions" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
              <TabsTrigger 
                value="actions" 
                className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Zap className="h-3 w-3 mr-1" />
                Actions IA
                {aiSuggestionsCount > 0 && (
                  <GlowBadge variant="primary" size="sm" glow className="ml-1">
                    {aiSuggestionsCount}
                  </GlowBadge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="prospects" 
                className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Mail className="h-3 w-3 mr-1" />
                Nouveaux
              </TabsTrigger>
              <TabsTrigger 
                value="validation" 
                className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                À valider
                {pendingSuggestions.count > 0 && (
                  <GlowBadge variant="accent" size="sm" glow className="ml-1">
                    {pendingSuggestions.count}
                  </GlowBadge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="actions" className="flex-1 space-y-4 mt-4">
              <motion.div 
                className="grid grid-cols-2 gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Actions suggérées</p>
                  <p className="text-3xl font-black text-primary">{aiSuggestionsCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Établissements</p>
                  <p className="text-3xl font-black">{etablissementCount}</p>
                </div>
              </motion.div>

              {/* Bouton de scan des emails récents */}
              <EmailTaskScanButton />

              {aiSuggestionsCount > 0 && (
                <div className="space-y-2">
                  {Object.entries(
                    aiSuggestions?.reduce((acc, s) => {
                      acc[s.action_type] = (acc[s.action_type] || 0) + 1
                      return acc
                    }, {} as Record<string, number>) || {}
                  ).map(([type, count]) => (
                    <div 
                      key={type} 
                      className="flex justify-between items-center p-2.5 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-xs font-medium">
                        {type === 'update_task' && 'Mises à jour'}
                        {type === 'create_task' && 'Créations'}
                        {type === 'change_status' && 'Changements de statut'}
                        {type === 'update_summary' && 'Résumés'}
                      </p>
                      <Badge variant="secondary" className="bg-primary/10 text-primary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                className={cn(
                  "w-full mt-auto group",
                  aiSuggestionsCount > 0 && "shadow-glow-blue"
                )}
                onClick={() => handleAIDialogOpenChange(true)}
                disabled={aiSuggestionsCount === 0}
              >
                {aiSuggestionsCount > 0 ? "Voir et appliquer" : "Aucune action"}
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </TabsContent>

            <TabsContent value="prospects" className="flex-1 space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{newProspects.count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">CA Potentiel</p>
                  <p className="text-2xl font-bold flex items-center gap-1 text-green-600 dark:text-green-400">
                    <TrendingUp className="h-4 w-4" />
                    {Math.round(newProspects.total_ca / 1000)}k€
                  </p>
                </div>
              </div>

              {newProspects.prospects.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Derniers ajouts</p>
                  {newProspects.prospects.slice(0, 2).map((prospect: any) => (
                    <div
                      key={prospect.id}
                      className="flex items-start gap-2 p-2 rounded-lg border bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate(`/etablissements/${prospect.id}`)}
                    >
                      <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{prospect.nom}</p>
                        <p className="text-xs text-muted-foreground">{prospect.ville}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Aucun nouveau prospect
                </div>
              )}

              <Button
                variant="outline"
                className="w-full mt-auto"
                onClick={() => navigate('/etablissements?filter=email-created')}
              >
                Voir tous les prospects emails
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </TabsContent>

            <TabsContent value="validation" className="flex-1 space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className={cn(
                    "text-2xl font-bold flex items-center gap-2",
                    pendingSuggestions.count > 0 && "text-orange-600"
                  )}>
                    {pendingSuggestions.count}
                    {pendingSuggestions.count > 0 && <AlertCircle className="h-4 w-4" />}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Confiance moy.</p>
                  <p className={cn("text-2xl font-bold", getConfidenceColor(pendingSuggestions.avg_confidence))}>
                    {Math.round(pendingSuggestions.avg_confidence * 100)}%
                  </p>
                </div>
              </div>

              {pendingSuggestions.count > 0 && (
                <div className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-950/20">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Action requise
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pendingSuggestions.count} suggestion{pendingSuggestions.count > 1 ? 's' : ''} nécessite{pendingSuggestions.count > 1 ? 'nt' : ''} validation
                  </p>
                </div>
              )}

              <Button
                variant={pendingSuggestions.count > 0 ? "default" : "outline"}
                className="w-full mt-auto"
                onClick={() => setDialogOpen(true)}
                disabled={pendingSuggestions.count === 0}
              >
                {pendingSuggestions.count > 0 ? "Traiter les suggestions" : "Aucune suggestion"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Suggestions de prospects ({pendingSuggestions.count})
              </DialogTitle>
              <CleanupSuggestionsButton />
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {pendingSuggestions.suggestions.map((suggestion: any) => (
              <EmailToEtablissementSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={({ suggestionId, createNew }) => {
                  acceptSuggestion({ suggestionId, createNew })
                }}
                onReject={(suggestionId) => {
                  rejectSuggestion(suggestionId)
                }}
                isAccepting={isAccepting}
                isRejecting={isRejecting}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <EmailIntelligenceAIDialog
        open={aiDialogOpen}
        onOpenChange={handleAIDialogOpenChange}
        aiSuggestionsCount={aiSuggestionsCount}
        filteredSuggestionsCount={filteredSuggestionsCount}
        orderedGroupedAISuggestionEntries={orderedGroupedAISuggestionEntries}
        filterActionType={filterActionType}
        setFilterActionType={setFilterActionType}
        filterConfidence={filterConfidence}
        setFilterConfidence={setFilterConfidence}
        sortBy={sortBy}
        setSortBy={setSortBy}
        avgConfidence={avgConfidence}
        highConfCount={highConfCount}
        lowConfCount={lowConfCount}
        isApprovingAI={isApprovingAI}
        isRejectingAI={isRejectingAI}
        processingSuggestionId={processingSuggestionId}
        onRequestBulk={requestBulk}
        onApproveOne={handleApproveOne}
        onRejectOne={handleRejectOne}
      />

      <AlertDialog open={!!bulkConfirm} onOpenChange={(open) => !open && setBulkConfirm(null)}>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkConfirm?.kind === 'approve'
                ? `Appliquer ${bulkConfirm?.count} suggestion${(bulkConfirm?.count ?? 0) > 1 ? 's' : ''} ?`
                : `Ignorer ${bulkConfirm?.count} suggestion${(bulkConfirm?.count ?? 0) > 1 ? 's' : ''} ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirm?.kind === 'approve' ? (
                <>
                  Toutes les actions IA en attente pour <strong>{bulkConfirm?.etablissementNom}</strong> seront
                  appliquées en cascade (création/mise à jour de tâches, changements de statut, etc.). Cette
                  opération est irréversible.
                </>
              ) : (
                <>
                  Toutes les suggestions en attente pour <strong>{bulkConfirm?.etablissementNom}</strong> seront
                  rejetées. Vous pourrez relancer une analyse plus tard.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulk}>
              {bulkConfirm?.kind === 'approve' ? 'Tout approuver' : 'Tout ignorer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default EmailIntelligenceHub;
