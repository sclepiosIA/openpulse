import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { StickyNote, Plus, MoreHorizontal, Pencil, Check, Trash2, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useDashboardNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  DashboardNote,
} from '@/hooks/dashboard/useDashboardNotes'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/shared/useAuth'
import { useToast } from '@/hooks/shared/use-toast'

const NotesRichEditor = lazy(() =>
  import('./NotesRichEditor').then((m) => ({ default: m.NotesRichEditor }))
)

const MAX_TABS = 10

export function NotesWidget() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: notes, isLoading } = useDashboardNotes()
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isPreparingNewNote, setIsPreparingNewNote] = useState(false)
  const [newNoteName, setNewNoteName] = useState('')
  const [localContent, setLocalContent] = useState<Record<string, string>>({})

  // Sync active tab with notes
  useEffect(() => {
    if (notes?.length && !activeTabId) {
      setActiveTabId(notes[0].id)
    } else if (notes?.length === 0) {
      setActiveTabId(null)
    } else if (activeTabId && notes && !notes.find((n) => n.id === activeTabId)) {
      setActiveTabId(notes[0]?.id || null)
    }
  }, [notes, activeTabId])

  // Sync local content with server
  useEffect(() => {
    if (notes) {
      const serverContent: Record<string, string> = {}
      notes.forEach((note) => {
        serverContent[note.id] = note.content
      })
      setLocalContent((prev) => {
        const merged = { ...serverContent }
        // Keep local changes for notes being edited
        Object.keys(prev).forEach((id) => {
          if (prev[id] !== serverContent[id] && notes.find((n) => n.id === id)) {
            // Local is different - keep local (user is typing)
            merged[id] = prev[id]
          }
        })
        return merged
      })
    }
  }, [notes])

  const activeNote = notes?.find((n) => n.id === activeTabId)

  const handleCreateTab = async (requestedName?: string) => {
    if ((notes?.length || 0) >= MAX_TABS) return
    const tabName = requestedName?.trim() || `Note ${(notes?.length || 0) + 1}`
    try {
      const result = await createNote.mutateAsync(tabName)
      setActiveTabId(result.id)
      setIsPreparingNewNote(false)
      setNewNoteName('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      toast({
        title: 'Création impossible',
        description: /mode démo|demo/i.test(message)
          ? 'Mode démo actif : la création de notes est désactivée.'
          : message,
        variant: 'destructive',
      })
    }
  }

  const handleRequestCreateTab = () => {
    if ((notes?.length || 0) >= MAX_TABS) return
    setNewNoteName(`Note ${(notes?.length || 0) + 1}`)
    setIsPreparingNewNote(true)
  }

  const handleStartRename = (note: DashboardNote) => {
    setEditingTabId(note.id)
    setEditingName(note.tab_name)
  }

  const handleSaveRename = () => {
    if (editingTabId && editingName.trim()) {
      updateNote.mutate({ id: editingTabId, tab_name: editingName.trim() })
    }
    setEditingTabId(null)
    setEditingName('')
  }

  const handleDeleteTab = (id: string) => {
    deleteNote.mutate(id)
    if (activeTabId === id && notes && notes.length > 1) {
      const remaining = notes.filter((n) => n.id !== id)
      setActiveTabId(remaining[0]?.id || null)
    }
  }

  const handleContentChange = useCallback(
    (id: string, content: string) => {
      setLocalContent((prev) => ({ ...prev, [id]: content }))
      updateNote.debouncedUpdate({ id, content })
    },
    [updateNote]
  )

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-emerald-500 h-[340px] [.compact_&]:h-[280px] flex flex-col">
      <CardHeader className="py-1 px-3 shrink-0 [.compact_&]:py-0.5">
        <CardTitle className="flex items-center justify-between text-sm [.compact_&]:text-xs">
          <div className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-emerald-600" />
            <span>Notes</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => (notes?.length ? handleCreateTab() : handleRequestCreateTab())}
            disabled={(notes?.length || 0) >= MAX_TABS || createNote.isPending}
            aria-label="Chargement"
          >
            {createNote.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 flex-1">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !notes?.length ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-3">
            <StickyNote className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm mb-3">Aucune note</p>
            {isPreparingNewNote ? (
              <div className="w-full max-w-[220px] space-y-2">
                <Input
                  value={newNoteName}
                  onChange={(e) => setNewNoteName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateTab(newNoteName)
                    if (e.key === 'Escape') setIsPreparingNewNote(false)
                  }}
                  placeholder="Nom de la note"
                  className="h-8 text-xs"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 flex-1"
                    onClick={() => void handleCreateTab(newNoteName)}
                    disabled={!newNoteName.trim() || createNote.isPending}
                  >
                    {createNote.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Valider'
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setIsPreparingNewNote(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={handleRequestCreateTab}>
                <Plus className="h-4 w-4 mr-1" />
                Créer une note
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Tabs */}
            <ScrollArea className="w-full shrink-0 -mx-1">
              <div className="flex gap-0.5 pb-1 border-b px-1">
                <AnimatePresence mode="popLayout">
                  {notes.map((note) => (
                    <motion.div
                      key={note.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="shrink-0"
                    >
                      {editingTabId === note.id ? (
                        <div className="flex items-center gap-0.5 px-0.5">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-5 w-20 text-[10px]"
                            autoFocus
                            onBlur={handleSaveRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename()
                              if (e.key === 'Escape') {
                                setEditingTabId(null)
                                setEditingName('')
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={handleSaveRename}
                            aria-label="Valider"
                          >
                            <Check className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'group flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors',
                            activeTabId === note.id
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'hover:bg-muted'
                          )}
                          onClick={() => setActiveTabId(note.id)}
                        >
                          <span className="truncate max-w-[40px] sm:max-w-[50px]">
                            {note.tab_name}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Plus d'options"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStartRename(note)}>
                                <Pencil className="h-3 w-3 mr-2" />
                                Renommer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteTab(note.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Content - Rich Editor */}
            <div className="flex-1 min-h-0 pt-1 overflow-hidden">
              {activeNote && user && (
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Chargement de l'éditeur…
                    </div>
                  }
                >
                  <NotesRichEditor
                    content={localContent[activeNote.id] ?? activeNote.content}
                    onChange={(content) => handleContentChange(activeNote.id, content)}
                    placeholder="Écrivez vos notes ici..."
                    noteId={activeNote.id}
                    userId={user.id}
                  />
                </Suspense>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
