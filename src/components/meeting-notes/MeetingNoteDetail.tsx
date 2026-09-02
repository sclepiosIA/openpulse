import { useState } from 'react';
import { ArrowLeft, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranscriptionSummaryView } from '@/components/visio/TranscriptionSummaryView';
import { MeetingNoteMindMap } from '@/components/meeting-notes/MeetingNoteMindMap';
import type { TranscriptionSessionWithDetails, TranscriptionNextStep } from '@/types/transcription';

interface MeetingNoteDetailProps {
  session: TranscriptionSessionWithDetails;
  onBack: () => void;
  onCreateTask?: (step: TranscriptionNextStep) => Promise<void>;
  onCreateEvent?: (step: TranscriptionNextStep) => Promise<void>;
}

export function MeetingNoteDetail({
  session,
  onBack,
  onCreateTask,
  onCreateEvent,
}: MeetingNoteDetailProps) {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour à la liste
      </Button>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="mindmap">
            <Network className="h-3.5 w-3.5 mr-1" />
            Mind Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <TranscriptionSummaryView
            session={session}
            onCreateTask={onCreateTask}
            onCreateEvent={onCreateEvent}
          />
        </TabsContent>

        <TabsContent value="mindmap">
          <MeetingNoteMindMap session={session} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
