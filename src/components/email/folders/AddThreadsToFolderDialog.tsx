import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Inbox } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { sanitizeEmailSubject } from '@/lib/emailUtils'
import { useThreadFolderMutations } from '@/hooks/email/useThreadFolders'
import { cn } from '@/lib/utils'

interface AddThreadsToFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: string
  folderName: string
  /** IDs des threads déjà rangés dans ce dossier (pour les pré-cocher/griser) */
  existingThreadIds: string[]
}

interface ThreadPick {
  id: string
  subject: string | null
  ai_generated_title: string | null
  last_message_date: string
  last_message_from_name: string | null
  last_message_from_email: string | null
  unread_count: number
}

/** Liste les fils de discussion récents de l'utilisateur, avec recherche. */
function useRecentThreads(search: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['folder-picker-threads', user?.id, search.trim()],
    enabled: !!user?.id,
    queryFn: async (): Promise<ThreadPick[]> => {
      let q = supabase
        .from('email_threads')
        .select(
          'id, subject, ai_generated_title, last_message_date, last_message_from_name, last_message_from_email, unread_count'
        )
        .order('last_message_date', { ascending: false })
        .limit(200)

      const s = search.trim()
      if (s) {
        // Recherche sujet ou expéditeur
        q = q.or(
          `subject.ilike.%${s}%,ai_generated_title.ilike.%${s}%,last_message_from_name.ilike.%${s}%,last_message_from_email.ilike.%${s}%`
        )
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ThreadPick[]
    },
    staleTime: 30 * 1000,
  })
}

export function AddThreadsToFolderDialog({
  open,
  onOpenChange,
  folderId,
  folderName,
  existingThreadIds,
}: AddThreadsToFolderDialogProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data: threads = [], isLoading } = useRecentThreads(search)
  const { addThreadsToFolder } = useThreadFolderMutations()

  useEffect(() => {
    if (open) {
      setSelected(new Set())
      setSearch('')
    }
  }, [open])

  const existing = useMemo(() => new Set(existingThreadIds), [existingThreadIds])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    await addThreadsToFolder.mutateAsync({ threadIds: ids, folderId })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Ajouter des emails à « {folderName} »</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 min-h-0 flex-1 flex flex-col">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par sujet ou expéditeur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
          ) : threads.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucun email trouvé</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 rounded-md border min-h-[300px]">
              <ul className="divide-y">
                {threads.map((t) => {
                  const already = existing.has(t.id)
                  const isChecked = already || selected.has(t.id)
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        'flex items-start gap-3 px-3 py-2 hover:bg-muted/50',
                        already && 'opacity-60'
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={already}
                        onCheckedChange={() => !already && toggle(t.id)}
                        className="mt-1"
                      />
                      <label
                        className={cn(
                          'flex-1 min-w-0 cursor-pointer',
                          already && 'cursor-not-allowed'
                        )}
                        onClick={() => !already && toggle(t.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm truncate font-medium">
                            {t.last_message_from_name || t.last_message_from_email || '—'}
                          </span>
                          {t.unread_count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                              Non lu
                            </span>
                          )}
                          {already && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                              Déjà rangé
                            </span>
                          )}
                        </div>
                        <p className="text-sm truncate text-foreground/90">
                          {sanitizeEmailSubject(
                            t.ai_generated_title || t.subject || '(sans objet)'
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(t.last_message_date), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <div className="mr-auto text-xs text-muted-foreground self-center">
            {selected.size > 0
              ? `${selected.size} email${selected.size > 1 ? 's' : ''} sélectionné${
                  selected.size > 1 ? 's' : ''
                }`
              : 'Cochez les emails à ranger'}
          </div>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={addThreadsToFolder.isPending}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || addThreadsToFolder.isPending}
          >
            Ranger dans le dossier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
