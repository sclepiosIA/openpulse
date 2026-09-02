import React, { useCallback, useRef } from 'react'
import { debug } from '@/lib/debug'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  CheckSquare,
  Mic,
  MicOff,
  Camera,
  Sparkles,
  Loader2,
  ScanText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceDictation } from '@/hooks/voice/useVoiceDictation'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface NotesRichEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  noteId: string
  userId: string
}

export function NotesRichEditor({
  content,
  onChange,
  placeholder = 'Écrivez vos notes ici...',
  noteId,
  userId,
}: NotesRichEditorProps) {
  const [isStructuring, setIsStructuring] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isOcring, setIsOcring] = React.useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ocrInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline.extend({ name: 'underline-notes' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full my-2' },
      }),
      Placeholder.configure({ placeholder }),
    ] as any,
    content,
    editorProps: {
      attributes: {
        class:
          'notes-rich-editor prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[50px] px-1 md:text-[13px]',
      },
    },
    onUpdate: ({ editor }: any) => {
      onChange(editor.getHTML())
    },
  }) as any

  // Sync content from props
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  // Voice dictation
  const {
    isRecording,
    isProcessing: isTranscribing,
    audioLevel,
    toggleRecording,
  } = useVoiceDictation({
    onTranscript: useCallback(
      (text: string) => {
        if (editor) {
          editor
            .chain()
            .focus()
            .insertContent(text + ' ')
            .run()
        }
      },
      [editor]
    ),
  })

  // AI Structure function
  const handleStructure = async () => {
    if (!editor) return
    const currentContent = editor.getText()
    if (!currentContent.trim()) {
      toast.error('Aucun contenu à structurer')
      return
    }

    setIsStructuring(true)
    try {
      const { data, error } = await supabase.functions.invoke('structure-note', {
        body: { content: currentContent },
      })

      if (error) throw error
      if (data?.structured_content) {
        editor.commands.setContent(data.structured_content)
        toast.success('Note structurée avec succès')
      }
    } catch (err: unknown) {
      debug.error('Structure error:', err)
      toast.error('Erreur lors de la structuration')
    } finally {
      setIsStructuring(false)
    }
  }

  // Photo/Image upload
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées')
      return
    }

    // Compress image if too large
    let imageToUpload = file
    if (file.size > 2 * 1024 * 1024) {
      imageToUpload = await compressImage(file)
    }

    setIsUploading(true)
    try {
      const timestamp = Date.now()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/${noteId}/${timestamp}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('notes-images')
        .upload(path, imageToUpload)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('notes-images').getPublicUrl(path)

      if (editor) {
        editor.chain().focus().setImage({ src: publicUrl, alt: 'Image note' }).run()
      }
      toast.success('Image ajoutée')
    } catch (err) {
      if (import.meta.env.DEV) console.error('Upload error:', err)
      toast.error("Erreur lors de l'upload")
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
    e.target.value = ''
  }

  // OCR document → texte injecté dans la note
  const handleOcr = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(
        'Format non supporté. Importez une image (JPG, PNG, HEIC…) ou une capture du document.'
      )
      return
    }
    setIsOcring(true)
    try {
      let imageFile = file
      if (file.size > 4 * 1024 * 1024) {
        imageFile = await compressImage(file)
      }
      const base64 = await fileToBase64(imageFile)
      const { data, error } = await supabase.functions.invoke('jarvis-vision', {
        body: {
          image_base64: base64,
          task: 'ocr',
          prompt: 'Extrais tout le texte visible et préserve la structure.',
        },
      })
      if (error) throw error
      const text = (data as any)?.content || (data as any)?.result?.content
      if (!text) {
        toast.error('Aucun texte détecté dans le document')
        return
      }
      if (editor) {
        const html = text
          .split(/\n\n+/)
          .map((p: string) => `<p>${p.replace(/\n/g, '<br/>').replace(/</g, '&lt;')}</p>`)
          .join('')
        editor.chain().focus().insertContent(html).run()
      }
      toast.success('Texte extrait du document')
    } catch (err) {
      debug.error('OCR error:', err)
      toast.error("Erreur lors de l'OCR du document")
    } finally {
      setIsOcring(false)
    }
  }

  const handleOcrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleOcr(file)
    e.target.value = ''
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {/* Force list styling inside the tiptap editor (some global resets remove markers) */}
      <style>{`
        .notes-rich-editor ul { list-style: disc outside; padding-left: 1.5rem; margin: 0.25rem 0; }
        .notes-rich-editor ol { list-style: decimal outside; padding-left: 1.5rem; margin: 0.25rem 0; }
        .notes-rich-editor ul ul { list-style: circle outside; }
        .notes-rich-editor ul ul ul { list-style: square outside; }
        .notes-rich-editor li > p { margin: 0; }
        .notes-rich-editor ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
        .notes-rich-editor ul[data-type="taskList"] li { display: flex; gap: 0.375rem; align-items: flex-start; }
        .notes-rich-editor ul[data-type="taskList"] li > label { margin-top: 2px; }
      `}</style>
      {/* Ultra-Compact Toolbar */}
      <div className="flex items-center gap-0.5 p-0.5 border-b bg-muted/30 rounded-t-lg flex-wrap">
        {/* Format Group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="Gras"
        >
          <Bold className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="Italique"
        >
          <Italic className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          tooltip="Souligné"
        >
          <UnderlineIcon className="h-3 w-3" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-3 mx-0.5" />

        {/* Lists Group */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          tooltip="Liste à puces"
        >
          <List className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          tooltip="Liste numérotée"
        >
          <ListOrdered className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          tooltip="Checklist"
        >
          <CheckSquare className="h-3 w-3" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-3 mx-0.5" />

        {/* Media Group */}
        <ToolbarButton
          onClick={toggleRecording}
          isActive={isRecording}
          disabled={isTranscribing}
          tooltip={isRecording ? 'Arrêter la dictée' : 'Dictée vocale'}
          className={cn(
            isRecording &&
              'text-destructive hover:text-destructive bg-destructive/10 hover:bg-destructive/20'
          )}
        >
          {isTranscribing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isRecording ? (
            <div className="relative">
              <MicOff className="h-3 w-3" />
              <span
                className="absolute inset-0 rounded-full border border-destructive animate-ping opacity-50"
                style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
              />
            </div>
          ) : (
            <Mic className="h-3 w-3" />
          )}
        </ToolbarButton>

        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          tooltip="Ajouter une photo"
        >
          {isUploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
        </ToolbarButton>

        <ToolbarButton
          onClick={() => ocrInputRef.current?.click()}
          disabled={isOcring}
          tooltip="OCR document (extraire le texte)"
        >
          {isOcring ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ScanText className="h-3 w-3" />
          )}
        </ToolbarButton>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        <input
          ref={ocrInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleOcrFileSelect}
        />

        <Separator orientation="vertical" className="h-3 mx-0.5" />

        {/* AI Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 gap-0.5 text-[10px] font-medium text-primary hover:text-primary hover:bg-primary/10"
              onClick={handleStructure}
              disabled={isStructuring}
            >
              {isStructuring ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">IA</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restructurer avec l'IA</TooltipContent>
        </Tooltip>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto py-1">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}

// Toolbar button component
interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  tooltip: string
  className?: string
  children: React.ReactNode
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  tooltip,
  className,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-5 w-5', isActive && 'bg-muted text-foreground', className)}
          onClick={onClick}
          disabled={disabled}
          type="button"
          aria-label={tooltip}
          aria-pressed={isActive}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

// Image compression utility
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new window.Image()

    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          resolve(new File([blob!], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

// Convert File → base64 (sans préfixe data:)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
