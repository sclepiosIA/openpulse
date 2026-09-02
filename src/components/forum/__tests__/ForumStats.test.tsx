import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForumStats } from '../ForumStats';
import type { ForumPost } from '@/types/forum';

const makePost = (overrides: Partial<ForumPost> = {}): ForumPost => ({
  id: Math.random().toString(),
  user_id: 'u1',
  titre: 'Post',
  contenu: 'Content',
  categorie: 'general',
  created_at: new Date().toISOString(),
  nombre_commentaires: 0,
  upvotes: 0,
  views_count: 0,
  est_epingle: false,
  est_resolu: false,
  ...overrides,
} as ForumPost);

describe('ForumStats', () => {
  it('renders total posts count', () => {
    const posts = [makePost(), makePost(), makePost()];
    render(<ForumStats posts={posts} />);
    const allThrees = screen.getAllByText('3');
    expect(allThrees.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Posts totaux')).toBeInTheDocument();
  });

  it('renders total comments', () => {
    const posts = [
      makePost({ nombre_commentaires: 5 }),
      makePost({ nombre_commentaires: 3 }),
    ];
    render(<ForumStats posts={posts} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Commentaires')).toBeInTheDocument();
  });

  it('renders weekly posts', () => {
    const recent = makePost({ created_at: new Date().toISOString() });
    const old = makePost({ created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() });
    render(<ForumStats posts={[recent, old]} />);
    expect(screen.getByText('Cette semaine')).toBeInTheDocument();
  });

  it('renders active members count', () => {
    const posts = [
      makePost({ user_id: 'u1' }),
      makePost({ user_id: 'u2' }),
      makePost({ user_id: 'u1' }), // duplicate
    ];
    render(<ForumStats posts={posts} />);
    expect(screen.getByText('Membres actifs')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<ForumStats posts={[]} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(4);
  });
});
