import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailFiltersProvider } from "@/contexts/EmailFiltersContext";
import { EmailInbox } from "@/components/email/EmailInbox";
import { EmailThread } from "@/components/email/EmailThread";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface GroupeEmailsTabProps {
  groupeId: string;
  groupeNom?: string;
}

function GroupeEmailsInner({ groupeId, groupeNom }: GroupeEmailsTabProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleCloseThread = () => {
    setSelectedThreadId(null);
  };

  const listContent = (
    <EmailInbox
      onThreadSelect={handleThreadSelect}
      accountId="all"
    />
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

export function GroupeEmailsTab({ groupeId, groupeNom }: GroupeEmailsTabProps) {
  return (
    <EmailFiltersProvider initialFilters={{ groupeId }}>
      <GroupeEmailsInner
        groupeId={groupeId}
        groupeNom={groupeNom}
      />
    </EmailFiltersProvider>
  );
}
