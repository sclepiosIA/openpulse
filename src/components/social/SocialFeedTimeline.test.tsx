import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { SocialFeedTimeline } from './SocialFeedTimeline';

const { mockFormatDistanceToNow, mockFrLocale } = vi.hoisted(() => ({
  mockFormatDistanceToNow: vi.fn(() => 'il y a 2 jours'),
  mockFrLocale: { code: 'fr' },
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: mockFormatDistanceToNow,
}));

vi.mock('date-fns/locale', () => ({
  fr: mockFrLocale,
}));

vi.mock('lucide-react', () => ({
  ExternalLink: ({ className }: { className?: string }) => (
    <svg data-testid="icon-external-link" className={className} />
  ),
  Heart: ({ className }: { className?: string }) => (
    <svg data-testid="icon-heart" className={className} />
  ),
  MessageCircle: ({ className }: { className?: string }) => (
    <svg data-testid="icon-message-circle" className={className} />
  ),
  Share2: ({ className }: { className?: string }) => (
    <svg data-testid="icon-share" className={className} />
  ),
  Eye: ({ className }: { className?: string }) => (
    <svg data-testid="icon-eye" className={className} />
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: ReactNode }) => (
    <section data-testid="card">{children}</section>
  ),
  CardContent: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/social/PlatformBadge', () => ({
  PlatformBadge: ({ platform }: { platform: string }) => (
    <span data-testid={`platform-${platform}`}>{platform}</span>
  ),
}));

type TimelinePosts = ComponentProps<typeof SocialFeedTimeline>['posts'];

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SocialFeedTimeline', () => {
  it('affiche un état vide quand aucun post n’est fourni', () => {
    renderWithProviders(<SocialFeedTimeline posts={[]} />);

    expect(
      screen.getByText(
        "Aucun post synchronisé pour l'instant. Lancez une synchronisation depuis les paramètres.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('card')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /voir/i })).not.toBeInTheDocument();
    expect(mockFormatDistanceToNow).not.toHaveBeenCalled();
  });

  it('affiche les informations métier d’un post synchronisé', () => {
    const posts = [
      {
        id: 'post-1',
        platform: 'instagram',
        published_at: '2024-01-02T12:00:00.000Z',
        permalink: 'https://social.test/p/1',
        media_urls: ['https://media.test/image-1.jpg'],
        message: 'Premier post publié depuis le flux social.',
        likes_count: 12,
        comments_count: 3,
        shares_count: 2,
        views_count: 456,
      },
    ] as unknown as TimelinePosts;

    renderWithProviders(<SocialFeedTimeline posts={posts} />);

    expect(screen.getByText('Premier post publié depuis le flux social.')).toBeInTheDocument();
    expect(screen.getByTestId('platform-instagram')).toHaveTextContent('instagram');
    expect(screen.getByText('il y a 2 jours')).toBeInTheDocument();

    expect(mockFormatDistanceToNow).toHaveBeenCalledTimes(1);
    expect(mockFormatDistanceToNow).toHaveBeenCalledWith(
      new Date('2024-01-02T12:00:00.000Z'),
      { addSuffix: true, locale: mockFrLocale },
    );

    expect(screen.getByRole('link', { name: /voir/i })).toHaveAttribute(
      'href',
      'https://social.test/p/1',
    );
    expect(screen.getByRole('link', { name: /voir/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByTestId('icon-external-link')).toBeInTheDocument();

    const image = document.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://media.test/image-1.jpg');
    expect(image).toHaveAttribute('loading', 'lazy');

    expect(screen.getByTestId('icon-heart')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('icon-message-circle')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('icon-share')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('icon-eye')).toBeInTheDocument();
    expect(screen.getByText('456')).toBeInTheDocument();
  });

  it('masque les éléments optionnels absents ou à zéro', () => {
    const posts = [
      {
        id: 'post-2',
        platform: 'facebook',
        published_at: null,
        permalink: null,
        media_urls: [],
        message: 'Post sans média ni lien externe.',
        likes_count: 7,
        comments_count: 0,
        shares_count: 1,
        views_count: 0,
      },
    ] as unknown as TimelinePosts;

    renderWithProviders(<SocialFeedTimeline posts={posts} />);

    expect(screen.getByText('Post sans média ni lien externe.')).toBeInTheDocument();
    expect(screen.getByTestId('platform-facebook')).toHaveTextContent('facebook');
    expect(screen.queryByRole('link', { name: /voir/i })).not.toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-eye')).not.toBeInTheDocument();

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(mockFormatDistanceToNow).not.toHaveBeenCalled();
  });
});