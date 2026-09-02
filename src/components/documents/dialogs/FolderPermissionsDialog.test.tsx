// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { FolderPermissionsDialog } from "./FolderPermissionsDialog";

const {
  AUTH_STATE,
  PERMISSIONS_LOADING,
  PERMISSIONS_SUCCESS,
  PERMISSIONS_EMPTY,
  GROUPS_DATA,
  SEARCH_RESULTS,
  mockUseFolderPermissions,
  mockUseSetFolderPermission,
  mockUseRemoveFolderPermission,
  mockUseUserGroups,
  mockMutateAdd,
  mockMutateRemove,
  mockToastSuccess,
  mockToastError,
  mockSanitize,
  mockFrom,
  mockSelect,
  mockOr,
  mockNeq,
  mockLimit,
  mockUpdate,
  mockEq,
  builder,
  responses,
  FOLDER,
} = vi.hoisted(() => {
  const AUTH_STATE_LOCAL = {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const PERMISSIONS_LOADING_LOCAL = {
    data: [],
    isLoading: true,
  };

  const PERMISSIONS_SUCCESS_LOCAL = {
    data: [
      {
        id: "perm-user-1",
        user_id: "u2",
        group_id: null,
        access_level: "edit",
        user: {
          nom: "Doe",
          prenom: "Jane",
          email: "jane@test.local",
        },
        group: null,
      },
      {
        id: "perm-group-1",
        user_id: null,
        group_id: "g1",
        access_level: "view",
        user: null,
        group: {
          id: "g1",
          name: "Equipe Produit",
          color: "#123456",
        },
      },
    ],
    isLoading: false,
  };

  const PERMISSIONS_EMPTY_LOCAL = {
    data: [],
    isLoading: false,
  };

  const GROUPS_DATA_LOCAL = {
    data: [
      { id: "g1", name: "Equipe Produit", color: "#123456", member_count: 3 },
      { id: "g2", name: "Equipe Support", color: "#654321", member_count: 5 },
    ],
  };

  const SEARCH_RESULTS_LOCAL = [
    {
      id: "u3",
      nom: "Martin",
      prenom: "Alice",
      email: "alice@test.local",
      avatar_url: null,
    },
    {
      id: "u2",
      nom: "Doe",
      prenom: "Jane",
      email: "jane@test.local",
      avatar_url: null,
    },
  ];

  const mockUseFolderPermissionsLocal = vi.fn();
  const mockUseSetFolderPermissionLocal = vi.fn();
  const mockUseRemoveFolderPermissionLocal = vi.fn();
  const mockUseUserGroupsLocal = vi.fn();

  const mockMutateAddLocal = vi.fn();
  const mockMutateRemoveLocal = vi.fn();

  const mockToastSuccessLocal = vi.fn();
  const mockToastErrorLocal = vi.fn();

  const mockSanitizeLocal = vi.fn((v: string) => v);

  const mockSelectLocal = vi.fn();
  const mockOrLocal = vi.fn();
  const mockNeqLocal = vi.fn();
  const mockLimitLocal = vi.fn();
  const mockUpdateLocal = vi.fn();
  const mockEqLocal = vi.fn();

  // responses per table
  const responsesLocal: Record<string, any> = {
    profiles: { data: SEARCH_RESULTS_LOCAL, error: null },
    document_folders: { data: null, error: null },
  };

  // chainable builder that is THENABLE
  const builderLocal: any = {
    __response: responsesLocal.profiles,
    select: (...args: any[]) => {
      mockSelectLocal(...args);
      return builderLocal;
    },
    or: (...args: any[]) => {
      mockOrLocal(...args);
      return builderLocal;
    },
    neq: (...args: any[]) => {
      mockNeqLocal(...args);
      return builderLocal;
    },
    limit: (...args: any[]) => {
      mockLimitLocal(...args);
      return builderLocal;
    },
    update: (...args: any[]) => {
      mockUpdateLocal(...args);
      return builderLocal;
    },
    eq: (...args: any[]) => {
      mockEqLocal(...args);
      return builderLocal;
    },
    gte: vi.fn(() => builderLocal),
    lte: vi.fn(() => builderLocal),
    in: vi.fn(() => builderLocal),
    order: vi.fn(() => builderLocal),
    insert: vi.fn(() => builderLocal),
    delete: vi.fn(() => builderLocal),
    single: vi.fn(() => Promise.resolve(builderLocal.__response)),
    maybeSingle: vi.fn(() => Promise.resolve(builderLocal.__response)),
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(builderLocal.__response).then(onFulfilled, onRejected);
    },
    catch(onRejected: any) {
      return Promise.resolve(builderLocal.__response).catch(onRejected);
    },
  };

  const FOLDER_LOCAL = {
    id: "folder-1",
    name: "Dossier RH",
    is_restricted: true,
  };

  return {
    AUTH_STATE: AUTH_STATE_LOCAL,
    PERMISSIONS_LOADING: PERMISSIONS_LOADING_LOCAL,
    PERMISSIONS_SUCCESS: PERMISSIONS_SUCCESS_LOCAL,
    PERMISSIONS_EMPTY: PERMISSIONS_EMPTY_LOCAL,
    GROUPS_DATA: GROUPS_DATA_LOCAL,
    SEARCH_RESULTS: SEARCH_RESULTS_LOCAL,
    mockUseFolderPermissions: mockUseFolderPermissionsLocal,
    mockUseSetFolderPermission: mockUseSetFolderPermissionLocal,
    mockUseRemoveFolderPermission: mockUseRemoveFolderPermissionLocal,
    mockUseUserGroups: mockUseUserGroupsLocal,
    mockMutateAdd: mockMutateAddLocal,
    mockMutateRemove: mockMutateRemoveLocal,
    mockToastSuccess: mockToastSuccessLocal,
    mockToastError: mockToastErrorLocal,
    mockSanitize: mockSanitizeLocal,
    mockFrom: vi.fn((table: string) => {
      // when supabase.from is called, set builder.__response according to table
      builderLocal.__response = responsesLocal[table] ?? { data: null, error: null };
      return builderLocal;
    }),
    mockSelect: mockSelectLocal,
    mockOr: mockOrLocal,
    mockNeq: mockNeqLocal,
    mockLimit: mockLimitLocal,
    mockUpdate: mockUpdateLocal,
    mockEq: mockEqLocal,
    builder: builderLocal,
    responses: responsesLocal,
    FOLDER: FOLDER_LOCAL,
  };
});

vi.mock("@/hooks/documents/useDocumentPermissions", () => ({
  useFolderPermissions: mockUseFolderPermissions,
  useSetFolderPermission: mockUseSetFolderPermission,
  useRemoveFolderPermission: mockUseRemoveFolderPermission,
}));

vi.mock("@/hooks/documents/useUserGroups", () => ({
  useUserGroups: mockUseUserGroups,
}));

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizePostgrestValue: mockSanitize,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/types/documents/permissions", () => ({
  PERMISSION_LABELS: {
    view: "Lecture",
    edit: "Modification",
    admin: "Administration",
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={className}>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabelFromProp,
    disabled,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} aria-label={ariaLabelFromProp} disabled={disabled}>
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
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
    disabled?: boolean;
    id?: string;
  }) => (
    <button
      type="button"
      data-testid={id}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    >
      switch
    </button>
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <button type="button" data-testid={`select-item-${value}`}>{children}</button>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>selected</span>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value }: { children: React.ReactNode; value?: string }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid={className ?? "icon"} />;
  return {
    Search: Icon,
    UserPlus: Icon,
    Users: Icon,
    Trash2: Icon,
    Loader2: Icon,
    Globe: Icon,
    Lock: Icon,
  };
});

// helper to create QueryClient with required options
function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderComponentWithClient(client?: QueryClient) {
  const qc = client ?? createClient();
  return render(
    <QueryClientProvider client={qc}>
      <FolderPermissionsDialog folder={FOLDER} open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("FolderPermissionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // default responses
    responses.profiles = { data: SEARCH_RESULTS, error: null };
    responses.document_folders = { data: null, error: null };

    mockUseFolderPermissions.mockReturnValue(PERMISSIONS_SUCCESS);
    mockUseUserGroups.mockReturnValue(GROUPS_DATA);
    mockUseSetFolderPermission.mockReturnValue({ mutate: mockMutateAdd });
    mockUseRemoveFolderPermission.mockReturnValue({ mutate: mockMutateRemove });
  });

  it("renderHook wrapper exposes a QueryClient", () => {
    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useQueryClient(), { wrapper });
    expect(result.current).toBeInstanceOf(QueryClient);
  });

  it("affiche l'état de chargement des permissions", () => {
    mockUseFolderPermissions.mockReturnValue(PERMISSIONS_LOADING);

    renderComponentWithClient();

    expect(screen.getByText("Permissions du dossier")).toBeInTheDocument();
    expect(screen.getByText("Dossier RH")).toBeInTheDocument();
    expect(screen.getByText("Permissions actuelles")).toBeInTheDocument();
    expect(screen.queryByText("Aucune permission — seuls le propriétaire et les admins y ont accès")).not.toBeInTheDocument();
  });

  it("affiche les permissions actuelles et permet de supprimer une permission", async () => {
    renderComponentWithClient();

    // Names and labels may appear multiple times in the UI; assert at least one occurrence
    const janeMatches = screen.getAllByText("Jane Doe");
    expect(janeMatches.length).toBeGreaterThanOrEqual(1);

    const emailMatches = screen.getAllByText("jane@test.local");
    expect(emailMatches.length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("Equipe Produit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Groupe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Modification").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Lecture").length).toBeGreaterThanOrEqual(1);

    const removeButtons = screen.getAllByRole("button", { name: "Supprimer" });
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(removeButtons[0]);

    expect(mockMutateRemove).toHaveBeenCalledWith({
      permissionId: "perm-user-1",
      folderId: "folder-1",
    });
  });

  it("effectue une recherche utilisateur et ajoute un utilisateur non encore autorisé", async () => {
    // ensure profiles response contains SEARCH_RESULTS
    responses.profiles = { data: SEARCH_RESULTS, error: null };

    renderComponentWithClient();

    const input = screen.getByPlaceholderText("Rechercher un utilisateur...");
    fireEvent.change(input, { target: { value: "Al" } });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("profiles");
    });

    expect(mockSanitize).toHaveBeenCalledWith("Al");
    expect(mockOr).toHaveBeenCalledWith(`nom.ilike.%Al%,prenom.ilike.%Al%,email.ilike.%Al%`);
    expect(mockNeq).toHaveBeenCalledWith("id", "u1");
    expect(mockLimit).toHaveBeenCalledWith(10);

    await waitFor(() => {
      // Alice Martin entry should be rendered
      const aliceMatches = screen.getAllByText("Alice Martin");
      expect(aliceMatches.length).toBeGreaterThanOrEqual(1);
    });

    // click the Alice button (the text content is the button's child)
    const aliceButton = screen.getAllByText("Alice Martin")[0];
    fireEvent.click(aliceButton);

    expect(mockMutateAdd).toHaveBeenCalledWith({
      folderId: "folder-1",
      userId: "u3",
      accessLevel: "view",
    });
  });

  it("affiche le message vide quand aucune permission n'existe", () => {
    mockUseFolderPermissions.mockReturnValue(PERMISSIONS_EMPTY);

    renderComponentWithClient();

    expect(screen.getByText("Aucune permission — seuls le propriétaire et les admins y ont accès")).toBeInTheDocument();
  });

  it("bascule la restriction avec succès et invalide les requêtes liées", async () => {
    // ensure success response for document_folders
    responses.document_folders = { data: null, error: null };

    const client = createClient();
    const spyInvalidate = vi.spyOn(client, "invalidateQueries").mockImplementation(() => undefined);

    render(
      <QueryClientProvider client={client}>
        <FolderPermissionsDialog folder={FOLDER} open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );

    const toggle = screen.getByTestId("restrict-toggle");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("document_folders");
    });

    expect(mockUpdate).toHaveBeenCalledWith({ is_restricted: false });
    expect(mockEq).toHaveBeenCalledWith("id", "folder-1");

    await waitFor(() => {
      expect(spyInvalidate).toHaveBeenCalledWith({ queryKey: ["folders"] });
      expect(spyInvalidate).toHaveBeenCalledWith({ queryKey: ["folder-tree"] });
      expect(mockToastSuccess).toHaveBeenCalledWith("Dossier accessible à tous");
    });
  });

  it("gère l'erreur lors du basculement de restriction", async () => {
    // simulate error response from supabase update
    responses.document_folders = { data: null, error: { message: "x" } };

    renderComponentWithClient();

    const toggle = screen.getByTestId("restrict-toggle");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la modification");
    });
  });
});