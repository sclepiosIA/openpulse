import React, { RefObject } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VirtualizedThreadList } from './VirtualizedThreadList';

const { MOCK_DATA } = vi.hoisted(() => {
  const threads = [
    { id: 't1', subject: 'Thread 1 subject' },
    { id: 't2', subject: 'Thread 2 subject' },
    { id: 't3', subject: 'Thread 3 subject' },
  ];

  const enrichedMap = new Map<string, unknown>();
  enrichedMap.set('t1', { unreadCount: 1, lastMessageSnippet: 'Snippet 1' });
  enrichedMap.set('t2', { unreadCount: 2, lastMessageSnippet: 'Snippet 2' });

  const selectedThreads = new Set<string>(['t2']);
  const newThreadIds = new Set<string>(['t1']);

  const onSelect = vi.fn();
  const onThreadSelect = vi.fn();

  const EmailListItemModernMock = vi.fn(
    ({
      thread,
      selected,
      isNew,
      enrichedData,
      actionHandlers,
      onSelect: onSelectItem,
      onClick,
    }: {
      thread: { id: string; subject?: string };
      selected: boolean;
      isNew: boolean;
      enrichedData?: unknown;
      actionHandlers?: unknown;
      onSelect: (selected: boolean) => void;
      onClick: () => void;
    }) => {
      return (
        <div
          data-testid={`email-item-${thread.id}`}
          data-selected={selected ? 'true' : 'false'}
          data-is-new={isNew ? 'true' : 'false'}
          data-enriched={enrichedData ? 'true' : 'false'}
          onClick={() => {
            onClick();
          }}
        >
          <button
            type="button"
            data-testid={`select-${thread.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectItem(!selected);
            }}
          >
            toggle-select
          </button>
          <span>{thread.subject}</span>
        </div>
      );
    }
  );

  const virtualItems = [
    {
      key: '0',
      index: 0,
      size: 72,
      start: 0,
    },
    {
      key: '1',
      index: 1,
      size: 72,
      start: 72,
    },
    {
      key: '2',
      index: 2,
      size: 72,
      start: 144,
    },
  ];

  const useVirtualizerMock = vi.fn(() => ({
    getTotalSize: () => 216,
    getVirtualItems: () => virtualItems,
  }));

  return {
    MOCK_DATA: {
      threads,
      enrichedMap,
      selectedThreads,
      newThreadIds,
      onSelect,
      onThreadSelect,
      EmailListItemModernMock,
      useVirtualizerMock,
    },
  };
});

vi.mock('@tanstack/react-virtual', () => {
  return {
    useVirtualizer: MOCK_DATA.useVirtualizerMock,
  };
});

vi.mock('./EmailListItemModern', () => {
  return {
    EmailListItemModern: MOCK_DATA.EmailListItemModernMock,
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>
  );
}

describe('VirtualizedThreadList', () => {
  it('renders virtualized items with correct props and layout', () => {
    const parentDiv = document.createElement('div');
    document.body.appendChild(parentDiv);

    const parentRef: RefObject<HTMLDivElement> = { current: parentDiv };

    const { threads, enrichedMap, selectedThreads, newThreadIds, onSelect, onThreadSelect } =
      MOCK_DATA;

    const { getByTestId } = renderWithClient(
      <VirtualizedThreadList
        threads={threads}
        parentRef={parentRef}
        selectedThreads={selectedThreads}
        newThreadIds={newThreadIds}
        enrichedData={enrichedMap as Map<string, unknown>}
        actionHandlers={undefined}
        onSelect={onSelect}
        onThreadSelect={onThreadSelect}
      />
    );

    const item0 = getByTestId('email-item-t1');
    const item1 = getByTestId('email-item-t2');
    const item2 = getByTestId('email-item-t3');

    expect(item0.getAttribute('data-selected')).toBe('false');
    expect(item0.getAttribute('data-is-new')).toBe('true');
    expect(item0.getAttribute('data-enriched')).toBe('true');

    expect(item1.getAttribute('data-selected')).toBe('true');
    expect(item1.getAttribute('data-is-new')).toBe('false');
    expect(item1.getAttribute('data-enriched')).toBe('true');

    expect(item2.getAttribute('data-selected')).toBe('false');
    expect(item2.getAttribute('data-is-new')).toBe('false');
    expect(item2.getAttribute('data-enriched')).toBe('false');

    expect(MOCK_DATA.EmailListItemModernMock).toHaveBeenCalledTimes(3);

    const calls = (MOCK_DATA.EmailListItemModernMock as unknown as { mock: { calls: unknown[][] } })
      .mock.calls;

    expect(calls[0][0].thread.id).toBe('t1');
    expect(calls[1][0].thread.id).toBe('t2');
    expect(calls[2][0].thread.id).toBe('t3');
  });

  it('uses onSelect callback with correct arguments when selection toggled', () => {
    const parentDiv = document.createElement('div');
    document.body.appendChild(parentDiv);
    const parentRef: RefObject<HTMLDivElement> = { current: parentDiv };

    const { threads, enrichedMap, selectedThreads, newThreadIds, onSelect, onThreadSelect } =
      MOCK_DATA;

    const { getByTestId } = renderWithClient(
      <VirtualizedThreadList
        threads={threads}
        parentRef={parentRef}
        selectedThreads={selectedThreads}
        newThreadIds={newThreadIds}
        enrichedData={enrichedMap as Map<string, unknown>}
        actionHandlers={undefined}
        onSelect={onSelect}
        onThreadSelect={onThreadSelect}
      />
    );

    const selectButtonT1 = getByTestId('select-t1');
    const selectButtonT2 = getByTestId('select-t2');

    fireEvent.click(selectButtonT1);
    fireEvent.click(selectButtonT2);

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, 't1', true);
    expect(onSelect).toHaveBeenNthCalledWith(2, 't2', false);
  });

  it('uses onThreadSelect callback with correct arguments when item clicked', () => {
    const parentDiv = document.createElement('div');
    document.body.appendChild(parentDiv);
    const parentRef: RefObject<HTMLDivElement> = { current: parentDiv };

    const { threads, enrichedMap, selectedThreads, newThreadIds, onSelect, onThreadSelect } =
      MOCK_DATA;

    const { getByTestId } = renderWithClient(
      <VirtualizedThreadList
        threads={threads}
        parentRef={parentRef}
        selectedThreads={selectedThreads}
        newThreadIds={newThreadIds}
        enrichedData={enrichedMap as Map<string, unknown>}
        actionHandlers={undefined}
        onSelect={onSelect}
        onThreadSelect={onThreadSelect}
      />
    );

    const item0 = getByTestId('email-item-t1');
    const item2 = getByTestId('email-item-t3');

    fireEvent.click(item0);
    fireEvent.click(item2);

    expect(onThreadSelect).toHaveBeenCalledTimes(2);
    expect(onThreadSelect).toHaveBeenNthCalledWith(1, 't1', 'Thread 1 subject');
    expect(onThreadSelect).toHaveBeenNthCalledWith(2, 't3', 'Thread 3 subject');
  });
});