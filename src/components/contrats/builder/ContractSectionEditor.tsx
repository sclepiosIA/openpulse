import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  Sparkles,
  Loader2,
  Variable,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContractSection } from '@/hooks/contracts/useContractSections'
import { ContractAIToolbar } from './ContractAIToolbar'
import { SectionVersionsDialog } from './SectionVersionsDialog'

interface ContractSectionEditorProps {
  section: ContractSection | undefined
  onUpdate: (data: Partial<ContractSection>) => void
  isSaving?: boolean
}

export function ContractSectionEditor({ section, onUpdate, isSaving }: ContractSectionEditorProps) {
  const [showAIToolbar, setShowAIToolbar] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [localTitle, setLocalTitle] = useState(section?.titre || '')

  // Debounce pour les mises à jour
  const debounceRef = useState<NodeJS.Timeout | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline.extend({ name: 'underline-contract' }),
      Link.extend({ name: 'link-contract' }).configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Commencez à rédiger le contenu de cette section...',
      }),
    ] as any,
    content: section?.contenu_html || '',
    editable: !section?.is_locked,
    onUpdate: ({ editor }: any) => {
      // Debounce la mise à jour
      if (debounceRef[0]) clearTimeout(debounceRef[0])
      debounceRef[0] = setTimeout(() => {
        onUpdate({ contenu_html: editor.getHTML() })
      }, 1000)
    },
  }) as any

  // Mettre à jour le contenu quand la section change
  useEffect(() => {
    if (editor && section) {
      if (editor.getHTML() !== section.contenu_html) {
        editor.commands.setContent(section.contenu_html || '')
      }
      setLocalTitle(section.titre)
    }
  }, [section?.id])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef[0]) clearTimeout(debounceRef[0])
    }
  }, [])

  const handleTitleBlur = () => {
    if (localTitle !== section?.titre && localTitle.trim()) {
      onUpdate({ titre: localTitle.trim() })
    }
  }

  // Extraire les variables {{variable}} du contenu
  const extractVariables = useCallback(() => {
    const content = editor?.getText() || ''
    const matches = content.match(/\{\{([^}]+)\}\}/g) || []
    return [...new Set(matches.map((m: string) => m.replace(/\{\{|\}\}/g, '').trim()))]
  }, [editor])

  const variables = extractVariables()

  if (!section) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Heading1 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Sélectionnez une section</p>
          <p className="text-sm mt-1">pour commencer à éditer</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with title */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0"
            placeholder="Titre de la section"
            disabled={section.is_locked}
          />
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {section.type}
          </Badge>
          {section.clause_source_id && (
            <Badge variant="secondary" className="text-xs">
              Depuis bibliothèque
            </Badge>
          )}
          {section.is_locked && (
            <Badge variant="destructive" className="text-xs">
              Verrouillé
            </Badge>
          )}
        </div>

        {/* Variables détectées */}
        {variables.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Variable className="h-3 w-3 text-muted-foreground" />
            {variables.map((v) => (
              <Badge
                key={v as string}
                variant="outline"
                className="text-xs bg-yellow-50 border-yellow-200 text-yellow-700"
              >
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      {editor && !section.is_locked && (
        <div className="flex items-center gap-1 p-2 border-b flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(editor.isActive('bold') && 'bg-muted')}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(editor.isActive('italic') && 'bg-muted')}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(editor.isActive('underline') && 'bg-muted')}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Heading1 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                <Heading1 className="h-4 w-4 mr-2" /> Titre 1
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 className="h-4 w-4 mr-2" /> Titre 2
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                <Heading3 className="h-4 w-4 mr-2" /> Titre 3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(editor.isActive('bulletList') && 'bg-muted')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(editor.isActive('orderedList') && 'bg-muted')}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(editor.isActive('blockquote') && 'bg-muted')}
          >
            <Quote className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVersions(true)}
            disabled={!section?.id}
          >
            <History className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Historique</span>
          </Button>
          <SectionVersionsDialog
            open={showVersions}
            onOpenChange={setShowVersions}
            sectionId={section?.id}
            sectionTitle={section?.titre}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAIToolbar(!showAIToolbar)}
            className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            IA
          </Button>
        </div>
      )}

      {/* AI Toolbar */}
      {showAIToolbar && editor && (
        <ContractAIToolbar
          content={editor.getHTML()}
          sectionTitle={section.titre}
          onApply={(newContent) => {
            editor.commands.setContent(newContent)
            onUpdate({ contenu_html: newContent })
          }}
          onClose={() => setShowAIToolbar(false)}
        />
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-auto p-4">
        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-sm max-w-none min-h-[300px]',
            '[&_.ProseMirror]:outline-none',
            '[&_.ProseMirror]:min-h-[300px]',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0'
          )}
        />
      </div>
    </div>
  )
}
