import { useEditor, EditorContent } from '@tiptap/react'
import { debug } from '@/lib/debug'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Upload,
  Undo,
  Redo,
  Quote,
  Heading2,
  Code,
  Sparkles,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  isAnimating?: boolean
  isProcessing?: boolean
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Écrivez votre message...',
  disabled = false,
  isAnimating = false,
  isProcessing = false,
}: RichTextEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline.extend({ name: 'underline-email' }).configure({
        HTMLAttributes: {
          class: 'underline',
        },
      }),
      Link.extend({ name: 'link-email' }).configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-md',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ] as any,
    content,
    onUpdate: ({ editor }: any) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[300px] p-4 focus:outline-none',
      },
    },
    editable: !disabled,
  }) as any

  // Fix: Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  const handleAddLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
    }
    setLinkUrl('')
    setLinkDialogOpen(false)
  }

  const handleAddImage = () => {
    if (imageUrl) {
      editor
        .chain()
        .focus()
        .setImage({ src: imageUrl, alt: imageAlt || 'Image' })
        .run()
    }
    setImageUrl('')
    setImageAlt('')
    setImageDialogOpen(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error("L'image est trop volumineuse (max 3 Mo)")
      return
    }

    try {
      setIsUploading(true)
      const bucket = 'editor-images'
      const path = `comments/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type,
      })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      const publicUrl = data?.publicUrl

      if (publicUrl) {
        editor
          .chain()
          .focus()
          .setImage({ src: publicUrl, alt: file.name || 'Image' })
          .run()
        toast.success('Image téléversée avec succès')
      }
    } catch (err) {
      debug.error("Erreur d'upload:", err)
      toast.error("Échec du téléversement de l'image")
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0 rounded-lg transition-all',
        active
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'bg-card/50 hover:bg-slate-100/80 text-foreground border border-transparent hover:border-slate-200/50'
      )}
    >
      {children}
    </Button>
  )

  return (
    <div className="relative border rounded-md overflow-hidden bg-background">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* AI Processing Overlay - Skeleton shimmer style */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Semi-transparent backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />

          {/* Skeleton lines with shimmer effect */}
          <div className="absolute inset-0 p-4 pt-14 space-y-3">
            {/* Simulate multiple text lines with varying widths */}
            <div className="h-4 bg-muted rounded animate-pulse w-[85%]">
              <div className="h-full w-full ai-skeleton-shimmer rounded" />
            </div>
            <div
              className="h-4 bg-muted rounded animate-pulse w-[92%]"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="h-full w-full ai-skeleton-shimmer rounded" />
            </div>
            <div
              className="h-4 bg-muted rounded animate-pulse w-[78%]"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="h-full w-full ai-skeleton-shimmer rounded" />
            </div>
            <div
              className="h-4 bg-muted rounded animate-pulse w-[88%]"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="h-full w-full ai-skeleton-shimmer rounded" />
            </div>
            <div
              className="h-4 bg-muted rounded animate-pulse w-[65%]"
              style={{ animationDelay: '0.4s' }}
            >
              <div className="h-full w-full ai-skeleton-shimmer rounded" />
            </div>
            <div
              className="h-4 bg-muted rounded animate-pulse w-[45%]"
              style={{ animationDelay: '0.5s' }}
            >
              <div className="h-full w-full ai-skeleton-shimmer rounded" />
            </div>
          </div>

          {/* Centered processing indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
              {/* Animated dots */}
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-[ai-dot-pulse_1.4s_ease-in-out_infinite]" />
                <div className="w-2 h-2 rounded-full bg-primary animate-[ai-dot-pulse_1.4s_ease-in-out_0.2s_infinite]" />
                <div className="w-2 h-2 rounded-full bg-primary animate-[ai-dot-pulse_1.4s_ease-in-out_0.4s_infinite]" />
              </div>

              {/* Sparkles icon and text */}
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span>L'IA travaille...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="border-b p-2 flex flex-wrap gap-1 bg-gradient-to-r from-slate-50/80 to-white/60 backdrop-blur-sm">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          disabled={disabled}
          title="Gras (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          disabled={disabled}
          title="Italique (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          disabled={disabled}
          title="Souligné (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-200/50 mx-1" />

        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          title={
            isUploading ? 'Téléversement en cours...' : 'Téléverser une image depuis votre appareil'
          }
        >
          <Upload className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          title="Titre"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          disabled={disabled}
          title="Liste à puces"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          disabled={disabled}
          title="Liste numérotée"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          disabled={disabled}
          title="Citation"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          disabled={disabled}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-200/50 mx-1" />

        <ToolbarButton
          onClick={() => setLinkDialogOpen(true)}
          active={editor.isActive('link')}
          disabled={disabled}
          title="Insérer un lien"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          title={
            isUploading ? 'Téléversement en cours...' : 'Téléverser une image depuis votre appareil'
          }
        >
          <Upload className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => setImageDialogOpen(true)}
          disabled={disabled}
          title="Insérer une image via URL"
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-slate-200/50 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo() || disabled}
          title="Annuler (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo() || disabled}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className={isAnimating ? 'ai-text-transition' : ''}>
        <EditorContent editor={editor} className="bg-background" />
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insérer un lien</DialogTitle>
            <DialogDescription>
              Sélectionnez d'abord le texte, puis ajoutez l'URL du lien
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://exemple.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddLink()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddLink}>Insérer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insérer une image</DialogTitle>
            <DialogDescription>Ajoutez l'URL de l'image à insérer</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">URL de l'image</Label>
              <Input
                id="image-url"
                placeholder="https://exemple.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image-alt">Texte alternatif</Label>
              <Input
                id="image-alt"
                placeholder="Description de l'image"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddImage()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddImage}>Insérer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
