import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Heading3,
  Table,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Highlighter,
  Minus,
  Quote,
  Palette,
  FileDown,
  FileUp,
  Save,
  ChevronDown,
  Sparkles,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ConnectedUser {
  user_id: string
  user_name: string
  user_avatar?: string
  user_color: string
}

interface DocumentEditorToolbarProps {
  editor: any
  onSave?: () => void
  onExportPdf?: () => void
  onExportDocx?: () => void
  onImportDocx?: () => void
  isSaving?: boolean
  className?: string
  connectedUsers?: ConnectedUser[]
  onOpenCopilotPanel?: () => void
  onOpenCopilotSlash?: () => void
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
}

function ToolbarButton({ icon, label, onClick, isActive, disabled }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 rounded-md', isActive && 'bg-accent text-accent-foreground')}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={isActive}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

const TEXT_COLORS = [
  { label: 'Noir', value: '#000000' },
  { label: 'Rouge', value: '#e53e3e' },
  { label: 'Bleu', value: '#3182ce' },
  { label: 'Vert', value: '#38a169' },
  { label: 'Orange', value: '#dd6b20' },
  { label: 'Violet', value: '#805ad5' },
  { label: 'Gris', value: '#718096' },
]

const HIGHLIGHT_COLORS = [
  { label: 'Jaune', value: '#fefcbf' },
  { label: 'Vert', value: '#c6f6d5' },
  { label: 'Bleu', value: '#bee3f8' },
  { label: 'Rose', value: '#fed7e2' },
  { label: 'Orange', value: '#feebc8' },
]

export function DocumentEditorToolbar({
  editor,
  onSave,
  onExportPdf,
  onExportDocx,
  onImportDocx,
  isSaving,
  className,
  onOpenCopilotPanel,
  onOpenCopilotSlash,
}: DocumentEditorToolbarProps) {
  if (!editor) return null

  const addImage = () => {
    const url = window.prompt("URL de l'image :")
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const addLink = () => {
    const url = window.prompt('URL du lien :')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'editor-toolbar flex items-center gap-0.5 flex-wrap p-2 overflow-x-auto',
          className
        )}
      >
        {/* Save + File actions */}
        {onSave && (
          <ToolbarButton
            icon={<Save className="h-4 w-4" />}
            label="Enregistrer (Ctrl+S)"
            onClick={onSave}
            disabled={isSaving}
          />
        )}

        {/* Copilot IA */}
        {(onOpenCopilotSlash || onOpenCopilotPanel) && (
          <>
            {onOpenCopilotSlash && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenCopilotSlash}
                    aria-label="Copilot IA — commandes"
                    className="editor-ai-btn inline-flex items-center gap-1.5 rounded-md px-2.5 h-8 text-xs font-semibold mx-1"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Copilot
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Palette de commandes IA (Ctrl+K)
                </TooltipContent>
              </Tooltip>
            )}
            {onOpenCopilotPanel && (
              <ToolbarButton
                icon={<MessageSquare className="h-4 w-4" />}
                label="Chat Copilot (Ctrl+J)"
                onClick={onOpenCopilotPanel}
              />
            )}
            <Separator orientation="vertical" className="h-6 mx-1" />
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <FileDown className="h-3.5 w-3.5" />
              Fichier
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover">
            {onImportDocx && (
              <DropdownMenuItem onClick={onImportDocx}>
                <FileUp className="h-4 w-4 mr-2" />
                Importer DOCX
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onExportPdf && (
              <DropdownMenuItem onClick={onExportPdf}>
                <FileDown className="h-4 w-4 mr-2" />
                Exporter en PDF
              </DropdownMenuItem>
            )}
            {onExportDocx && (
              <DropdownMenuItem onClick={onExportDocx}>
                <FileDown className="h-4 w-4 mr-2" />
                Exporter en DOCX
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo / Redo */}
        <ToolbarButton
          icon={<Undo2 className="h-4 w-4" />}
          label="Annuler"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        />
        <ToolbarButton
          icon={<Redo2 className="h-4 w-4" />}
          label="Rétablir"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <ToolbarButton
          icon={<Heading1 className="h-4 w-4" />}
          label="Titre 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
        />
        <ToolbarButton
          icon={<Heading2 className="h-4 w-4" />}
          label="Titre 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
        />
        <ToolbarButton
          icon={<Heading3 className="h-4 w-4" />}
          label="Titre 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          icon={<Bold className="h-4 w-4" />}
          label="Gras"
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
        />
        <ToolbarButton
          icon={<Italic className="h-4 w-4" />}
          label="Italique"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        />
        <ToolbarButton
          icon={<UnderlineIcon className="h-4 w-4" />}
          label="Souligné"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
        />
        <ToolbarButton
          icon={<Strikethrough className="h-4 w-4" />}
          label="Barré"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
        />
        <ToolbarButton
          icon={<Code className="h-4 w-4" />}
          label="Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
        />

        {/* Text color */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Palette">
              <Palette className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover">
            {TEXT_COLORS.map((c) => (
              <DropdownMenuItem
                key={c.value}
                onClick={() => editor.chain().focus().setColor(c.value).run()}
                className="gap-2"
              >
                <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: c.value }} />
                {c.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().unsetColor().run()}>
              Réinitialiser
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Highlight */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Surligner">
              <Highlighter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover">
            {HIGHLIGHT_COLORS.map((c) => (
              <DropdownMenuItem
                key={c.value}
                onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
                className="gap-2"
              >
                <div className="w-4 h-4 rounded border" style={{ backgroundColor: c.value }} />
                {c.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().unsetHighlight().run()}>
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment */}
        <ToolbarButton
          icon={<AlignLeft className="h-4 w-4" />}
          label="Aligner à gauche"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
        />
        <ToolbarButton
          icon={<AlignCenter className="h-4 w-4" />}
          label="Centrer"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
        />
        <ToolbarButton
          icon={<AlignRight className="h-4 w-4" />}
          label="Aligner à droite"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
        />
        <ToolbarButton
          icon={<AlignJustify className="h-4 w-4" />}
          label="Justifier"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <ToolbarButton
          icon={<List className="h-4 w-4" />}
          label="Liste à puces"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
        />
        <ToolbarButton
          icon={<ListOrdered className="h-4 w-4" />}
          label="Liste numérotée"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
        />
        <ToolbarButton
          icon={<ListChecks className="h-4 w-4" />}
          label="Liste de tâches"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Block elements */}
        <ToolbarButton
          icon={<Quote className="h-4 w-4" />}
          label="Citation"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
        />
        <ToolbarButton
          icon={<Minus className="h-4 w-4" />}
          label="Séparateur"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Insert */}
        <ToolbarButton
          icon={<Table className="h-4 w-4" />}
          label="Insérer un tableau"
          onClick={insertTable}
        />
        <ToolbarButton
          icon={<ImageIcon className="h-4 w-4" />}
          label="Insérer une image"
          onClick={addImage}
        />
        <ToolbarButton
          icon={<LinkIcon className="h-4 w-4" />}
          label="Insérer un lien"
          onClick={addLink}
          isActive={editor.isActive('link')}
        />
      </div>
    </TooltipProvider>
  )
}
