import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageList } from './MessageList';

vi.mock('lucide-react', () => ({
  Video: (props: { className?: string }) => <svg data-testid="video-icon" {...props} />,
}));

const {
  mockUsePulseMessageReceipts,
  mockUseCurrentProfile,
  baseMessages,
  groupMessages,
  virtualizedMessages,
} = vi.hoisted(() => {
  const mockGetMessageReceiptStatus = vi.fn();
  const mockUsePulseMessageReceipts = vi.fn(() => ({
    getMessageReceiptStatus: mockGetMessageReceiptStatus,
    isGroupChat: false,
  }));

  const mockUseCurrentProfile = vi.fn(() => ({
    data: { id: 'user-1', name: 'John Doe' },
  }));

  const baseMessages = [
    {
      id: 'm1',
      user_id: 'user-1',
      content: 'Hello world',
      created_at: new Date('2023-01-01T10:00:00.000Z').toISOString(),
    },
    {
      id: 'm2',
      user_id: 'user-2',
      content: 'Reply from user 2',
      created_at: new Date('2023-01-01T10:02:00.000Z').toISOString(),
    },
  ] as const;

  const groupMessages = [
    {
      id: 'g1',
      user_id: 'user-1',
      content: 'First day message',
      created_at: new Date('2023-01-01T09:00:00.000Z').toISOString(),
    },
    {
      id: 'g2',
      user_id: 'user-2',
      content: 'Second day message',
      created_at: new Date('2023-01-02T11:00:00.000Z').toISOString(),
    },
  ] as const;

  const virtualizedMessages = Array.from({ length: 60 }).map((_, index) => ({
    id: `v-${index}`,
    user_id: index % 2 === 0 ? 'user-1' : 'user-2',
    content: `Message ${index}`,
    created_at: new Date(2023, 0, 1, 10, index).toISOString(),
  }));

  return {
    mockUsePulseMessageReceipts,
    mockUseCurrentProfile,
    baseMessages,
    groupMessages,
    virtualizedMessages,
  };
});

vi.mock('@/hooks/pulse/usePulseMessageReceipts', () => ({
  usePulseMessageReceipts: (conversationId: string) =>
    mockUsePulseMessageReceipts(conversationId),
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => mockUseCurrentProfile(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => (
    <button {...props} />
  ),
}));

const { mockMessageItem } = vi.hoisted(() => {
  const mockMessageItem = vi.fn(
    (props: {
      message: { id: string; content: string };
      conversationId: string;
      showAvatar: boolean;
      onOpenThread: () => void;
      receiptStatus?: string;
      isGroupChat: boolean;
      readByCount: number;
      totalRecipients: number;
    }) => (
      <div data-testid={`message-item-${props.message.id}`}>
        <span>{props.message.content}</span>
        <button
          type="button"
          onClick={props.onOpenThread}
          data-testid={`open-thread-${props.message.id}`}
        >
          open-thread
        </button>
        {props.receiptStatus && (
          <span data-testid={`receipt-${props.message.id}`}>{props.receiptStatus}</span>
        )}
        {props.receiptStatus === 'read' && (
          <span>{props.isGroupChat ? `Lu par ${props.readByCount}/${props.totalRecipients}` : 'Lu'}</span>
        )}
      </div>
    )
  );
  return { mockMessageItem };
});

vi.mock('./MessageItem', () => ({
  MessageItem: (props: any) => mockMessageItem(props),
}));

const { mockThreadView } = vi.hoisted(() => {
  const mockThreadView = vi.fn(
    (props: {
      parentMessage: { id: string };
      conversationId: string;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) =>
      props.open ? (
        <div data-testid="thread-view">
          <span>Thread for {props.parentMessage.id}</span>
          <button
            type="button"
            onClick={() => props.onOpenChange(false)}
            data-testid="close-thread"
          >
            close
          </button>
        </div>
      ) : null
  );
  return { mockThreadView };
});

vi.mock('./ThreadView', () => ({
  ThreadView: (props: any) => mockThreadView(props),
}));

const { mockVirtualizedMessageList } = vi.hoisted(() => {
  const mockVirtualizedMessageList = vi.fn(
    (props: {
      messages: Array<{ id: string; content: string }>;
      conversationId: string;
      onJoinVisio?: (roomCode: string) => void;
      isGroupChat: boolean;
      totalRecipients: number;
    }) => (
      <div data-testid="virtualized-list">
        {props.messages.map((m) => (
          <div key={m.id}>{m.content}</div>
        ))}
      </div>
    )
  );
  return { mockVirtualizedMessageList };
});

vi.mock('./VirtualizedMessageList', () => ({
  VirtualizedMessageList: (props: any) => mockVirtualizedMessageList(props),
}));

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePulseMessageReceipts.mockImplementation((conversationId: string) => ({
      getMessageReceiptStatus: vi.fn(() => ({
        status: 'read',
        readCount: 1,
        totalRecipients: 2,
      })),
      isGroupChat: false,
    }));
  });

  it('renders empty state when there are no messages', () => {
    render(
      <MessageList
        messages={[]}
        conversationId="conv-1"
      />
    );

    expect(screen.getByText('Aucun message')).toBeInTheDocument();
    expect(
      screen.getByText('Soyez le premier à envoyer un message !')
    ).toBeInTheDocument();
  });

  it('groups messages by date and renders date dividers', () => {
    render(
      <MessageList
        messages={groupMessages as unknown as any[]}
        conversationId="conv-1"
      />
    );

    expect(screen.getByText('First day message')).toBeInTheDocument();
    expect(screen.getByText('Second day message')).toBeInTheDocument();

    expect(screen.getAllByText(/2023/).length).toBeGreaterThanOrEqual(1);
  });

  it('passes correct props to MessageItem including receipt infos for own messages', () => {
    const mockGetMessageReceiptStatus = vi.fn((messageId: string) => {
      if (messageId === 'm1') {
        return { status: 'read', readCount: 3, totalRecipients: 5 };
      }
      return { status: 'sent', readCount: 0, totalRecipients: 5 };
    });

    mockUsePulseMessageReceipts.mockReturnValue({
      getMessageReceiptStatus: mockGetMessageReceiptStatus,
      isGroupChat: true,
    });

    render(
      <MessageList
        messages={baseMessages as unknown as any[]}
        conversationId="conv-1"
        isGroupChat
        totalRecipients={5}
      />
    );

    expect(mockMessageItem).toHaveBeenCalled();

    const firstCall = mockMessageItem.mock.calls.find(
      (call) => call[0].message.id === 'm1'
    )?.[0];
    const secondCall = mockMessageItem.mock.calls.find(
      (call) => call[0].message.id === 'm2'
    )?.[0];

    expect(firstCall).toMatchObject({
      message: expect.objectContaining({ id: 'm1', content: 'Hello world' }),
      conversationId: 'conv-1',
      isGroupChat: true,
      readByCount: 3,
      totalRecipients: 5,
      receiptStatus: 'read',
    });

    expect(secondCall).toMatchObject({
      message: expect.objectContaining({ id: 'm2', content: 'Reply from user 2' }),
      conversationId: 'conv-1',
      isGroupChat: true,
      readByCount: 0,
      totalRecipients: 5,
      receiptStatus: undefined,
    });

    expect(screen.getByText('Lu par 3/5')).toBeInTheDocument();
  });

  it('shows simple "Lu" text for non group chat when last own message is read', () => {
    const mockGetMessageReceiptStatus = vi.fn(() => ({
      status: 'read',
      readCount: 1,
      totalRecipients: 1,
    }));

    mockUsePulseMessageReceipts.mockReturnValue({
      getMessageReceiptStatus: mockGetMessageReceiptStatus,
      isGroupChat: false,
    });

    render(
      <MessageList
        messages={baseMessages as unknown as any[]}
        conversationId="conv-2"
        isGroupChat={false}
        totalRecipients={1}
      />
    );

    expect(screen.getByText('Lu')).toBeInTheDocument();
  });

  it('uses hook isGroupChat when isGroupChat prop is not provided', () => {
    mockUsePulseMessageReceipts.mockReturnValue({
      getMessageReceiptStatus: vi.fn(() => ({
        status: 'read',
        readCount: 2,
        totalRecipients: 3,
      })),
      isGroupChat: true,
    });

    render(
      <MessageList
        messages={baseMessages as unknown as any[]}
        conversationId="conv-3"
      />
    );

    const ownCall = mockMessageItem.mock.calls.find(
      (call) => call[0].message.id === 'm1'
    )?.[0];

    expect(ownCall?.isGroupChat).toBe(true);
    expect(screen.getByText('Lu par 2/3')).toBeInTheDocument();
  });

  it('uses virtualization when messages length exceeds threshold', () => {
    render(
      <MessageList
        messages={virtualizedMessages as unknown as any[]}
        conversationId="conv-4"
      />
    );

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    const call = mockVirtualizedMessageList.mock.calls[0][0];
    expect(call).toMatchObject({
      conversationId: 'conv-4',
      isGroupChat: false,
      totalRecipients: 1,
    });
    expect(call.messages).toEqual(virtualizedMessages);
    expect(mockMessageItem).not.toHaveBeenCalled();
  });

  it('opens and closes ThreadView when a thread is selected', () => {
    render(
      <MessageList
        messages={baseMessages as unknown as any[]}
        conversationId="conv-5"
      />
    );

    fireEvent.click(screen.getByTestId('open-thread-m1'));

    expect(mockThreadView).toHaveBeenCalled();
    expect(screen.getByTestId('thread-view')).toBeInTheDocument();
    expect(screen.getByText('Thread for m1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-thread'));

    expect(screen.queryByTestId('thread-view')).not.toBeInTheDocument();
  });

  it('renders join visio button and calls onJoinVisio with extracted room code', () => {
    const visioMessages = [
      {
        id: 'vm1',
        user_id: 'user-2',
        content:
          '📹 Visio OpenPulse Meet démarrée : https://example.com/visio/room-123',
        created_at: new Date('2023-01-03T10:00:00.000Z').toISOString(),
      },
    ];

    const onJoinVisio = vi.fn();

    render(
      <MessageList
        messages={visioMessages as unknown as any[]}
        conversationId="conv-6"
        onJoinVisio={onJoinVisio}
      />
    );

    const joinButton = screen.getByRole('button', { name: /Rejoindre la visio/i });
    expect(joinButton).toBeInTheDocument();

    fireEvent.click(joinButton);

    expect(onJoinVisio).toHaveBeenCalledWith('room-123');
  });

  it('does not render join visio button when onJoinVisio is not provided', () => {
    const visioMessages = [
      {
        id: 'vm2',
        user_id: 'user-2',
        content:
          '📹 Visio OpenPulse Meet démarrée : https://example.com/visio/room-456',
        created_at: new Date('2023-01-03T10:00:00.000Z').toISOString(),
      },
    ];

    render(
      <MessageList
        messages={visioMessages as unknown as any[]}
        conversationId="conv-7"
      />
    );

    expect(
      screen.queryByRole('button', { name: /Rejoindre la visio/i })
    ).not.toBeInTheDocument();
  });

  it('shows avatar change when user or time gap changes', () => {
    const avatarMessages = [
      {
        id: 'a1',
        user_id: 'user-1',
        content: 'First from user 1',
        created_at: new Date('2023-01-01T10:00:00.000Z').toISOString(),
      },
      {
        id: 'a2',
        user_id: 'user-1',
        content: 'Second from user 1 quickly',
        created_at: new Date('2023-01-01T10:02:00.000Z').toISOString(),
      },
      {
        id: 'a3',
        user_id: 'user-1',
        content: 'Third from user 1 later',
        created_at: new Date('2023-01-01T10:10:00.000Z').toISOString(),
      },
      {
        id: 'a4',
        user_id: 'user-2',
        content: 'From user 2',
        created_at: new Date('2023-01-01T10:12:00.000Z').toISOString(),
      },
    ];

    render(
      <MessageList
        messages={avatarMessages as unknown as any[]}
        conversationId="conv-8"
      />
    );

    const callA1 = mockMessageItem.mock.calls.find(
      (call) => call[0].message.id === 'a1'
    )?.[0];
    const callA2 = mockMessageItem.mock.calls.find(
      (call) => call[0].message.id === 'a2'
    )?.[0];
    const callA3 = mockMessageItem.mock.calls.find(
      (call) => call[0].message.id === 'a3'
    )?.[0];
    const callA4 = mockMessageItem.mock.calls.find(
      (call) => call[0].message.id === 'a4'
    )?.[0];

    expect(callA1?.showAvatar).toBe(true);
    expect(callA2?.showAvatar).toBe(false);
    expect(callA3?.showAvatar).toBe(true);
    expect(callA4?.showAvatar).toBe(true);
  });
});