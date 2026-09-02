import { useState } from "react";
import { List, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailFiltersProvider } from "@/contexts/EmailFiltersContext";
import { EmailInbox } from "@/components/email/EmailInbox";
import { EmailThread } from "@/components/email/EmailThread";
import { EmailTimeline } from "@/components/email/EmailTimeline";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface EtablissementEmailsTabProps {
  etablissementId: string;
  etablissementNom?: string;
}

type EmailView = 'list' | 'timeline';

function ViewToggle({ view, setView }: { view: EmailView; setView: (v: EmailView) => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-md shrink-0">
      <button
        onClick={() => setView('list')}
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded transition-colors",
          view === 'list'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="h-3 w-3" />
        Liste
      </button>
      <button
        onClick={() => setView('timeline')}
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded transition-colors",
          view === 'timeline'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Clock className="h-3 w-3" />
        Timeline
      </button>
    </div>
  );
}

function EtablissementEmailsInner({ etablissementId, etablissementNom }: EtablissementEmailsTabProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [view, setView] = useState<EmailView>('list');

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleCloseThread = () => {
    setSelectedThreadId(null);
  };

  const viewToggle = <ViewToggle view={view} setView={setView} />;

  const listContent = view === 'list' ? (
    <EmailInbox
      onThreadSelect={handleThreadSelect}
      accountId="all"
      toolbarPrefixSlot={viewToggle}
    />
  ) : (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background/50">
        <div className="flex items-center gap-4">
          {viewToggle}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <EmailTimeline
          etablissementId={etablissementId}
          etablissementNom={etablissementNom || "Établissement"}
          onThreadSelect={handleThreadSelect}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {selectedThreadId ? (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-h-0 rounded-lg border"
        >
          <ResizablePanel defaultSize={40} minSize={25} maxSize={50} className="bg-background">
            <div className="h-full overflow-auto">
              {listContent}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={60} minSize={35} className="bg-background">
            <div className="h-full flex flex-col min-h-0">
              <div className="flex items-center justify-end p-2 border-b shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseThread}
                  aria-label="Fermer la conversation"
                  title="Fermer"
                  className="h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">
                  <EmailThread
                    threadId={selectedThreadId}
                    onBack={handleCloseThread}
                    embedded
                  />
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {listContent}
        </div>
      )}
    </div>
  );
}

export function EtablissementEmailsTab({ etablissementId, etablissementNom }: EtablissementEmailsTabProps) {
  return (
    <EmailFiltersProvider initialFilters={{ etablissementId }}>
      <EtablissementEmailsInner
        etablissementId={etablissementId}
        etablissementNom={etablissementNom}
      />
    </EmailFiltersProvider>
  );
}
