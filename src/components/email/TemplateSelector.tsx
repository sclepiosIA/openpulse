import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import { useActiveEmailTemplates } from "@/hooks/email/useActiveEmailTemplates";

interface TemplateSelectorProps {
  onInsert: (content: string, subject: string) => void;
  /** Current subject to pre-fill when saving as template */
  currentSubject?: string;
  /** Current body to pre-fill when saving as template */
  currentBody?: string;
}

export function TemplateSelector({ onInsert, currentSubject, currentBody }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showSelector, setShowSelector] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: templates, isLoading } = useActiveEmailTemplates();

  const handleInsert = () => {
    const template = templates?.find(t => t.id === selectedTemplate);
    if (template) {
      onInsert(template.content, template.subject);
      setSelectedTemplate("");
      setShowSelector(false);
    }
  };

  if (!showSelector) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSelector(true)}
            type="button"
          >
            <FileText className="mr-2 h-4 w-4" />
            Insérer un template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            type="button"
            title="Créer un nouveau template"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CreateTemplateDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          initialSubject={currentSubject}
          initialContent={currentBody}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={isLoading}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Sélectionner un template..." />
          </SelectTrigger>
          <SelectContent>
            {templates?.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  <span>{template.name}</span>
                  {template.category && (
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleInsert}
          disabled={!selectedTemplate}
          type="button"
        >
          Insérer
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          type="button"
          title="Créer un nouveau template"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowSelector(false);
            setSelectedTemplate("");
          }}
          type="button"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        initialSubject={currentSubject}
        initialContent={currentBody}
      />
    </>
  );
}
