import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { SupabaseProvider, type CollabUser } from '@/lib/collab/SupabaseProvider';
import { useAuth } from '@/hooks/shared/useAuth';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useNativeDocumentSave } from '@/hooks/documents/useNativeDocumentSave';
import { toast } from 'sonner';

interface UseCollaborativeEditorOptions {
  documentId: string;
  documentName: string;
  initialContent?: string;
  folderId?: string | null;
}

interface ConnectedUser {
  user_id: string;
  user_name: string;
  user_avatar?: string;
  user_color: string;
}

const COLLAB_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

export function useCollaborativeEditor({
  documentId,
  documentName,
  initialContent = '',
  folderId,
}: UseCollaborativeEditorOptions) {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const providerRef = useRef<SupabaseProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasChangesRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { save: saveToNextcloud, isSaving } = useNativeDocumentSave({
    documentName,
    mimeType: 'text/html',
    extension: 'html',
    folderId,
    existingDocumentId: documentId,
  });

  // Stable ydoc + provider initialization
  const { ydoc, provider } = useMemo(() => {
    if (!user?.id || !documentId) return { ydoc: null, provider: null };

    const doc = new Y.Doc();
    const collabUser: CollabUser = {
      id: user.id,
      name: profile?.prenom && profile?.nom
        ? `${profile.prenom} ${profile.nom}`
        : user.email || 'Anonyme',
      avatar: profile?.avatar_url,
      color: COLLAB_COLORS[Math.abs(hashCode(user.id)) % COLLAB_COLORS.length],
    };

    const prov = new SupabaseProvider(documentId, doc, collabUser);
    return { ydoc: doc, provider: prov };
  }, [user?.id, documentId, profile?.prenom, profile?.nom, profile?.avatar_url]);

  // TipTap editor with collaboration extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      } as Parameters<typeof StarterKit.configure>[0]),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Commencez à rédiger votre document...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      ...(ydoc ? [
        Collaboration.configure({ document: ydoc }),
        ...(provider ? [
          CollaborationCursor.configure({
            // SupabaseProvider implémente l'interface attendue par tiptap mais n'est pas un HocuspocusProvider
            provider: provider as unknown as Record<string, unknown>,
            user: {
              name: provider.user?.name || 'Anonyme',
              color: provider.user?.color || COLLAB_COLORS[0],
            },
          }),

        ] : []),
      ] : []),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[500px] px-8 py-6 [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer hover:[&_a]:text-primary/80',
      },
    },
  }, [ydoc, provider]);

  // Connect provider + load initial content
  useEffect(() => {
    if (!provider || !ydoc) return;

    providerRef.current = provider;
    ydocRef.current = ydoc;

    provider.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    provider.onSynced(() => {
      setIsSynced(true);

      // If the Yjs doc is empty after sync, inject initial HTML content
      const xmlFragment = ydoc.getXmlFragment('default');
      if (xmlFragment.length === 0 && initialContent && editor) {
        editor.commands.setContent(initialContent);
      }
    });

    provider.connect();

    // Poll connected users every 3s
    pollIntervalRef.current = setInterval(() => {
      if (providerRef.current) {
        setConnectedUsers(providerRef.current.getConnectedUsers());
      }
    }, 3000);

    // Track changes for auto-save
    const updateHandler = () => {
      hasChangesRef.current = true;
    };
    ydoc.on('update', updateHandler);

    return () => {
      ydoc.off('update', updateHandler);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  // Auto-save every 10s if changes detected
  useEffect(() => {
    autoSaveTimer.current = setInterval(async () => {
      if (hasChangesRef.current && editor && !isSaving) {
        hasChangesRef.current = false;
        try {
          const html = editor.getHTML();
          const blob = new Blob([html], { type: 'text/html' });
          await saveToNextcloud(blob);
        } catch (err) {
          console.error('Auto-save error:', err);
        }
      }
    }, 10000);

    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [editor, isSaving, saveToNextcloud]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (!editor || isSaving) return;
    try {
      const html = editor.getHTML();
      const blob = new Blob([html], { type: 'text/html' });
      await saveToNextcloud(blob);
      hasChangesRef.current = false;
      toast.success('Document enregistré');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  }, [editor, isSaving, saveToNextcloud]);

  return {
    editor,
    connectedUsers,
    isConnected,
    isSynced,
    isSaving,
    handleSave,
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}
