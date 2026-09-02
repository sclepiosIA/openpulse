import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Unlock,
  Calendar,
  FileText,
  Building2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn, formatNumber } from "@/lib/utils"
import { useUpdateEtablissement, type Etablissement } from "@/hooks/crm/useEtablissements"
import type { Database } from "@/integrations/supabase/types"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { calculateEtablissementValue } from "@/lib/valueCalculations"
import { IconCircle } from "@/components/ui/icon-circle"
import { motion, AnimatePresence } from "framer-motion"

interface BlockedEtablissementsSectionProps {
  etablissements: Etablissement[]
}

export function BlockedEtablissementsSection({ etablissements }: BlockedEtablissementsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)
  const [selectedEtablissement, setSelectedEtablissement] = useState<Etablissement | null>(null)
  const [newStatus, setNewStatus] = useState<Database['public']['Enums']['statut_etablissement']>("Prospect")
  const [unblockReason, setUnblockReason] = useState("")

  const unblockMutation = useUpdateEtablissement()

  const blockedEtablissements = etablissements.filter(e => e.statut === 'Bloqué')
  const totalBlocked = blockedEtablissements.length
  const totalValueBlocked = blockedEtablissements.reduce((sum, e) => sum + calculateEtablissementValue(e), 0)

  const extractBlockReason = (notes: string | null | undefined): string => {
    if (!notes) return "Aucune raison spécifiée"
    const match = notes.match(/🚫 \[.*?\] (.+?)(?:\n|$)/)
    return match ? match[1] : "Raison non spécifiée"
  }

  const extractBlockDate = (notes: string | null | undefined): string | null => {
    if (!notes) return null
    const match = notes.match(/🚫 \[([\d-]+)\]/)
    return match ? match[1] : null
  }

  const handleUnblock = (etablissement: Etablissement) => {
    setSelectedEtablissement(etablissement)
    setNewStatus("Prospect")
    setUnblockReason("")
    setUnblockDialogOpen(true)
  }

  const confirmUnblock = () => {
    if (!selectedEtablissement || !newStatus || !unblockReason.trim()) return

    unblockMutation.mutate({
      id: selectedEtablissement.id,
      data: {
        statut: newStatus as Database['public']['Enums']['statut_etablissement'],
        notes: `${selectedEtablissement.notes || ''}\n✅ [${new Date().toISOString().split('T')[0]}] Débloqué: ${unblockReason}`.trim()
      }
    }, {
      onSuccess: () => {
        setUnblockDialogOpen(false)
        setSelectedEtablissement(null)
        setNewStatus("Prospect")
        setUnblockReason("")
      }
    })
  }

  const isEmpty = totalBlocked === 0

  return (
    <>
      <Card className={cn(
        "overflow-hidden border-2 transition-all duration-300",
        totalBlocked > 0 
          ? "border-destructive/40 shadow-[0_0_20px_-6px_hsl(var(--destructive)/0.25)]" 
          : "border-border"
      )}>
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-destructive via-red-400 to-destructive" />
        
        <CardHeader 
          className={cn(
            "cursor-pointer transition-colors",
            "bg-gradient-to-r from-destructive/5 to-transparent",
            "hover:from-destructive/10"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconCircle 
                icon={AlertTriangle} 
                variant={totalBlocked > 0 ? "gradient" : "soft"} 
                color="destructive" 
                size="lg"
                className={totalBlocked > 0 ? "animate-pulse" : ""}
              />
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Établissements bloqués
                  <Badge 
                    variant="destructive" 
                    className={cn(
                      "ml-2",
                      totalBlocked > 0 && "animate-pulse"
                    )}
                  >
                    {totalBlocked}
                  </Badge>
                </CardTitle>
                <CardDescription className={totalBlocked > 0 ? "text-destructive/70" : ""}>
                  Valeur totale bloquée : {formatNumber(totalValueBlocked)} €
                </CardDescription>
              </div>
            </div>
            {/* Bouton uniquement iconique : sans libellé, aucun nom accessible
                (axe `button-name`, critical). */}
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={isExpanded}
              aria-label={
                isExpanded
                  ? 'Masquer les établissements bloqués'
                  : 'Afficher les établissements bloqués'
              }
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="space-y-4 pb-6">
                {isEmpty ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="p-4 rounded-full bg-success/10 w-fit mx-auto mb-3">
                      <AlertTriangle className="h-12 w-12 text-success opacity-40" />
                    </div>
                    <p className="text-sm font-medium">Aucun établissement bloqué pour le moment</p>
                    <p className="text-xs mt-2">Les établissements avec une tâche bloquée apparaîtront ici automatiquement</p>
                  </div>
                ) : (
                  blockedEtablissements.map((etablissement, index) => {
                    const blockReason = extractBlockReason(etablissement.notes)
                    const blockDate = extractBlockDate(etablissement.notes)
                    const value = calculateEtablissementValue(etablissement)

                    return (
                      <motion.div
                        key={etablissement.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                          "relative p-4 rounded-xl border-l-4 border-l-destructive",
                          "bg-background border border-destructive/20",
                          "hover:shadow-[0_0_15px_-4px_hsl(var(--destructive)/0.2)] transition-all duration-300"
                        )}
                      >
                        {/* Pulsing dot */}
                        <div className="absolute left-0 top-6 -translate-x-1/2">
                          <div className="relative w-3 h-3 rounded-full bg-destructive border-2 border-background">
                            <span className="absolute inset-0 rounded-full bg-destructive animate-pulse-ring" />
                          </div>
                        </div>
                        
                        <div className="flex items-start justify-between gap-2 sm:gap-4 pl-2">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <h4 className="font-semibold truncate">{etablissement.nom}</h4>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {etablissement.ville}
                              </Badge>
                            </div>

                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <p className="flex-1 line-clamp-3">{blockReason}</p>
                            </div>

                            {blockDate && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  Bloqué le {format(new Date(blockDate), "dd MMMM yyyy", { locale: fr })}
                                </span>
                              </div>
                            )}

                            {value > 0 && (
                              <div className="text-sm font-semibold text-destructive">
                                Valeur : {formatNumber(value)} €
                              </div>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnblock(etablissement)
                            }}
                            className={cn(
                              "flex items-center gap-1.5 shrink-0",
                              "h-8 px-2 sm:px-3 text-xs sm:text-sm",
                              "hover:bg-success/10 hover:text-success hover:border-success",
                              "transition-all duration-300"
                            )}
                          >
                            <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Débloquer</span>
                          </Button>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Dialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Débloquer l'établissement</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de débloquer : <strong>{selectedEtablissement?.nom}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-status">Nouveau statut</Label>
              <Select 
                value={newStatus} 
                onValueChange={(value) => setNewStatus(value as Database['public']['Enums']['statut_etablissement'])}
              >
                <SelectTrigger id="new-status">
                  <SelectValue placeholder="Choisir le nouveau statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Contacté">Contacté</SelectItem>
                  <SelectItem value="Attente RDV">Attente RDV</SelectItem>
                  <SelectItem value="RDV pris">RDV pris</SelectItem>
                  <SelectItem value="Dans les RDV">Dans les RDV</SelectItem>
                  <SelectItem value="Etude émise">Étude émise</SelectItem>
                  <SelectItem value="Négociation">Négociation</SelectItem>
                  <SelectItem value="Contractualisation">Contractualisation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unblock-reason">Raison du déblocage</Label>
              <Textarea
                id="unblock-reason"
                placeholder="Expliquez pourquoi vous débloquez cet établissement..."
                value={unblockReason}
                onChange={(e) => setUnblockReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnblockDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={confirmUnblock}
              disabled={!newStatus || !unblockReason.trim() || unblockMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              {unblockMutation.isPending ? "Déblocage..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
