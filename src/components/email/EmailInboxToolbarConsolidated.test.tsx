// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailInboxToolbarConsolidated } from "./EmailInboxToolbarConsolidated";

const {
  lastSyncIndicatorProps,
  selectState,
} = vi.hoisted(() => ({
  lastSyncIndicatorProps: vi.fn(),
  selectState: {
    onValueChange: undefined as undefined | ((value: string) => void),
    value: "all",
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ariaLabel,
    "aria-label": ariaLabelProp,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ariaLabel?: string }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabelProp ?? ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => <span data-testid="badge" className={className}>{children}</span>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => {
    selectState.value = value ?? "all";
    selectState.onValueChange = onValueChange;
    return <div data-testid="select-root">{children}</div>;
  },
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" data-testid="select-trigger" className={className}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <button
      type="button"
      data-testid={`select-item-${value}`}
      onClick={() => selectState.onValueChange?.(value)}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Search: Icon,
    Plus: Icon,
    RefreshCw: Icon,
    ArrowUpDown: Icon,
    X: Icon,
    Mail: Icon,
    MailOpen: Icon,
    RotateCcw: Icon,
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("./LastSyncIndicator", () => ({
  LastSyncIndicator: ({ lastSyncAt }: { lastSyncAt: string | null }) => {
    lastSyncIndicatorProps(lastSyncAt);
    return <div data-testid="last-sync-indicator">{lastSyncAt ?? "none"}</div>;
  },
}));

describe("EmailInboxToolbarConsolidated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectState.onValueChange = undefined;
    selectState.value = "all";
  });

  it("affiche les statistiques, la recherche et les actions principales", () => {
    const onSearchChange = vi.fn();
    const onUnreadOnlyChange = vi.fn();
    const onCategoryChange = vi.fn();
    const onSortOrderChange = vi.fn();
    const onSync = vi.fn();
    const onCompose = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <EmailInboxToolbarConsolidated
        searchValue=""
        onSearchChange={onSearchChange}
        unreadOnly={false}
        onUnreadOnlyChange={onUnreadOnlyChange}
        category={null}
        onCategoryChange={onCategoryChange}
        sortOrder="desc"
        onSortOrderChange={onSortOrderChange}
        totalCount={3}
        unreadCount={2}
        onSync={onSync}
        onCompose={onCompose}
        onResetFilters={onResetFilters}
        isSyncing={false}
        hasActiveFilters={false}
        lastSyncAt="2024-01-10T08:00:00.000Z"
        prefixSlot={<div data-testid="prefix-slot">Préfixe</div>}
      />
    );

    expect(screen.getByTestId("prefix-slot")).toHaveTextContent("Préfixe");
    expect(screen.getByText("3 conversations")).toBeInTheDocument();
    expect(screen.getByText("2 non lus")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Rechercher dans les emails...")).toHaveValue("");
    expect(screen.getByTestId("last-sync-indicator")).toHaveTextContent("2024-01-10T08:00:00.000Z");
    expect(lastSyncIndicatorProps).toHaveBeenCalledWith("2024-01-10T08:00:00.000Z");
    expect(screen.getByRole("button", { name: /synchroniser/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nouveau/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /non lus/i })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /plus récent/i })).toBeInTheDocument();
    expect(screen.getByText("3 emails")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /réinitialiser/i })).not.toBeInTheDocument();
  });

  it("déclenche les callbacks métier lors des interactions utilisateur", () => {
    const onSearchChange = vi.fn();
    const onUnreadOnlyChange = vi.fn();
    const onCategoryChange = vi.fn();
    const onSortOrderChange = vi.fn();
    const onSync = vi.fn();
    const onCompose = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <EmailInboxToolbarConsolidated
        searchValue="devis"
        onSearchChange={onSearchChange}
        unreadOnly={false}
        onUnreadOnlyChange={onUnreadOnlyChange}
        category={null}
        onCategoryChange={onCategoryChange}
        sortOrder="desc"
        onSortOrderChange={onSortOrderChange}
        totalCount={5}
        unreadCount={4}
        onSync={onSync}
        onCompose={onCompose}
        onResetFilters={onResetFilters}
        isSyncing={false}
        hasActiveFilters={true}
        lastSyncAt={null}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Rechercher dans les emails..."), {
      target: { value: "support" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("support");

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onSearchChange).toHaveBeenCalledWith("");

    fireEvent.click(screen.getByRole("button", { name: /non lus/i }));
    expect(onUnreadOnlyChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId("select-item-Commercial"));
    expect(onCategoryChange).toHaveBeenCalledWith("Commercial");

    fireEvent.click(screen.getByTestId("select-item-all"));
    expect(onCategoryChange).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: /plus récent/i }));
    expect(onSortOrderChange).toHaveBeenCalledWith("asc");

    fireEvent.click(screen.getByRole("button", { name: /synchroniser/i }));
    expect(onSync).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /nouveau/i }));
    expect(onCompose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /réinitialiser/i }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("gère les états unread actif, tri ascendant, sync désactivée et textes singuliers", () => {
    const onSearchChange = vi.fn();
    const onUnreadOnlyChange = vi.fn();
    const onCategoryChange = vi.fn();
    const onSortOrderChange = vi.fn();
    const onSync = vi.fn();

    render(
      <EmailInboxToolbarConsolidated
        searchValue=""
        onSearchChange={onSearchChange}
        unreadOnly={true}
        onUnreadOnlyChange={onUnreadOnlyChange}
        category="Support"
        onCategoryChange={onCategoryChange}
        sortOrder="asc"
        onSortOrderChange={onSortOrderChange}
        totalCount={1}
        unreadCount={1}
        onSync={onSync}
        isSyncing={true}
        hasActiveFilters={false}
        lastSyncAt={null}
      />
    );

    expect(screen.getByText("1 conversation")).toBeInTheDocument();
    expect(screen.getByText("1 non lu")).toBeInTheDocument();
    expect(screen.getByText("1 email")).toBeInTheDocument();

    const unreadButton = screen.getByRole("button", { name: /non lus/i });
    fireEvent.click(unreadButton);
    expect(onUnreadOnlyChange).toHaveBeenCalledWith(false);

    const sortButton = screen.getByRole("button", { name: /plus ancien/i });
    fireEvent.click(sortButton);
    expect(onSortOrderChange).toHaveBeenCalledWith("desc");

    const syncButton = screen.getByRole("button", { name: /synchroniser/i });
    expect(syncButton).toBeDisabled();
    fireEvent.click(syncButton);
    expect(onSync).not.toHaveBeenCalled();

    expect(screen.queryByRole("button", { name: /nouveau/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("last-sync-indicator")).toHaveTextContent("none");
  });

  it("n'affiche pas le badge global d'emails non lus quand unreadCount vaut 0", () => {
    render(
      <EmailInboxToolbarConsolidated
        searchValue=""
        onSearchChange={vi.fn()}
        unreadOnly={false}
        onUnreadOnlyChange={vi.fn()}
        category={null}
        onCategoryChange={vi.fn()}
        sortOrder="desc"
        onSortOrderChange={vi.fn()}
        totalCount={2}
        unreadCount={0}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByText("2 conversations")).toBeInTheDocument();
    expect(screen.queryByText(/non lu/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /non lus/i })).toBeInTheDocument();
  });
});