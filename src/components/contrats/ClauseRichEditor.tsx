import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ClauseRichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showAIToolbar?: boolean;
  onAIAction?: (action: string, content: string) => Promise<string | null>;
  isProcessingAI?: boolean;
}

export function ClauseRichEditor({
  value,
  onChange,
  placeholder = "Rédigez le contenu de la clause... Utilisez {{variable}} pour les champs dynamiques.",
  disabled = false,
  className,
  showAIToolbar = true,
  onAIAction,
  isProcessingAI = false,
}: ClauseRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline.extend({ name: 'underline-clause' }),
      Link.extend({ name: 'link-clause' }).configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ] as any,
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }: any) => {
      onChange(editor.getHTML());
    },
  }) as any;

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Extract {{variables}} from content
  const extractVariables = useCallback(() => {
    const text = editor?.getText() || "";
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map((m: string) => m.replace(/\{\{|\}\}/g, "").trim()))];
  }, [editor]);

  const variables = extractVariables();

  const ToolbarButton = ({ 
    onClick, 
    active, 
    disabled: btnDisabled, 
    children, 
    title 
  }: { 
    onClick: () => void; 
    active?: boolean; 
    disabled?: boolean; 
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={btnDisabled || disabled}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );

  if (!editor) return null;

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/50">
        {/* Text formatting */}
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Gras (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italique (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Souligné (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Titre 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Titre 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Titre 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Liste à puces"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Liste numérotée"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Link */}
        <ToolbarButton 
          onClick={() => {
            const url = window.prompt("URL du lien:");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          active={editor.isActive('link')}
          title="Insérer un lien"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <ToolbarButton 
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Annuler (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        {/* AI indicator */}
        {showAIToolbar && (
          <>
            <div className="flex-1" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isProcessingAI ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
                  <span>IA en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  <span>IA disponible</span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Editor */}
      <div className="relative">
        {isProcessingAI && (
          <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Traitement IA en cours...</span>
            </div>
          </div>
        )}
        <EditorContent 
          editor={editor} 
          className="min-h-[200px] p-4 prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
        />
      </div>

      {/* Variables detected */}
      {variables.length > 0 && (
        <div className="border-t p-2 bg-muted/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Variables détectées :</span>
            {variables.map((v) => (
              <Badge key={`var-${v}`} variant="secondary" className="text-xs font-mono">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
