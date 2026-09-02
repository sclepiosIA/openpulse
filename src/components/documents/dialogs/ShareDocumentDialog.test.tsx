/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShareDocumentDialog } from "./ShareDocumentDialog";

const {
  AUTH_STATE,
  DOCUMENT,
  PERMISSION_LABELS_MOCK,
  SHARES_LOADING_STATE,
  SHARES_SUCCESS_STATE,
  SHARES_EMPTY_STATE,
  GROUPS_STATE,
  SEARCH_RESULTS_STATE,
  shareMutate,
  unshareMutate,
  updateShareMutate,
  logDocumentAuditMock,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  DOCUMENT: {
    id: "doc-1",
    name: "Plan projet",
  },
  PERMISSION_LABELS_MOCK: {
    view: "Lecture",
    edit: "Modification",
    admin: "Administration",
  },
  SHARES_LOADING_STATE: {
    data: [],
    isLoading: true,
  },
  SHARES_SUCCESS_STATE: {
    data: [
      {
        id: "share-user-1",
        permission_level: "view",
        shared_with_user_id: "u2",
        shared_with_group_id: null,
        shared_with_user: {
          prenom: "Jean",
          nom: "Dupont",
          email: "jean@test.co",
        },
        shared_with_group: null,
      },
      {
        id: "share-group-1",
        permission_level: "edit",
        shared_with_user_id: null,
        shared_with_group_id: "g1",
        shared_with_user: null,
        shared_with_group: {
          name: "Equipe Produit",
          color: "#123456",
        },
      },
    ],
    isLoading: false,
  },
  SHARES_EMPTY_STATE: {
    data: [],
    isLoading: false,
  },
  GROUPS_STATE: {
    data: [
      { id: "g1", name: "Equipe Produit", member_count: 4, color: "#123456" },
      { id: "g2", name: "Equipe Ops", member_count: 2, color: "#654321" },
    ],
  },
  SEARCH_RESULTS_STATE: {
    data: [
      {
        id: "p1",
        user_id: "u3",
        prenom: "Alice",
        nom: "Martin",
        email: "alice@test.co",
      },
      {
        id: "p2",
        user_id: "u2",
        prenom: "Jean",
        nom: "Dupont",
        email: "jean@test.co",
      },
    ],
  },
  shareMutate: vi.fn(),
  unshareMutate: vi.fn(),
  updateShareMutate: vi.fn(),
  logDocumentAuditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/documents/useDocumentPermissions", () => ({
  useDocumentShares: vi.fn(() => SHARES_SUCCESS_STATE),
  useShareDocument: () => ({ mutate: shareMutate }),
  useUnshareDocument: () => ({ mutate: unshareMutate }),
  useUpdateDocumentShare: () => ({ mutate: updateShareMutate }),
}));

vi.mock("@/hooks/documents/useUserGroups", () => ({
  useUserGroups: vi.fn(() => GROUPS_STATE),
}));

vi.mock("@/hooks/profile/useProfileSearch", () => ({
  useProfileSearch: vi.fn(() => SEARCH_RESULTS_STATE),
}));

vi.mock("@/hooks/documents/useDocumentAuditLog", () => ({
  logDocumentAudit: logDocumentAuditMock,
}));

vi.mock("@/types/documents/permissions", () => ({
  PERMISSION_LABELS: PERMISSION_LABELS_MOCK,
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Search: Icon,
    UserPlus: Icon,
    Users: Icon,
    Trash2: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={className}>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} aria-label={typeof props["aria-label"] === "string" ? props["aria-label"] : undefined}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, placeholder, className }: { value?: string; onChange?: React.ChangeEventHandler<HTMLInputElement>; placeholder?: string; className?: string }) => (
    <input value={value} onChange={onChange} placeholder={placeholder} className={className} />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => {
  const TabsContext = React.createContext<{ value: string; setValue: (v: string) => void } | null>(null);

  return {
    Tabs: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
      <TabsContext.Provider value={{ value, setValue: onValueChange }}>{children}</TabsContext.Provider>
    ),
    TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(TabsContext);
      return <button onClick={() => ctx?.setValue(value)}>{children}</button>;
    },
    TabsContent: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(TabsContext);
      return ctx?.value === value ? <div>{children}</div> : null;
    },
  };
});

vi.mock("@/components/ui/select", () => {
  const ReactModule = React;

  const extractOptions = (children: React.ReactNode): Array<{ value: string; label: string }> => {
    const options: Array<{ value: string; label: string }> = [];

    ReactModule.Children.forEach(children, (child) => {
      if (!ReactModule.isValidElement(child)) return;

      const childProps = child.props as { value?: string; children?: React.ReactNode };
      if (typeof childProps.value === "string") {
        options.push({ value: childProps.value, label: String(childProps.children) });
      }

      if (childProps.children) {
        options.push(...extractOptions(childProps.children));
      }
    });

    return options;
  };

  return {
    Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => {
      const items = extractOptions(children);
      return (
        <select aria-label="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      );
    },
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("ShareDocumentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le chargement des partages", async () => {
    const permissions = await import("@/hooks/documents/useDocumentPermissions");
    vi.mocked(permissions.useDocumentShares).mockImplementation(() => SHARES_LOADING_STATE);

    renderWithProviders(<ShareDocumentDialog document={DOCUMENT} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Partager le document")).toBeInTheDocument();
    expect(screen.getByText("Plan projet")).toBeInTheDocument();
    expect(screen.queryByText("Aucun partage")).not.toBeInTheDocument();
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    expect(screen.getByText("Partages actifs")).toBeInTheDocument();
  });

  it("affiche les partages actifs et permet de partager un utilisateur, modifier une permission et supprimer un partage", async () => {
    const permissions = await import("@/hooks/documents/useDocumentPermissions");
    vi.mocked(permissions.useDocumentShares).mockImplementation(() => SHARES_SUCCESS_STATE);

    renderWithProviders(<ShareDocumentDialog document={DOCUMENT} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("jean@test.co")).toBeInTheDocument();
    expect(screen.getAllByText("Equipe Produit")[0]).toBeInTheDocument();
    expect(screen.getByText("Groupe")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Rechercher un utilisateur...");
    fireEvent.change(input, { target: { value: "Al" } });

    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("alice@test.co")).toBeInTheDocument();
    expect(screen.getByText("Déjà partagé")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Alice Martin"));

    expect(shareMutate).toHaveBeenCalledWith({
      documentId: "doc-1",
      documentName: "Plan projet",
      userId: "u3",
      permissionLevel: "view",
    });
    expect(logDocumentAuditMock).toHaveBeenCalledWith("doc-1", "shared", {
      target: "user",
      target_id: "u3",
      level: "view",
    });

    const selects = screen.getAllByLabelText("select");
    fireEvent.change(selects[1], { target: { value: "admin" } });

    expect(updateShareMutate).toHaveBeenCalledWith({
      shareId: "share-user-1",
      permissionLevel: "admin",
      documentId: "doc-1",
    });
    expect(logDocumentAuditMock).toHaveBeenCalledWith("doc-1", "permission_changed", {
      share_id: "share-user-1",
      new_level: "admin",
    });

    const removeButtons = screen.getAllByLabelText("Supprimer");
    fireEvent.click(removeButtons[0]);

    expect(unshareMutate).toHaveBeenCalledWith({
      shareId: "share-user-1",
      documentId: "doc-1",
    });
    expect(logDocumentAuditMock).toHaveBeenCalledWith("doc-1", "permission_changed", {
      share_id: "share-user-1",
      change: "removed",
    });
  });

  it("affiche l'état vide et permet de partager un groupe non encore partagé", async () => {
    const permissions = await import("@/hooks/documents/useDocumentPermissions");
    vi.mocked(permissions.useDocumentShares).mockImplementation(() => SHARES_EMPTY_STATE);

    renderWithProviders(<ShareDocumentDialog document={DOCUMENT} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Aucun partage")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Groupes"));

    expect(screen.getByText("Equipe Produit")).toBeInTheDocument();
    expect(screen.getByText("4 membre(s)")).toBeInTheDocument();
    expect(screen.getByText("Equipe Ops")).toBeInTheDocument();
    expect(screen.getByText("2 membre(s)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Equipe Ops"));

    expect(shareMutate).toHaveBeenCalledWith({
      documentId: "doc-1",
      documentName: "Plan projet",
      groupId: "g2",
      permissionLevel: "view",
    });
    expect(logDocumentAuditMock).toHaveBeenCalledWith("doc-1", "shared", {
      target: "group",
      target_id: "g2",
      level: "view",
    });
  });
});