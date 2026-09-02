import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Search, FolderOpen, MoreVertical, Pencil, Trash2, X, MailPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

import { useEmailFolders, type EmailFolder } from '@/hooks/email/useEmailFolders'
import { useFolderThreads, useThreadFolderMutations } from '@/hooks/email/useThreadFolders'
import { EmailFolderDialog, getFolderColorClass, getFolderIconComponent } from './EmailFolderDialog'
import { AddThreadsToFolderDialog } from './AddThreadsToFolderDialog'
import { sanitizeEmailSubject } from '@/lib/emailUtils'

interface EmailFoldersViewProps {
  /** Callback appelé quand l'utilisateur clique un thread pour l'ouvrir dans l'inbox */
  onOpenThread: (threadId: string) => void
}

interface ThreadRow {
  id: string
  subject: string | null
  ai_generated_title: string | null
  last_message_date: string
  last_message_from_name: string | null
  last_message_from_email: string | null
  unread_count: number
  is_processed: boolean | null
}

function useFolderThreadDetails(threadIds: string[]) {
  return useQuery({
    queryKey: ['folder-thread-details', threadIds.sort().join(',')],
    enabled: threadIds.length > 0,
    queryFn: async (): Promise<ThreadRow[]> => {
      const { data, error } = await supabase
        .from('email_threads')
        .select(
          'id, subject, ai_generated_title, last_message_date, last_message_from_name, last_message_from_email, unread_count, is_processed'
        )
        .in('id', threadIds)
        .order('last_message_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as ThreadRow[]
    },
    staleTime: 30 * 1000,
  })
}

export function EmailFoldersView({ onOpenThread }: EmailFoldersViewProps) {
  const { folders, counts, isLoading, deleteFolder } = useEmailFolders()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFolderId = searchParams.get('folder')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<EmailFolder | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { removeThreadFromFolder } = useThreadFolderMutations()

  const { data: threadLinks = [] } = useFolderThreads(activeFolderId)
  const { data: threads = [], isLoading: threadsLoading } = useFolderThreadDetails(
    threadLinks.map((l) => l.thread_id)
  )

  const activeFolder = folders.find((f) => f.id === activeFolderId) ?? null

  const setActiveFolder = (id: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('folder', id)
    else next.delete('folder')
    setSearchParams(next, { replace: true })
  }

  const filteredFolders = folders.filter((f) =>
    search.trim() ? f.name.toLowerCase().includes(search.trim().toLowerCase()) : true
  )

  const handleDelete = async (folder: EmailFolder) => {
    if (
      !window.confirm(
        `Supprimer le dossier "${folder.name}" ? Les emails ne seront pas supprimés, seul le rangement dans ce dossier sera perdu.`
      )
    )
      return
    await deleteFolder.mutateAsync(folder.id)
    if (activeFolderId === folder.id) setActiveFolder(null)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 w-full max-w-full min-w-0">
      {/* Sidebar dossiers */}
      <aside className="rounded-lg border bg-card p-3 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Mes dossiers</h2>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <ScrollArea className="flex-1 min-h-[200px] max-h-[60vh]">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Chargement…</p>
          ) : filteredFolders.length === 0 ? (
            <div className="text-center py-6 space-y-2 px-2">
              <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {folders.length === 0
                  ? 'Aucun dossier. Créez-en un pour ranger vos emails.'
                  : 'Aucun dossier ne correspond.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredFolders.map((f) => {
                const Icon = getFolderIconComponent(f.icon)
                const isActive = activeFolderId === f.id
                const count = counts[f.id] ?? 0
                return (
                  <li key={f.id}>
                    <div
                      className={cn(
                        'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted/60'
                      )}
                      onClick={() => setActiveFolder(f.id)}
                    >
                      <span
                        className={cn(
                          'h-6 w-6 rounded flex items-center justify-center flex-shrink-0',
                          getFolderColorClass(f.color)
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span
                        className={cn(
                          'text-sm truncate flex-1 min-w-0',
                          isActive && 'font-medium text-primary'
                        )}
                      >
                        {f.name}
                      </span>
                      {count > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {count}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Actions"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => setEditing(f)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Renommer / modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(f)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Contenu */}
      <section className="rounded-lg border bg-card p-3 min-w-0">
        {!activeFolder ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2 px-4">
            <FolderOpen className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-semibold">Sélectionnez un dossier</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Créez vos propres dossiers pour organiser vos emails. Un fil de discussion peut être
              rangé dans plusieurs dossiers à la fois. Vos dossiers restent internes à OpenPulse :
              ils ne sont pas synchronisés avec votre serveur mail.
            </p>
            {folders.length === 0 && (
              <Button className="mt-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Créer mon premier dossier
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={cn(
                  'h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0',
                  getFolderColorClass(activeFolder.color)
                )}
              >
                {(() => {
                  const Icon = getFolderIconComponent(activeFolder.icon)
                  return <Icon className="h-4 w-4" />
                })()}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold truncate">{activeFolder.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {threadLinks.length} fil{threadLinks.length > 1 ? 's' : ''} rangé
                  {threadLinks.length > 1 ? 's' : ''}
                </p>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)} className="flex-shrink-0">
                <MailPlus className="h-4 w-4 mr-1.5" />
                Ajouter des emails
              </Button>
            </div>

            {threadsLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 space-y-3 px-4">
                <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Ce dossier est vide.</p>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <MailPlus className="h-4 w-4 mr-1.5" />
                  Ajouter des emails
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-[70vh]">
                <ul className="divide-y">
                  {threads.map((t) => (
                    <li
                      key={t.id}
                      className={cn(
                        'flex items-start gap-3 py-2.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors',
                        t.unread_count > 0 && 'font-medium'
                      )}
                      onClick={() => onOpenThread(t.id)}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm truncate">
                            {t.last_message_from_name || t.last_message_from_email || '—'}
                          </span>
                          {t.unread_count > 0 && (
                            <Badge className="h-4 px-1 text-[10px]">Non lu</Badge>
                          )}
                          {t.is_processed && (
                            <Badge variant="outline" className="h-4 px-1 text-[10px]">
                              Traité
                            </Badge>
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
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        title="Retirer de ce dossier"
                        aria-label="Retirer de ce dossier"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeThreadFromFolder.mutate({
                            threadId: t.id,
                            folderId: activeFolder.id,
                          })
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        )}
      </section>

      <EmailFolderDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EmailFolderDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        folder={editing}
      />
      {activeFolder && (
        <AddThreadsToFolderDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          folderId={activeFolder.id}
          folderName={activeFolder.name}
          existingThreadIds={threadLinks.map((l) => l.thread_id)}
        />
      )}
    </div>
  )
}
