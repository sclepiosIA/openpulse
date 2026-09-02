import { useState, useCallback } from 'react'
import { FileAudio, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMeetingNotes } from '@/hooks/meeting/useMeetingNotes'
import { MeetingNotesList } from '@/components/meeting-notes/MeetingNotesList'
import { MeetingNoteDetail } from '@/components/meeting-notes/MeetingNoteDetail'
import { MeetingNotesUploadDialog } from '@/components/meeting-notes/MeetingNotesUploadDialog'
import { AzureMeetingsStatusPanel } from '@/components/meeting-notes/AzureMeetingsStatusPanel'
import { PageDataState } from '@/components/common/PageDataState'
import type { TranscriptionSessionWithDetails, TranscriptionNextStep } from '@/types/transcription'
import { useDebounce } from '@/hooks/shared/useDebounce'
import { useAuth } from '@/hooks/shared/useAuth'

export default function MeetingNotes() {
  const { loading: authLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<TranscriptionSessionWithDetails | null>(
    null
  )

  const debouncedSearch = useDebounce(searchQuery, 300)

  const {
    sessions,
    isLoading,
    isError,
    refetch,
    uploadProgress,
    uploadAndProcess,
    createTaskFromStep,
    createEventFromStep,
  } = useMeetingNotes({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  const handleSelect = useCallback((session: TranscriptionSessionWithDetails) => {
    setSelectedSession(session)
  }, [])

  const handleCreateTask = useCallback(
    async (step: TranscriptionNextStep) => {
      await createTaskFromStep(step, selectedSession?.etablissement_id || undefined)
    },
    [createTaskFromStep, selectedSession]
  )

  const handleCreateEvent = useCallback(
    async (step: TranscriptionNextStep) => {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data: calendar } = await supabase
        .from('calendars')
        .select('id')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle()

      if (!calendar) {
        const { toast } = await import('@/hooks/shared/use-toast')
        toast({
          title: 'Erreur',
          description: 'Aucun calendrier par défaut trouvé',
          variant: 'destructive' as const,
        })
        return
      }

      await createEventFromStep(step, calendar.id, selectedSession?.etablissement_id || undefined)
    },
    [createEventFromStep, selectedSession]
  )

  const handleUpload = useCallback(
    async (file: File, options: any) => {
      const sessionId = await uploadAndProcess(file, options)
      if (sessionId) {
        setUploadOpen(false)
      }
      return sessionId
    },
    [uploadAndProcess]
  )

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileAudio className="h-6 w-6 text-primary" />
            Notes de réunion
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importez vos enregistrements audio pour les transcrire et analyser automatiquement
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle note
        </Button>
      </div>

      {/* Statut socle Azure (invisible en mode 100 % Supabase) */}
      <AzureMeetingsStatusPanel />

      <PageDataState isLoading={authLoading} isError={isError} onRetry={() => refetch()}>
        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: List */}
          <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            <MeetingNotesList
              sessions={sessions}
              isLoading={isLoading}
              selectedId={selectedSession?.id}
              onSelect={handleSelect}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          </div>

          {/* Right: Detail */}
          <div className="min-h-[400px]">
            {selectedSession ? (
              <MeetingNoteDetail
                session={selectedSession}
                onBack={() => setSelectedSession(null)}
                onCreateTask={handleCreateTask}
                onCreateEvent={handleCreateEvent}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-20">
                <FileAudio className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Sélectionnez une note</p>
                <p className="text-sm mt-1">ou importez un nouvel enregistrement audio</p>
              </div>
            )}
          </div>
        </div>
      </PageDataState>

      {/* Upload Dialog */}
      <MeetingNotesUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={handleUpload}
        uploadStatus={uploadProgress}
      />
    </div>
  )
}
