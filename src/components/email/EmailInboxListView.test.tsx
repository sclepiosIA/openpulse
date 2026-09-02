import { render, screen, fireEvent } from "@testing-library/react";
vi.mock('./folders/MoveToFolderDialog', () => ({
  MoveToFolderDialog: () => null,
}));

import { EmailInboxListView } from "./EmailInboxListView";

const {
  THREADS,
  NEW_THREAD_IDS,
  ENRICHED_DATA_MAP,
  MOCK_ACTION_HANDLERS,
  mockUpdateThreadPriority,
  mockSetSelectedThreads,
  mockOnThreadSelect,
  mockHandleToggleReadThread,
  mockHandleArchiveThread,
  mockHandleDeleteThread,
  mockHandleEnterMultiSelect,
  mockHandleSelectAll,
  mockHandleRefreshPull,
  mockOptimisticUpdateThread,
} = vi.hoisted(() => {
  const threads = [
    { id: "t1", subject: "Subject 1" },
    { id: "t2", subject: "Subject 2" },
  ];

  const newThreadIds = new Set<string>(["t2"]);

  const enrichedDataMap = new Map<string, unknown>([
    ["t1", { extra: "data1" }],
    ["t2", { extra: "data2" }],
  ]);

  const mockUpdateThreadPriorityFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSetSelectedThreadsFn = vi.fn();
  const mockOnThreadSelectFn = vi.fn();
  const mockHandleToggleReadThreadFn = vi.fn();
  const mockHandleArchiveThreadFn = vi.fn();
  const mockHandleDeleteThreadFn = vi.fn();
  const mockHandleEnterMultiSelectFn = vi.fn();
  const mockHandleSelectAllFn = vi.fn();
  const mockHandleRefreshPullFn = vi.fn().mockResolvedValue(undefined);
  const mockOptimisticUpdateThreadFn = vi.fn();

  const mockActionHandlersObj = {
    onMarkAsProcessed: vi.fn(),
    onMarkAsSpam: vi.fn(),
  };

  return {
    THREADS: threads,
    NEW_THREAD_IDS: newThreadIds,
    ENRICHED_DATA_MAP: enrichedDataMap,
    MOCK_ACTION_HANDLERS: mockActionHandlersObj,
    mockUpdateThreadPriority: mockUpdateThreadPriorityFn,
    mockSetSelectedThreads: mockSetSelectedThreadsFn,
    mockOnThreadSelect: mockOnThreadSelectFn,
    mockHandleToggleReadThread: mockHandleToggleReadThreadFn,
    mockHandleArchiveThread: mockHandleArchiveThreadFn,
    mockHandleDeleteThread: mockHandleDeleteThreadFn,
    mockHandleEnterMultiSelect: mockHandleEnterMultiSelectFn,
    mockHandleSelectAll: mockHandleSelectAllFn,
    mockHandleRefreshPull: mockHandleRefreshPullFn,
    mockOptimisticUpdateThread: mockOptimisticUpdateThreadFn,
  };
});

vi.mock("@/components/ui/card", () => {
  const Card = ({ children, ...rest }: { children: React.ReactNode }) => (
    <div data-testid="card" {...rest}>
      {children}
    </div>
  );
  return { Card };
});

vi.mock("./VirtualizedThreadList", () => {
  const VirtualizedThreadList = ({
    threads,
    onSelect,
    onThreadSelect,
  }: {
    threads: { id: string; subject: string }[];
    onSelect: (id: string, selected: boolean) => void;
    onThreadSelect: (id: string, subject?: string) => void;
  }) => (
    <div data-testid="virtualized-thread-list">
      {threads.map((t) => (
        <div key={t.id}>
          <span>{t.subject}</span>
          <button
            type="button"
            onClick={() => onSelect(t.id, true)}
            data-testid={`select-${t.id}`}
          >
            select
          </button>
          <button
            type="button"
            onClick={() => onThreadSelect(t.id, t.subject)}
            data-testid={`open-${t.id}`}
          >
            open
          </button>
        </div>
      ))}
    </div>
  );
  return { VirtualizedThreadList };
});

vi.mock("./MobileEmailListItem", () => {
  const MobileEmailListItem = ({
    thread,
    selected,
    isNew,
    onSelect,
    onClick,
    onToggleRead,
    onArchive,
    onDelete,
    onEnterMultiSelect,
    onMarkAsProcessed,
    onMarkAsSpam,
    onToggleStar,
  }: any) => (
    <div
      data-testid={`mobile-item-${thread.id}`}
      data-selected={selected ? "true" : "false"}
      data-is-new={isNew ? "true" : "false"}
    >
      <span>{thread.subject}</span>
      <button
        type="button"
        onClick={() => onClick()}
        data-testid={`mobile-open-${thread.id}`}
      >
        open
      </button>
      <button
        type="button"
        onClick={() => onToggleRead(thread.id)}
        data-testid={`mobile-toggle-read-${thread.id}`}
      >
        toggle-read
      </button>
      <button
        type="button"
        onClick={() => onArchive(thread.id)}
        data-testid={`mobile-archive-${thread.id}`}
      >
        archive
      </button>
      <button
        type="button"
        onClick={() => onDelete(thread.id)}
        data-testid={`mobile-delete-${thread.id}`}
      >
        delete
      </button>
      <button
        type="button"
        onClick={() => onEnterMultiSelect(thread.id)}
        data-testid={`mobile-enter-multi-${thread.id}`}
      >
        multi
      </button>
      <button
        type="button"
        onClick={() => onMarkAsProcessed(thread.id)}
        data-testid={`mobile-processed-${thread.id}`}
      >
        processed
      </button>
      <button
        type="button"
        onClick={() => onMarkAsSpam(thread.id)}
        data-testid={`mobile-spam-${thread.id}`}
      >
        spam
      </button>
      <button
        type="button"
        onClick={() => onToggleStar(thread.id, true)}
        data-testid={`mobile-star-${thread.id}`}
      >
        star
      </button>
      <button
        type="button"
        onClick={() => onToggleStar(thread.id, false)}
        data-testid={`mobile-unstar-${thread.id}`}
      >
        unstar
      </button>
      {onSelect && (
        <>
          <button
            type="button"
            onClick={() => onSelect(true)}
            data-testid={`mobile-select-${thread.id}`}
          >
            select
          </button>
          <button
            type="button"
            onClick={() => onSelect(false)}
            data-testid={`mobile-unselect-${thread.id}`}
          >
            unselect
          </button>
        </>
      )}
    </div>
  );
  return { MobileEmailListItem };
});

vi.mock("@/components/mobile/PullToRefresh", () => {
  const PullToRefresh = ({
    children,
    onRefresh,
  }: {
    children: React.ReactNode;
    onRefresh: () => Promise<void>;
  }) => (
    <div data-testid="pull-to-refresh">
      <button
        type="button"
        onClick={() => {
          void onRefresh();
        }}
        data-testid="pull-refresh-button"
      >
        refresh
      </button>
      {children}
    </div>
  );
  return { PullToRefresh };
});

vi.mock("@/services/email/emailThreadMutations", () => ({
  updateThreadPriority: (...args: unknown[]) => mockUpdateThreadPriority(...args),
}));

describe("EmailInboxListView", () => {
  it("renders desktop view with selection header and virtualized list", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>(["t1"]);

    render(
      <EmailInboxListView
        isMobile={false}
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode={false}
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("virtualized-thread-list")).toBeInTheDocument();
    expect(screen.getByText("Subject 1")).toBeInTheDocument();
    expect(screen.getByText("Subject 2")).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("1 sélectionné")).toBeInTheDocument();
  });

  it("triggers handleSelectAll when desktop checkbox is changed", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>();

    render(
      <EmailInboxListView
        isMobile={false}
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode={false}
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(mockHandleSelectAll).toHaveBeenCalledTimes(1);
  });

  it("calls setSelectedThreads and onThreadSelect via VirtualizedThreadList handlers", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>();

    render(
      <EmailInboxListView
        isMobile={false}
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode={false}
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    fireEvent.click(screen.getByTestId("select-t1"));
    expect(mockSetSelectedThreads).toHaveBeenCalledTimes(1);
    const newSetArg = mockSetSelectedThreads.mock.calls[0][0] as Set<string>;
    expect(newSetArg.has("t1")).toBe(true);

    fireEvent.click(screen.getByTestId("open-t2"));
    expect(mockOnThreadSelect).toHaveBeenCalledWith("t2", "Subject 2");
  });

  it("renders mobile view with MobileEmailListItem and pull-to-refresh", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>(["t1"]);

    render(
      <EmailInboxListView
        isMobile
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode={false}
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    expect(screen.getByTestId("pull-to-refresh")).toBeInTheDocument();
    const item1 = screen.getByTestId("mobile-item-t1");
    const item2 = screen.getByTestId("mobile-item-t2");
    expect(item1).toBeInTheDocument();
    expect(item2).toBeInTheDocument();
    expect(item1.getAttribute("data-selected")).toBe("true");
    expect(item2.getAttribute("data-selected")).toBe("false");
    expect(item1.getAttribute("data-is-new")).toBe("false");
    expect(item2.getAttribute("data-is-new")).toBe("true");
  });

  it("triggers refresh handler via PullToRefresh", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>();

    render(
      <EmailInboxListView
        isMobile
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode={false}
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    fireEvent.click(screen.getByTestId("pull-refresh-button"));
    expect(mockHandleRefreshPull).toHaveBeenCalledTimes(1);
  });

  it("calls onThreadSelect and other handlers from MobileEmailListItem in non-multi-select mode", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>();

    render(
      <EmailInboxListView
        isMobile
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode={false}
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    fireEvent.click(screen.getByTestId("mobile-open-t1"));
    expect(mockOnThreadSelect).toHaveBeenCalledWith("t1", "Subject 1");

    fireEvent.click(screen.getByTestId("mobile-toggle-read-t1"));
    expect(mockHandleToggleReadThread).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByTestId("mobile-archive-t1"));
    expect(mockHandleArchiveThread).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByTestId("mobile-delete-t1"));
    expect(mockHandleDeleteThread).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByTestId("mobile-enter-multi-t1"));
    expect(mockHandleEnterMultiSelect).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByTestId("mobile-processed-t1"));
    expect(MOCK_ACTION_HANDLERS.onMarkAsProcessed).toHaveBeenCalledWith("t1");

    fireEvent.click(screen.getByTestId("mobile-spam-t1"));
    expect(MOCK_ACTION_HANDLERS.onMarkAsSpam).toHaveBeenCalledWith("t1");
  });

  it("allows selecting and unselecting in mobile multi-select mode using onSelect", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>(["t2"]);
    mockSetSelectedThreads.mockClear();

    render(
      <EmailInboxListView
        isMobile
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    fireEvent.click(screen.getByTestId("mobile-select-t1"));
    const firstCall = mockSetSelectedThreads.mock.calls[0][0] as Set<string>;
    expect(firstCall.has("t1")).toBe(true);
    expect(firstCall.has("t2")).toBe(true);

    fireEvent.click(screen.getByTestId("mobile-unselect-t2"));
    const secondCall = mockSetSelectedThreads.mock.calls[1][0] as Set<string>;
    expect(secondCall.has("t2")).toBe(false);
  });

  it("invokes optimisticUpdateThread and updateThreadPriority when starring and unstarring", () => {
    const parentRef = { current: null } as React.RefObject<HTMLDivElement>;
    const selectedThreads = new Set<string>();
    mockOptimisticUpdateThread.mockClear();
    mockUpdateThreadPriority.mockClear();

    render(
      <EmailInboxListView
        isMobile
        threads={THREADS}
        selectedThreads={selectedThreads}
        setSelectedThreads={mockSetSelectedThreads}
        newThreadIds={NEW_THREAD_IDS}
        enrichedData={ENRICHED_DATA_MAP}
        actionHandlers={MOCK_ACTION_HANDLERS}
        multiSelectMode={false}
        parentRef={parentRef}
        onThreadSelect={mockOnThreadSelect}
        handleToggleReadThread={mockHandleToggleReadThread}
        handleArchiveThread={mockHandleArchiveThread}
        handleDeleteThread={mockHandleDeleteThread}
        handleEnterMultiSelect={mockHandleEnterMultiSelect}
        handleSelectAll={mockHandleSelectAll}
        handleRefreshPull={mockHandleRefreshPull}
        optimisticUpdateThread={mockOptimisticUpdateThread}
      />
    );

    fireEvent.click(screen.getByTestId("mobile-star-t1"));
    expect(mockOptimisticUpdateThread).toHaveBeenCalledWith("t1", { priority: "medium" });
    expect(mockUpdateThreadPriority).toHaveBeenCalledWith("t1", "medium");

    fireEvent.click(screen.getByTestId("mobile-unstar-t1"));
    expect(mockOptimisticUpdateThread).toHaveBeenCalledWith("t1", { priority: "high" });
    expect(mockUpdateThreadPriority).toHaveBeenCalledWith("t1", "high");
  });
});