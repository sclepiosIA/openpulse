import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailThread } from "./EmailThread";

interface EmailDetailPanelProps {
  threadId: string | null;
  onComposeNew?: () => void;
}

export function EmailDetailPanel({ threadId, onComposeNew }: EmailDetailPanelProps) {
  if (!threadId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/20">
        <div className="rounded-full bg-muted/50 p-6 mb-6">
          <Mail className="h-12 w-12 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          Sélectionnez un email
        </h3>
        <p className="text-sm text-muted-foreground max-w-[300px] mb-6">
          Cliquez sur un email dans la liste pour afficher son contenu ici
        </p>
        {onComposeNew && (
          <Button onClick={onComposeNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau message
          </Button>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <EmailThread
          threadId={threadId}
          onBack={() => {}}
          embedded
        />
      </div>
    </ScrollArea>
  );
}