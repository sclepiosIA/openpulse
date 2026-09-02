import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { act } from 'react';
import React from 'react';
import { NestedComment } from './NestedComment';

const { state, mockFrom, AUTH, TEAM_FALSE, TEAM_PROFILE_NULL, ETAB_USER, mockToastSuccess, mockToastError } = vi.hoisted(() => {
  const state: { maybeSingleResult: { data: unknown; error: unknown } } = {
    maybeSingleResult: { data: null, error: null },
  };
  const builder: Record<string, unknown> = {};
  ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'insert', 'update', 'delete'].forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve(state.maybeSingleResult));
  builder.single = vi.fn(() => Promise.resolve(state.maybeSingleResult));
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  const mockFrom = vi.fn(() => builder);
  return {
    state,
    mockFrom,
    AUTH: { user: { id: 'u1', email: 't@t.co' } },
    TEAM_FALSE: { data: false },
    TEAM_PROFILE_NULL: { data: null },
    ETAB_USER: { etablissementUser: null },
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  };
});

vi.mock('@/lib/supabaseBrowser', () => ({ supabase: { from: mockFrom } }));
vi.mock('@/lib/debug', () => ({ debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: mockToastSuccess, error: mockToastError } }));
vi.mock('@/hooks/shared/useAuth', () => ({ useAuth: () => AUTH }));
vi.mock('@/hooks/hr/useTeamMember', () => ({
  useIsTeamMember: () => TEAM_FALSE,
  useTeamMemberProfile: () => TEAM_PROFILE_NULL,
}));
vi.mock('@/hooks/crm/useEtablissementUser', () => ({ useEtablissementUser: () => ETAB_USER }));

vi.mock('./ForumAvatar', () => ({ ForumAvatar: () => <div data-testid="forum-avatar" /> }));
vi.mock('./UserProfileHoverCard', () => ({
  UserProfileHoverCard: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./EmojiReactionPicker', () => ({ EmojiReactionPicker: () => null }));
vi.mock('./SafeHtmlContent', () => ({
  SafeHtmlContent: ({ html }: { html: string }) => <div data-testid="safe-html">{html}</div>,
}));
vi.mock('@/components/email/LazyRichTextEditor', () => ({
  RichTextEditor: ({
    content,
    onChange,
  }: {
    content: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children?: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

const anonymousComment = {
  id: 'c1',
  user_id: null,
  contenu: '<p>Contenu anonyme</p>',
  upvotes: 7,
  created_at: '2024-01-15T10:30:00.000Z',
  author_prenom: 'Jean',
  author_nom: 'Dupont',
  author_role: 'Médecin',
};

const identifiedComment = {
  id: 'c2',
  user_id: 'user-42',
  contenu: '<p>Contenu vérifié</p>',
  upvotes: 3,
  created_at: '2024-02-01T08:00:00.000Z',
  etablissement_users: {
    id: 'eu-1',
    prenom: 'Marie',
    nom: 'Curie',
    fonction: 'Infirmier(ère)',
    service: 'Urgences',
    etablissements: { nom: 'CH Test' },
  },
};

describe('NestedComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.maybeSingleResult = { data: null, error: null };
  });

  it('affiche un commentaire anonyme avec nom, rôle, badge Contributeur et upvotes', async () => {
    const onVote = vi.fn();
    const onReply = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(
        <NestedComment
          comment={anonymousComment}
          postId="p1"
          onVote={onVote}
          onReply={onReply}
        />
      );
    });

    expect(screen.getByText('Jean Dupont')).toBeTruthy();
    expect(screen.getByText('Médecin')).toBeTruthy();
    expect(screen.getByText('Contributeur')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByTestId('safe-html').textContent).toBe('<p>Contenu anonyme</p>');
  });

  it('affiche le badge Compte vérifié pour un utilisateur identifié et vérifie le rôle via supabase', async () => {
    await act(async () => {
      render(
        <NestedComment
          comment={identifiedComment}
          postId="p1"
          onVote={vi.fn()}
          onReply={vi.fn().mockResolvedValue(undefined)}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Compte vérifié')).toBeTruthy();
    });
    expect(screen.getByText('Marie Curie')).toBeTruthy();
    expect(mockFrom).toHaveBeenCalledWith('user_roles');
  });

  it('affiche le badge OpenPulse quand l’auteur est membre de l’équipe', async () => {
    state.maybeSingleResult = { data: { role: 'admin' }, error: null };

    await act(async () => {
      render(
        <NestedComment
          comment={identifiedComment}
          postId="p1"
          onVote={vi.fn()}
          onReply={vi.fn().mockResolvedValue(undefined)}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('OpenPulse')).toBeTruthy();
    });
  });

  it('appelle onVote avec l’id du commentaire au clic sur le bouton de vote', async () => {
    const onVote = vi.fn();

    await act(async () => {
      render(
        <NestedComment
          comment={anonymousComment}
          postId="p1"
          onVote={onVote}
          onReply={vi.fn().mockResolvedValue(undefined)}
        />
      );
    });

    fireEvent.click(screen.getByText('7'));
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(onVote).toHaveBeenCalledWith('c1');
  });

  it('affiche le formulaire de réponse au clic sur Répondre', async () => {
    await act(async () => {
      render(
        <NestedComment
          comment={anonymousComment}
          postId="p1"
          onVote={vi.fn()}
          onReply={vi.fn().mockResolvedValue(undefined)}
        />
      );
    });

    fireEvent.click(screen.getByText('Répondre'));

    expect(screen.getByText('Vos informations')).toBeTruthy();
    expect(screen.getByText('Votre réponse *')).toBeTruthy();
    expect(screen.getByTestId('rich-text-editor')).toBeTruthy();
    expect(screen.getByText('Annuler')).toBeTruthy();
  });

  it('masque le bouton Répondre au-delà du niveau maximum d’imbrication', async () => {
    await act(async () => {
      render(
        <NestedComment
          comment={anonymousComment}
          postId="p1"
          onVote={vi.fn()}
          onReply={vi.fn().mockResolvedValue(undefined)}
          level={3}
        />
      );
    });

    expect(screen.queryByText('Répondre')).toBeNull();
  });
});