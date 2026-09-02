import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const {
  CONVERSATION,
  mockFrom,
  mockSendMutate,
  mockCreateLinksMutate,
  mockExtractLinks,
  mockToggleRecording,
  mockImprove,
} = vi.hoisted(() => {
  const CONVERSATION = {
    id: 'conv-1',
    members: [
      { user_id: 'u1', user: { nom: 'Dupont', prenom: 'Alice' } },
      { user_id: 'u2', user: { nom: 'Martin', prenom: 'Bob' } },
    ],
  };

  const createBuilder = () => {
    const builder: Record<string, unknown> = {};
    const methods = [
      'select', 'eq', 'gte', 'lte', 'in', 'order', 'limit',
      'insert', 'update', 'delete', 'upsert', 'neq', 'is', 'range',
    ];
    methods.forEach((m) => {
      builder[m] = vi.fn(() => builder);
    });
    builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    builder.catch = () => Promise.resolve({ data: [], error: null });
    return builder;
  };

  return {
    CONVERSATION,
    mockFrom: vi.fn(() => createBuilder()),
    mockSendMutate: vi.fn(),
    mockCreateLinksMutate: vi.fn(),
    mockExtractLinks: vi.fn(() => []),
    mockToggleRecording: vi.fn(),
    mockImprove: vi.fn(() => Promise.resolve('texte amélioré')),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | boolean | undefined | null>) => args.filter(Boolean).join(' '),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/components/ui/button', async () => {
  const ReactMod = await import('react');
  const Button = ReactMod.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(
    (props, ref) => ReactMod.createElement('button', { ...props, ref })
  );
  return { Button, buttonVariants: () => '' };
});

vi.mock('@/components/ui/textarea', async () => {
  const ReactMod = await import('react');
  const Textarea = ReactMod.forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<'textarea'>>(
    (props, ref) => ReactMod.createElement('textarea', { ...props, ref })
  );
  return { Textarea };
});

vi.mock('@/components/ui/badge', async () => {
  const ReactMod = await import('react');
  const Badge = ReactMod.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
    (props, ref) => ReactMod.createElement('div', { ...props, ref })
  );
  return { Badge, badgeVariants: () => '' };
});

vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  useSendPulseMessage: () => ({ mutate: mockSendMutate, isPending: false }),
  pulseMessageKeys: { all: ['pulse-messages'] },
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversation: () => ({ data: CONVERSATION, isLoading: false }),
  pulseConversationKeys: { all: ['pulse-conversations'] },
}));

vi.mock('@/hooks/pulse/usePulseAIEditor', () => ({
  usePulseAIEditor: () => ({
    isProcessing: false,
    improve: mockImprove,
    reformulate: vi.fn(() => Promise.resolve(null)),
    translate: vi.fn(() => Promise.resolve(null)),
    shorten: vi.fn(() => Promise.resolve(null)),
    expand: vi.fn(() => Promise.resolve(null)),
  }),
}));

vi.mock('@/hooks/voice/useVoiceDictation', () => ({
  useVoiceDictation: () => ({
    isRecording: false,
    isProcessing: false,
    audioLevel: 0,
    toggleRecording: mockToggleRecording,
  }),
}));

vi.mock('@/hooks/pulse/usePulseEntityLinks', () => ({
  useCreatePulseEntityLinks: () => ({ mutate: mockCreateLinksMutate, isPending: false }),
  extractEntityLinksFromContent: mockExtractLinks,
}));

vi.mock('./MentionAutocomplete', () => ({
  MentionAutocomplete: () => null,
  default: () => null,
}));

vi.mock('./SlashCommandMenu', () => ({
  SlashCommandMenu: () => null,
  default: () => null,
}));

vi.mock('./EntityLinkAutocomplete', () => ({
  EntityLinkAutocomplete: () => null,
  default: () => null,
}));

vi.mock('./TaskCreatorModal', () => ({
  TaskCreatorModal: () => null,
  default: () => null,
}));

vi.mock('./EventCreatorModal', () => ({
  EventCreatorModal: () => null,
  default: () => null,
}));

vi.mock('./TodoCreatorModal', () => ({
  TodoCreatorModal: () => null,
  default: () => null,
}));

vi.mock('./PollCreatorModal', () => ({
  PollCreatorModal: () => null,
  default: () => null,
}));

vi.mock('./MessageEditorToolbar', () => ({
  MessageEditorToolbar: () => null,
  default: () => null,
}));

import { MessageEditor } from './MessageEditor';

function renderEditor(props: Partial<React.ComponentProps<typeof MessageEditor>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const onTyping = vi.fn();
  const onMessageSent = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MessageEditor
        conversationId="conv-1"
        onTyping={onTyping}
        onMessageSent={onMessageSent}
        {...props}
      />
    </QueryClientProvider>
  );
  return { ...utils, onTyping, onMessageSent };
}

describe('MessageEditor (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend le textarea avec le placeholder par défaut (préfixe "Écrivez un message...")', () => {
    renderEditor();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.placeholder).toContain('Écrivez un message...');
  });

  it('rend le textarea avec un placeholder personnalisé', () => {
    renderEditor({ placeholder: 'Répondre dans le fil...' });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain('Répondre dans le fil...');
    expect(textarea.placeholder).not.toContain('Écrivez un message...');
  });

  it('appelle onTyping(true) quand du texte est saisi', () => {
    const { onTyping } = renderEditor();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Bonjour' } });

    expect(onTyping).toHaveBeenCalledWith(true);
    expect(textarea.value).toBe('Bonjour');
  });

  it('appelle onTyping(false) quand le contenu est vidé', () => {
    const { onTyping } = renderEditor();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Bonjour' } });
    fireEvent.change(textarea, { target: { value: '' } });

    expect(onTyping).toHaveBeenLastCalledWith(false);
    expect(textarea.value).toBe('');
  });

  it('se rend en mode compact avec un parentMessageId sans erreur', () => {
    renderEditor({ compactMode: true, parentMessageId: 'msg-parent-1' });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('rend un input fichier caché acceptant images et documents', () => {
    const { container } = renderEditor();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    expect(fileInput?.accept).toContain('image/*');
    expect(fileInput?.accept).toContain('.pdf');
    expect(fileInput?.multiple).toBe(true);
  });
});