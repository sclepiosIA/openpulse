import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmailComposer } from "@/components/email/EmailComposer"
import { supabase } from "@/lib/supabaseBrowser"
import { useAuth } from "@/components/AuthProvider"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/shared/use-toast"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  etablissementId: string
  etablissementName: string
  fallbackEmail?: string | null
}

interface Contact {
  id: string
  nom: string | null
  prenom: string | null
  email: string | null
  fonction: string | null
  est_contact_principal: boolean | null
}

export function ProspectEmailComposerDialog({
  open,
  onOpenChange,
  etablissementId,
  etablissementName,
  fallbackEmail,
}: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDraft, setAiDraft] = useState<{ subject: string; body: string } | null>(null)
  const [loading, setLoading] = useState(false)

  // Load contacts when opening
  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data: cts } = await supabase
        .from("contacts")
        .select("id, nom, prenom, email, fonction, est_contact_principal")
        .eq("etablissement_id", etablissementId)
        .not("email", "is", null)

      if (cancelled) return

      const ctsList = (cts || []) as Contact[]
      setContacts(ctsList)

      const principal = ctsList.find((c) => c.est_contact_principal && c.email)
      const first = principal ?? ctsList.find((c) => !!c.email)
      setSelectedEmail(first?.email ?? fallbackEmail ?? null)

      setLoading(false)
    })().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, user, etablissementId, fallbackEmail])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setAiDraft(null)
      setAiLoading(false)
    }
  }, [open])

  const initialRecipient = useMemo(() => {
    if (!selectedEmail) return null
    const c = contacts.find((c) => c.email === selectedEmail)
    const name = c ? [c.prenom, c.nom].filter(Boolean).join(" ") : undefined
    return { email: selectedEmail, name: name || undefined }
  }, [selectedEmail, contacts])

  const initialDraft = aiDraft
    ? {
        id: undefined as unknown as string,
        subject: aiDraft.subject,
        body: aiDraft.body,
        to_addresses: selectedEmail ?? "",
        cc_addresses: "",
        bcc_addresses: "",
      }
    : undefined

  const handleGenerateAi = async () => {
    setAiLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("help-me-write-email", {
        body: {
          action: "generate_new",
          etablissement_id: etablissementId,
          recipient_emails: selectedEmail ? [selectedEmail] : [],
          custom_instruction: `Rédige un email professionnel et engageant à destination de ${etablissementName}. Contexte: prospection commerciale OpenPulse.`,
          sender_name: user?.user_metadata?.full_name || undefined,
        },
      })
      if (error) throw error
      const body: string = (data?.result || data?.content || data?.body || "").toString()
      const subject: string =
        (data?.subject as string) || `Prise de contact — ${etablissementName}`
      if (!body) throw new Error("Réponse IA vide")
      setAiDraft({ subject, body })
      toast({ title: "Brouillon IA généré", description: "Vous pouvez l'ajuster avant envoi." })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue"
      toast({ title: "Génération IA impossible", description: msg, variant: "destructive" })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="text-base flex items-center gap-2">
            Envoyer un email — {etablissementName}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b bg-muted/30 shrink-0 space-y-2">
          {contacts.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {contacts
                .filter((c) => !!c.email)
                .map((c) => {
                  const active = c.email === selectedEmail
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedEmail(c.email)}
                      className={
                        "text-xs px-2 py-1 rounded-md border transition " +
                        (active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted")
                      }
                    >
                      {[c.prenom, c.nom].filter(Boolean).join(" ") || c.email}
                      {c.fonction ? (
                        <span className="opacity-70"> · {c.fonction}</span>
                      ) : null}
                    </button>
                  )
                })}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground truncate">
              {selectedEmail ? (
                <>Destinataire : <span className="font-medium text-foreground">{selectedEmail}</span></>
              ) : (
                <span className="italic">Aucun email de contact enregistré pour ce prospect.</span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerateAi}
              disabled={aiLoading || !selectedEmail}
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Rédiger avec l'IA
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Chargement…
            </div>
          ) : (
            <EmailComposer
              key={`${selectedEmail ?? "none"}-${aiDraft ? "ai" : "clean"}`}
              accountId="all"
              initialRecipient={initialRecipient}
              initialDraft={initialDraft as never}
              onCancel={() => onOpenChange(false)}
              onSent={() => {
                toast({ title: "Email envoyé" })
                onOpenChange(false)
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
