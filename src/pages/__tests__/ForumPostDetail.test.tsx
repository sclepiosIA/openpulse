import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) },
}));
vi.mock('@/hooks/forum/useForumPosts', () => ({
  useForumPost: () => ({ data: null, isLoading: true, error: null }),
}));
vi.mock('@/components/forum/ForumPostCard', () => ({
  ForumPostCard: () => <div data-testid="post-card" />,
}));
vi.mock('@/components/forum/CommentSection', () => ({
  CommentSection: () => <div />,
}));
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/components/forum/ScrollToTop', () => ({
  ScrollToTop: () => null,
}));

import ForumPostDetail from '../ForumPostDetail';
import { supabase } from '@/integrations/supabase/client';

describe('ForumPostDetail page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders loading state', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/forum/post-1']}>
          <Routes>
            <Route path="/forum/:postId" element={<ForumPostDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    // PageDataState (common variant) renders <Skeleton> elements while loading.
    // The Skeleton component renders a div with bg-muted; check that it rendered something.
    expect(container.querySelector('.bg-muted, .animate-spin')).toBeTruthy();
  });
});
