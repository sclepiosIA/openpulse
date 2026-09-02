import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  CheckSquare,
  Sparkles,
  Loader2,
  Wand2,
  AlignLeft,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePulseAIEditor } from '@/hooks/pulse/usePulseAIEditor';

interface ActivityRichEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function ActivityRichEditor({
  content,
  onChange,
  placeholder = 'Points abordés, décisions prises, actions convenues...',
}: ActivityRichEditorProps) {
  const { isProcessing, improve, reformulate, shorten } = usePulseAIEditor();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ] as any,
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-3 py-2 text-sm',
      },
    },
    onUpdate: ({ editor }: any) => {
      onChange(editor.getHTML());
    },
  }) as any;

  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const handleAIAction = useCallback(async (action: 'improve' | 'reformulate' | 'shorten' | 'structure') => {
    if (!editor) return;
    const text = editor.getText();
    if (!text.trim()) return;

    let result: string | null = null;
    if (action === 'structure') {
      result = await improve(text);
    } else if (action === 'improve') {
      result = await improve(text);
    } else if (action === 'reformulate') {
      result = await reformulate(text);
    } else if (action === 'shorten') {
      result = await shorten(text);
    }

    if (result) {
      editor.commands.setContent(result);
      onChange(result);
    }
  }, [editor, improve, reformulate, shorten, onChange]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, isActive, icon: Icon, label }: { onClick: () => void; isActive?: boolean; icon: React.ComponentType<any>; label: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0', isActive && 'bg-muted')}
          onClick={onClick}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border rounded-md overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30 flex-wrap">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={Bold}
            label="Gras"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={Italic}
            label="Italique"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            icon={UnderlineIcon}
            label="Souligné"
          />

          <Separator orientation="vertical" className="h-5 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            icon={List}
            label="Liste"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            icon={ListOrdered}
            label="Liste numérotée"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            isActive={editor.isActive('taskList')}
            icon={CheckSquare}
            label="Checklist"
          />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* AI Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-primary"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span className="text-xs font-medium">IA</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleAIAction('structure')}>
                <AlignLeft className="h-4 w-4 mr-2" />
                Structurer les notes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAIAction('improve')}>
                <Wand2 className="h-4 w-4 mr-2" />
                Améliorer le texte
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAIAction('reformulate')}>
                <Sparkles className="h-4 w-4 mr-2" />
                Reformuler
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAIAction('shorten')}>
                <Minimize2 className="h-4 w-4 mr-2" />
                Raccourcir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Editor content */}
        <EditorContent editor={editor} />
      </div>
    </TooltipProvider>
  );
}
