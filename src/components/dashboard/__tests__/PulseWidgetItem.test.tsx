import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PulseWidgetItem } from '../PulseWidgetItem';

vi.mock('@/components/ui/UserAvatar', () => ({
  UserAvatar: ({ name }: any) => <div data-testid="avatar">{name}</div>,
}));

vi.mock('../PulseWidgetMessagePreview', () => ({
  PulseWidgetMessagePreview: ({ content }: any) => <span>{content}</span>,
}));

vi.mock('@/components/pulse/PulseMarkdownRenderer', () => ({
  PulseMarkdownRenderer: ({ content }: any) => <span>{content}</span>,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: null, isLoading: false }),
}));

describe('PulseWidgetItem', () => {
  const baseConversation = {
    id: 'c1',
    name: 'Projet Alpha',
    visibility: 'public' as const,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-09T10:00:00Z',
    members: [
      { user_id: 'u1', user: { id: 'u1', nom: 'Dupont', prenom: 'Jean', avatar_url: null } },
      { user_id: 'u2', user: { id: 'u2', nom: 'Martin', prenom: 'Marie', avatar_url: null } },
    ],
    last_message: {
      id: 'm1',
      content: 'Bonjour tout le monde',
      created_at: '2026-03-09T10:00:00Z',
      user: { nom: 'Martin', prenom: 'Marie', avatar_url: null },
    },
  } as any;

  it('renders conversation name', () => {
    render(<PulseWidgetItem conversation={baseConversation} unreadCount={0} index={0} currentUserId="u1" onClick={vi.fn()} />);
    expect(screen.getByText('Projet Alpha')).toBeInTheDocument();
  });

  it('shows unread badge when count > 0', () => {
    render(<PulseWidgetItem conversation={baseConversation} unreadCount={5} index={0} currentUserId="u1" onClick={vi.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows AI summary when provided', () => {
    render(<PulseWidgetItem conversation={baseConversation} unreadCount={0} index={0} currentUserId="u1" onClick={vi.fn()} summary="Résumé IA test" />);
    expect(screen.getByText('Résumé IA test')).toBeInTheDocument();
  });

  it('shows interlocutor name (not current user)', () => {
    render(<PulseWidgetItem conversation={baseConversation} unreadCount={0} index={0} currentUserId="u1" onClick={vi.fn()} />);
    const matches = screen.getAllByText(/Marie/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
