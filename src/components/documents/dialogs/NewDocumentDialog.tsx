import { useState } from 'react';
import { FileText, Table2, Presentation, FileUp, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { HelpMeCreateDialog } from '@/components/documents/ai/HelpMeCreateDialog';

export type NativeEditorType = 'native_doc' | 'native_sheet' | 'native_pres';

interface NewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDocument: (name: string, type: NativeEditorType) => void;
  onImportFile?: () => void;
  onAIDocumentCreated?: (html: string, title: string) => void;
  isCreating?: boolean;
}

const DOC_TYPES: { type: NativeEditorType; icon: typeof FileText; label: string; description: string; color: string }[] = [
  {
    type: 'native_doc',
    icon: FileText,
    label: 'Document',
    description: 'Traitement de texte avec mise en forme riche',
    color: 'text-blue-600 bg-blue-50 border-blue-200 hover:border-blue-400',
  },
  {
    type: 'native_sheet',
    icon: Table2,
    label: 'Tableur',
    description: 'Feuille de calcul avec formules et graphiques',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:border-emerald-400',
  },
  {
    type: 'native_pres',
    icon: Presentation,
    label: 'Présentation',
    description: 'Diaporama avec slides et animations',
    color: 'text-orange-600 bg-orange-50 border-orange-200 hover:border-orange-400',
  },
];

export function NewDocumentDialog({
  open,
  onOpenChange,
  onCreateDocument,
  onImportFile,
  onAIDocumentCreated,
  isCreating,
}: NewDocumentDialogProps) {
  const [selectedType, setSelectedType] = useState<NativeEditorType>('native_doc');
  const [documentName, setDocumentName] = useState('');
  const [showHelpMeCreate, setShowHelpMeCreate] = useState(false);

  const handleCreate = () => {
    const name = documentName.trim() || getDefaultName(selectedType);
    onCreateDocument(name, selectedType);
    setDocumentName('');
  };

  const getDefaultName = (type: NativeEditorType) => {
    const date = new Date().toLocaleDateString('fr-FR');
    switch (type) {
      case 'native_doc': return `Document ${date}`;
      case 'native_sheet': return `Tableur ${date}`;
      case 'native_pres': return `Présentation ${date}`;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau document</DialogTitle>
            <DialogDescription>
              Choisissez le type de document à créer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* AI Generate button */}
            <button
              onClick={() => {
                onOpenChange(false);
                setShowHelpMeCreate(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all group"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <span className="text-sm font-semibold text-primary">Help me create</span>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Générer un rapport, plan d'action ou synthèse à partir de vos données
                </p>
              </div>
            </button>

            {/* Document type selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DOC_TYPES.map(({ type, icon: Icon, label, description, color }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                    color,
                    selectedType === type
                      ? "ring-2 ring-offset-2 ring-primary/50 scale-[1.02] shadow-md"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  <Icon className="h-8 w-8" />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{description}</span>
                </button>
              ))}
            </div>

            {/* Document name */}
            <div className="space-y-2">
              <Label htmlFor="doc-name">Nom du document</Label>
              <Input
                id="doc-name"
                placeholder={getDefaultName(selectedType)}
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {onImportFile && (
                <Button variant="outline" onClick={onImportFile} className="gap-2">
                  <FileUp className="h-4 w-4" />
                  Importer un fichier
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Créer
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <HelpMeCreateDialog
        open={showHelpMeCreate}
        onOpenChange={setShowHelpMeCreate}
        onDocumentCreated={onAIDocumentCreated}
      />
    </>
  );
}
