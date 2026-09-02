import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook } from "@testing-library/react";
import { EmailInboxToolbar } from "./EmailInboxToolbar";

const {
  STABLE_AUTH,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const resolved = Promise.resolve({ data: [], error: null });

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  };

  return {
    STABLE_AUTH: {
      user: { id: "u1", email: "test@example.com" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFrom: vi.fn(() => chain),
    builder: chain,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => true,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/hooks/shared/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
    "aria-label": ariaLabel,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      aria-label={ariaLabel}
    />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    "aria-label": ariaLabel,
    "aria-keyshortcuts": ariaKeyshortcuts,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    "aria-label"?: string;
    "aria-keyshortcuts"?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      aria-keyshortcuts={ariaKeyshortcuts}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    onClick,
    onKeyDown,
    role,
    tabIndex,
    className,
    "aria-label": ariaLabel,
    "aria-pressed": ariaPressed,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    role?: string;
    tabIndex?: number;
    className?: string;
    "aria-label"?: string;
    "aria-pressed"?: boolean;
    variant?: string;
  }) => (
    <div
      data-variant={variant}
      role={role}
      tabIndex={tabIndex}
      className={className}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <label htmlFor="sort-order-select">Sort order</label>
      <select
        id="sort-order-select"
        aria-label="Sort order"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="desc">Plus récent d'abord</option>
        <option value="asc">Plus ancien d'abord</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  Mail: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  Paperclip: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  Archive: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  ListFilter: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("EmailInboxToolbar", () => {
  it("rend les éléments métier principaux avec les compteurs et l'état initial", () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onUnreadOnlyChange = vi.fn();
    const onWithAttachmentsChange = vi.fn();
    const onArchivedOnlyChange = vi.fn();
    const onCompose = vi.fn();

    render(
      <EmailInboxToolbar
        searchQuery="facture"
        onSearchChange={onSearchChange}
        sortOrder="desc"
        onSortChange={onSortChange}
        showUnreadOnly={true}
        onUnreadOnlyChange={onUnreadOnlyChange}
        showWithAttachmentsOnly={false}
        onWithAttachmentsChange={onWithAttachmentsChange}
        showArchivedOnly={true}
        onArchivedOnlyChange={onArchivedOnlyChange}
        unreadCount={4}
        attachmentCount={2}
        archivedCount={1}
        onCompose={onCompose}
      />,
    );

    expect(screen.getByLabelText("Rechercher dans les emails")).toHaveValue("facture");
    expect(screen.getByRole("button", { name: "Composer un nouvel email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrer les emails non lus (4)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Filtrer les emails avec pièces jointes (2)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Filtrer les emails archivés (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Non lus")).toBeInTheDocument();
    expect(screen.getByText("Avec PJ")).toBeInTheDocument();
    expect(screen.getByText("Archivés")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort order")).toHaveValue("desc");
    expect(onSearchChange).toHaveBeenCalledWith("facture");
  });

  it("propage la recherche mise à jour et déclenche la composition", async () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onUnreadOnlyChange = vi.fn();
    const onWithAttachmentsChange = vi.fn();
    const onArchivedOnlyChange = vi.fn();
    const onCompose = vi.fn();

    render(
      <EmailInboxToolbar
        searchQuery=""
        onSearchChange={onSearchChange}
        sortOrder="desc"
        onSortChange={onSortChange}
        showUnreadOnly={false}
        onUnreadOnlyChange={onUnreadOnlyChange}
        showWithAttachmentsOnly={false}
        onWithAttachmentsChange={onWithAttachmentsChange}
        showArchivedOnly={false}
        onArchivedOnlyChange={onArchivedOnlyChange}
        unreadCount={0}
        attachmentCount={0}
        archivedCount={0}
        onCompose={onCompose}
      />,
    );

    const input = screen.getByLabelText("Rechercher dans les emails");
    fireEvent.change(input, { target: { value: "client urgent" } });

    await waitFor(() => {
      expect(onSearchChange).toHaveBeenLastCalledWith("client urgent");
    });

    fireEvent.click(screen.getByRole("button", { name: "Composer un nouvel email" }));
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it("bascule les filtres au clic et au clavier avec les bonnes valeurs", () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onUnreadOnlyChange = vi.fn();
    const onWithAttachmentsChange = vi.fn();
    const onArchivedOnlyChange = vi.fn();
    const onCompose = vi.fn();

    render(
      <EmailInboxToolbar
        searchQuery=""
        onSearchChange={onSearchChange}
        sortOrder="desc"
        onSortChange={onSortChange}
        showUnreadOnly={false}
        onUnreadOnlyChange={onUnreadOnlyChange}
        showWithAttachmentsOnly={true}
        onWithAttachmentsChange={onWithAttachmentsChange}
        showArchivedOnly={false}
        onArchivedOnlyChange={onArchivedOnlyChange}
        unreadCount={0}
        attachmentCount={3}
        archivedCount={0}
        onCompose={onCompose}
      />,
    );

    const unreadBadge = screen.getByRole("button", { name: "Filtrer les emails non lus" });
    const attachmentBadge = screen.getByRole("button", { name: "Filtrer les emails avec pièces jointes (3)" });
    const archivedBadge = screen.getByRole("button", { name: "Filtrer les emails archivés" });

    fireEvent.click(unreadBadge);
    expect(onUnreadOnlyChange).toHaveBeenCalledWith(true);

    fireEvent.keyDown(attachmentBadge, { key: "Enter" });
    expect(onWithAttachmentsChange).toHaveBeenCalledWith(false);

    fireEvent.keyDown(archivedBadge, { key: " " });
    expect(onArchivedOnlyChange).toHaveBeenCalledWith(true);
  });

  it("change l'ordre de tri avec la valeur métier attendue", () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onUnreadOnlyChange = vi.fn();
    const onWithAttachmentsChange = vi.fn();
    const onArchivedOnlyChange = vi.fn();
    const onCompose = vi.fn();

    render(
      <EmailInboxToolbar
        searchQuery=""
        onSearchChange={onSearchChange}
        sortOrder="desc"
        onSortChange={onSortChange}
        showUnreadOnly={false}
        onUnreadOnlyChange={onUnreadOnlyChange}
        showWithAttachmentsOnly={false}
        onWithAttachmentsChange={onWithAttachmentsChange}
        showArchivedOnly={false}
        onArchivedOnlyChange={onArchivedOnlyChange}
        unreadCount={0}
        attachmentCount={0}
        archivedCount={0}
        onCompose={onCompose}
      />,
    );

    fireEvent.change(screen.getByLabelText("Sort order"), { target: { value: "asc" } });
    expect(onSortChange).toHaveBeenCalledWith("asc");
  });

  it("supporte le wrapper QueryClientProvider via renderHook sans erreur", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => "ready", { wrapper });

    expect(result.current).toBe("ready");
    expect(mockFrom).not.toHaveBeenCalled();
    expect(builder.select).not.toHaveBeenCalled();
  });
});