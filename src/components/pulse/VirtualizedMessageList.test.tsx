/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VirtualizedMessageList } from './VirtualizedMessageList';

const {
  PROFILE,
  RECEIPT_BY_ID,
  mockGetMessageReceiptStatus,
  mockUsePulseMessageReceipts,
  mockUseCurrentProfile,
  mockScrollToIndex,
  mockUseVirtualizer,
  mockOnJoinVisio,
  capturedMessageItemProps,
} = vi.hoisted(() => {
  const PROFILE = { id: 'u1', name: 'Alice' };

  const RECEIPT_BY_ID: Record<string, { status?: 'sent' | 'delivered' | 'read'; readCount: number; totalRecipients: number }> = {
    m1: { status: 'read', readCount: 3, totalRecipients: 5 },
    m2: { status: 'read', readCount: 4, totalRecipients: 5 },
    m3: { status: 'delivered', readCount: 0, totalRecipients: 1 },
  };

  const mockGetMessageReceiptStatus = vi.fn((messageId: string) => {
    return RECEIPT_BY_ID[messageId] ?? { status: 'sent', readCount: 0, totalRecipients: 1 };
  });

  const mockUsePulseMessageReceipts = vi.fn(() => ({
    getMessageReceiptStatus: mockGetMessageReceiptStatus,
    isGroupChat: true,
  }));

  const mockUseCurrentProfile = vi.fn(() => ({
    data: PROFILE,
    isLoading: false,
    isError: false,
  }));

  const mockScrollToIndex = vi.fn();

  const mockUseVirtualizer = vi.fn();

  const mockOnJoinVisio = vi.fn();

  const capturedMessageItemProps: Array<{
    message: { id: string; content: string; created_at: string; user_id: string };
    conversationId: string;
    showAvatar: boolean;
    receiptStatus?: string;
    isGroupChat: boolean;
    readByCount: number;
    totalRecipients: number;
  }> = [];

  return {
    PROFILE,
    RECEIPT_BY_ID,
    mockGetMessageReceiptStatus,
    mockUsePulseMessageReceipts,
    mockUseCurrentProfile,
    mockScrollToIndex,
    mockUseVirtualizer,
    mockOnJoinVisio,
    capturedMessageItemProps,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };
  const mockFrom = vi.fn(() => builder);
  return { supabase: { from: mockFrom } };
});

vi.mock('@/hooks/pulse/usePulseMessageReceipts', () => ({
  usePulseMessageReceipts: mockUsePulseMessageReceipts,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Video: () => <svg data-testid="video-icon" />,
}));

vi.mock('./MessageItem', () => ({
  MessageItem: (props: {
    message: { id: string; content: string; created_at: string; user_id: string };
    conversationId: string;
    showAvatar: boolean;
    receiptStatus?: string;
    isGroupChat: boolean;
    readByCount: number;
    totalRecipients: number;
    onOpenThread: () => void;
  }) => {
    capturedMessageItemProps.push({
      message: props.message,
      conversationId: props.conversationId,
      showAvatar: props.showAvatar,
      receiptStatus: props.receiptStatus,
      isGroupChat: props.isGroupChat,
      readByCount: props.readByCount,
      totalRecipients: props.totalRecipients,
    });

    return (
      <div data-testid={`message-item-${props.message.id}`}>
        <span>{props.message.content}</span>
        <span data-testid={`show-avatar-${props.message.id}`}>{String(props.showAvatar)}</span>
        <span data-testid={`receipt-${props.message.id}`}>{String(props.receiptStatus)}</span>
        <span data-testid={`group-${props.message.id}`}>{String(props.isGroupChat)}</span>
        <span data-testid={`readcount-${props.message.id}`}>{String(props.readByCount)}</span>
        <span data-testid={`totalrecipients-${props.message.id}`}>{String(props.totalRecipients)}</span>
        {props.receiptStatus === 'read' && (
          <span>{props.isGroupChat ? `Lu par ${props.readByCount}/${props.totalRecipients}` : 'Lu'}</span>
        )}
      </div>
    );
  },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: mockUseVirtualizer,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('VirtualizedMessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedMessageItemProps.length = 0;

    mockUseVirtualizer.mockImplementation((options: { count: number; estimateSize: (index: number) => number }) => ({
      getTotalSize: () => Array.from({ length: options.count }, (_, index) => options.estimateSize(index)).reduce((a, b) => a + b, 0),
      getVirtualItems: () =>
        Array.from({ length: options.count }, (_, index) => ({
          index,
          start: index * 100,
          size: options.estimateSize(index),
          key: `row-${index}`,
        })),
      scrollToIndex: mockScrollToIndex,
    }));
  });

  it('affiche l’état vide quand il n’y a aucun message', () => {
    render(
      <Wrapper>
        <VirtualizedMessageList messages={[]} conversationId="conv-1" />
      </Wrapper>
    );

    expect(screen.getByText('Aucun message')).toBeInTheDocument();
    expect(screen.getByText('Soyez le premier à envoyer un message !')).toBeInTheDocument();
    expect(mockUseVirtualizer).toHaveBeenCalledWith(
      expect.objectContaining({
        count: 0,
        overscan: 10,
      })
    );
    expect(mockScrollToIndex).not.toHaveBeenCalled();
  });

  it('rend les dividers de date, calcule showAvatar, les reçus, et permet de rejoindre une visio', () => {
    const messages = [
      {
        id: 'm1',
        content: 'Premier message',
        created_at: '2024-01-10T10:00:00.000Z',
        user_id: 'u1',
      },
      {
        id: 'm2',
        content: 'Second message même auteur en moins de 5 min',
        created_at: '2024-01-10T10:03:00.000Z',
        user_id: 'u1',
      },
      {
        id: 'm3',
        content: '📹 Visio OpenPulse Meet démarrée : https://app.local/visio/room-42',
        created_at: '2024-01-11T09:00:00.000Z',
        user_id: 'u2',
      },
    ];

    render(
      <Wrapper>
        <VirtualizedMessageList
          messages={messages}
          conversationId="conv-1"
          onJoinVisio={mockOnJoinVisio}
          isGroupChat={false}
          totalRecipients={1}
        />
      </Wrapper>
    );

    expect(screen.getByText('mercredi 10 janvier 2024')).toBeInTheDocument();
    expect(screen.getByText('jeudi 11 janvier 2024')).toBeInTheDocument();

    expect(screen.getByTestId('message-item-m1')).toBeInTheDocument();
    expect(screen.getByTestId('message-item-m2')).toBeInTheDocument();
    expect(screen.getByTestId('message-item-m3')).toBeInTheDocument();

    expect(screen.getByTestId('show-avatar-m1')).toHaveTextContent('true');
    expect(screen.getByTestId('show-avatar-m2')).toHaveTextContent('false');
    expect(screen.getByTestId('show-avatar-m3')).toHaveTextContent('true');

    expect(screen.getByTestId('receipt-m1')).toHaveTextContent('read');
    expect(screen.getByTestId('receipt-m2')).toHaveTextContent('read');
    expect(screen.getByTestId('receipt-m3')).toHaveTextContent('undefined');

    expect(screen.getByText('Lu par 3/5')).toBeInTheDocument();
    expect(screen.getByText('Lu par 4/5')).toBeInTheDocument();

    const joinButton = screen.getByRole('button', { name: /rejoindre la visio/i });
    fireEvent.click(joinButton);

    expect(mockOnJoinVisio).toHaveBeenCalledTimes(1);
    expect(mockOnJoinVisio).toHaveBeenCalledWith('room-42');

    expect(mockGetMessageReceiptStatus).toHaveBeenNthCalledWith(1, 'm1', 'u1', true);
    expect(mockGetMessageReceiptStatus).toHaveBeenNthCalledWith(2, 'm2', 'u1', true);
    expect(mockGetMessageReceiptStatus).toHaveBeenNthCalledWith(3, 'm3', 'u2', false);

    expect(mockScrollToIndex).toHaveBeenCalledWith(4, { align: 'end' });

    expect(capturedMessageItemProps).toEqual([
      expect.objectContaining({
        message: expect.objectContaining({ id: 'm1' }),
        conversationId: 'conv-1',
        showAvatar: true,
        receiptStatus: 'read',
        isGroupChat: true,
        readByCount: 3,
        totalRecipients: 5,
      }),
      expect.objectContaining({
        message: expect.objectContaining({ id: 'm2' }),
        conversationId: 'conv-1',
        showAvatar: false,
        receiptStatus: 'read',
        isGroupChat: true,
        readByCount: 4,
        totalRecipients: 5,
      }),
      expect.objectContaining({
        message: expect.objectContaining({ id: 'm3' }),
        conversationId: 'conv-1',
        showAvatar: true,
        receiptStatus: undefined,
        isGroupChat: true,
        readByCount: 0,
        totalRecipients: 1,
      }),
    ]);
  });

  it('prend en compte isGroupChat passé en prop même si le hook le retourne faux', () => {
    mockUsePulseMessageReceipts.mockReturnValue({
      getMessageReceiptStatus: mockGetMessageReceiptStatus,
      isGroupChat: false,
    });

    const messages = [
      {
        id: 'm1',
        content: 'hello',
        created_at: '2024-01-10T10:00:00.000Z',
        user_id: 'u1',
      },
    ];

    render(
      <Wrapper>
        <VirtualizedMessageList messages={messages} conversationId="conv-2" isGroupChat totalRecipients={8} />
      </Wrapper>
    );

    expect(screen.getByTestId('group-m1')).toHaveTextContent('true');
    expect(screen.getByText('Lu par 3/5')).toBeInTheDocument();
  });
});