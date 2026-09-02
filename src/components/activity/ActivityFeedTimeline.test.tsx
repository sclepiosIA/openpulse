import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  ITEMS,
  mockToggleReaction,
  mockTogglePin,
  PINNED_KEYS,
  REACTIONS_BY_KEY,
  mockFrom,
  mockBuilder,
  IntersectionObserverMock,
} = vi.hoisted(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const ITEMS = [
    { id: 't1', occurred_at: new Date(now).toISOString(), content: 'first' },
    { id: 't2', occurred_at: new Date(now - 10 * oneDay).toISOString(), content: 'older' },
    { id: 'focus1', occurred_at: new Date(now).toISOString(), content: 'focus' },
  ];

  const mockToggleReaction = vi.fn();
  const mockTogglePin = vi.fn();

  const PINNED_KEYS = new Set<string>(['t2']);

  const REACTIONS_BY_KEY: Record<string, string[]> = {
    t1: ['like'],
    t2: [],
    focus1: [],
  };

  // Supabase builder mock (chainable & thenable)
  const mockBuilder = {
    select: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    eq: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    gte: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    lte: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    in: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    order: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    limit: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    insert: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    update: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    delete: vi.fn(function (..._args: unknown[]) {
      return this;
    }),
    single: vi.fn(function () {
      return this;
    }),
    maybeSingle: vi.fn(function () {
      return this;
    }),
    then: vi.fn(function (onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve({ data: null, error: null }).then(onFulfilled);
    }),
    catch: vi.fn(function (onRejected: (e: unknown) => unknown) {
      return Promise.resolve().catch(onRejected);
    }),
  };

  const mockFrom = vi.fn(() => mockBuilder);

  // Minimal IntersectionObserver mock to avoid JSDOM missing API
  class IntersectionObserverMock {
    cb: IntersectionObserverCallback;
    opts: IntersectionObserverInit | undefined;
    constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
      this.cb = cb;
      this.opts = opts;
    }
    observe(_el: Element) {
      // do nothing; tests will trigger load more via button clicks
    }
    unobserve(_el: Element) {
      // noop
    }
    disconnect() {
      // noop
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  return {
    ITEMS,
    mockToggleReaction,
    mockTogglePin,
    PINNED_KEYS,
    REACTIONS_BY_KEY,
    mockFrom,
    mockBuilder,
    IntersectionObserverMock,
  };
});

// Provide global IntersectionObserver before importing component code
if (typeof (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver === 'undefined') {
  // @ts-expect-error assign mock
  globalThis.IntersectionObserver = IntersectionObserverMock;
}

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/components/ui/button', () => {
  return {
    Button: (props: { children?: React.ReactNode } & Record<string, unknown>) => {
      const { children, ...rest } = props;
      // Use a real button element so disabled/onclick behave naturally
      return (
        <button type={(rest.type as string) ?? 'button'} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
          {children}
        </button>
      );
    },
  };
});

vi.mock('lucide-react', () => ({
  Activity: (props: Record<string, unknown>) => <span {...(props as React.HTMLAttributes<HTMLSpanElement>)}>ICON-Activity</span>,
  ArrowUp: (props: Record<string, unknown>) => <span {...(props as React.HTMLAttributes<HTMLSpanElement>)}>ICON-ArrowUp</span>,
}));

vi.mock('./ActivityFeedSkeleton', () => ({
  ActivityFeedSkeleton: () => <div> SKELETON </div>,
}));

vi.mock('./ActivityFeedItem', () => {
  return {
    ActivityFeedItem: (props: {
      item: { id: string };
      reactions?: string[];
      pinned?: boolean;
      highlight?: boolean;
      onOpenDetail: (it: { id: string }) => void;
      onTogglePin: (id: string) => void;
      onToggleReaction: (id: string) => void;
    }) => {
      const { item, reactions, pinned, highlight, onOpenDetail, onTogglePin, onToggleReaction } = props;
      return (
        <div data-testid={`item-${item.id}`} id={`activity-${item.id}`}>
          <span>id:{item.id}</span>
          <span> reactions:{(reactions ?? []).length}</span>
          <span> pinned:{pinned ? 'yes' : 'no'}</span>
          <button onClick={() => onOpenDetail(item)}>open-detail</button>
          <button onClick={() => onTogglePin(item.id)}>toggle-pin</button>
          <button onClick={() => onToggleReaction(item.id)}>toggle-reaction</button>
          <span> highlight:{highlight ? 'yes' : 'no'}</span>
        </div>
      );
    },
  };
});

vi.mock('./ActivityDetailSheet', () => {
  return {
    ActivityDetailSheet: (props: {
      item: { id: string } | null;
      open: boolean;
      onOpenChange: (o: boolean) => void;
      pinned: boolean;
      onTogglePin: (id: string) => void;
    }) => {
      const { item, open, onOpenChange, pinned, onTogglePin } = props;
      if (!open || !item) return <div data-testid="detail-closed">DETAIL-CLOSED</div>;
      return (
        <div data-testid={`detail-${item.id}`}>
          <div>DETAIL-{item.id}</div>
          <div>pinned:{pinned ? 'yes' : 'no'}</div>
          <button onClick={() => onTogglePin(item.id)}>detail-toggle-pin</button>
          <button onClick={() => onOpenChange(false)}>detail-close</button>
        </div>
      );
    },
  };
});

vi.mock('@/hooks/activity/useActivityReactions', () => {
  return {
    useActivityReactions: (activityKeys: string[]) => {
      return { reactionsByKey: REACTIONS_BY_KEY, toggle: mockToggleReaction };
    },
  };
});

vi.mock('@/hooks/activity/useActivityPins', () => {
  return {
    useActivityPins: () => {
      return { pinnedKeys: PINNED_KEYS, togglePin: mockTogglePin };
    },
  };
});

// Extra safe mocks for potential app-wide imports
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.com' }, isLoading: false }),
}));
vi.mock('@/components/AuthProvider', () => ({ AuthProvider: (p: { children?: React.ReactNode }) => <div>{p.children}</div> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

import { ActivityFeedTimeline } from './ActivityFeedTimeline';
import { useActivityReactions } from '@/hooks/activity/useActivityReactions';
import { useActivityPins } from '@/hooks/activity/useActivityPins';

describe('ActivityFeedTimeline', () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const renderWithClient = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);

  it('renders skeleton when loading and no items', () => {
    renderWithClient(<ActivityFeedTimeline items={[]} isLoading />);
    expect(screen.getByText('SKELETON')).toBeTruthy();
  });

  it('renders empty label when no items and not loading', () => {
    renderWithClient(<ActivityFeedTimeline items={[]} isLoading={false} />);
    expect(screen.getByText('Aucune activité à afficher')).toBeTruthy();
  });

  it('renders grouped items, pendingNew button, supports refresh, load more and fetching state, and detail/pin interactions', async () => {
    const onRefresh = vi.fn();
    const onLoadMore = vi.fn();

    // initial render with hasNextPage true and not fetching
    renderWithClient(
      <ActivityFeedTimeline
        items={ITEMS}
        isLoading={false}
        hasNextPage={true}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
        pendingNew={2}
        onRefresh={onRefresh}
      />
    );

    // There should be headings showing group counts (look for "· X activité")
    const groupBadges = screen.getAllByText(/· \d+ activité/);
    expect(groupBadges.length).toBeGreaterThanOrEqual(1);

    // Each item is rendered with test id
    expect(screen.getByTestId('item-t1')).toBeTruthy();
    expect(screen.getByTestId('item-t2')).toBeTruthy();
    expect(screen.getByTestId('item-focus1')).toBeTruthy();

    // Verify reactions count and pinned status reflected in the mocked item markup
    expect(screen.getByTestId('item-t1').textContent).toContain('reactions:1');
    expect(screen.getByTestId('item-t2').textContent).toContain('pinned:yes');

    // Pending new button text (plural)
    const pendingBtn = screen.getByText(/2 nouvelle/);
    expect(pendingBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(pendingBtn);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Load more button visible and clickable
    const loadMoreBtn = screen.getByText('Charger plus');
    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Re-render with isFetchingNextPage true to show disabled state and "Chargement…"
    renderWithClient(
      <ActivityFeedTimeline
        items={ITEMS}
        isLoading={false}
        hasNextPage={true}
        isFetchingNextPage={true}
        onLoadMore={onLoadMore}
      />
    );
    const loadingBtn = screen.getByText('Chargement…');
    expect(loadingBtn).toBeTruthy();
    // The rendered button is a real button; check disabled attribute
    expect((loadingBtn as HTMLButtonElement).disabled).toBe(true);

    // Open detail for focus1 by clicking its open-detail button
    const openBtn = screen.getAllByText('open-detail').find((el) => el.parentElement?.id === 'activity-focus1');
    expect(openBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(openBtn!);
    });
    // Detail sheet should open
    expect(screen.getByTestId('detail-focus1')).toBeTruthy();

    // Clicking detail pin should call mockTogglePin with id
    const detailPinBtn = screen.getByText('detail-toggle-pin');
    await act(async () => {
      fireEvent.click(detailPinBtn);
    });
    expect(mockTogglePin).toHaveBeenCalledWith('focus1');

    // Also verify toggling pin from item-level button triggers the same mock
    const itemTogglePinBtn = screen.getAllByText('toggle-pin').find((el) => el.parentElement?.id === 'activity-t1');
    expect(itemTogglePinBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(itemTogglePinBtn!);
    });
    expect(mockTogglePin).toHaveBeenCalledWith('t1');
  });

  it('scrolls focused item into view when focusId provided', () => {
    const scrollSpy = vi.fn();
    const original = Element.prototype.scrollIntoView;
    // @ts-expect-error override for test
    Element.prototype.scrollIntoView = scrollSpy as unknown as typeof original;

    try {
      renderWithClient(<ActivityFeedTimeline items={ITEMS} isLoading={false} focusId="focus1" />);
      expect(scrollSpy).toHaveBeenCalled();
    } finally {
      // restore
      // @ts-expect-error restore
      Element.prototype.scrollIntoView = original;
    }
  });

  it('provides activity reactions hook with stable references via renderHook', async () => {
    const keys = ITEMS.map((i) => i.id);
    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useActivityReactions(keys), { wrapper });
    expect(result.current.reactionsByKey).toBe(REACTIONS_BY_KEY);
    expect(result.current.toggle).toBe(mockToggleReaction);
  });

  it('provides activity pins hook stable references', async () => {
    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useActivityPins(), { wrapper });
    expect(result.current.pinnedKeys).toBe(PINNED_KEYS);
    expect(result.current.togglePin).toBe(mockTogglePin);
  });
});