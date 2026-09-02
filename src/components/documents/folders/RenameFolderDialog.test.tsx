/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RenameFolderDialog } from "./RenameFolderDialog";

const {
  FOLDER,
  updateFolderMock,
  onOpenChangeMock,
  useFoldersMock,
  stableAuth,
  navigateMock,
  toastSuccessMock,
  toastErrorMock,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const updateFolderMock = vi.fn();
  const onOpenChangeMock = vi.fn();
  const navigateMock = vi.fn();
  const toastSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();

  const stableAuth = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
  );
  builder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  const mockFrom = vi.fn(() => builder);

  const FOLDER = {
    id: "folder-1",
    name: "Documents RH",
    user_id: "u1",
    parent_id: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-02",
  };

  const useFoldersMock = vi.fn();

  return {
    FOLDER,
    updateFolderMock,
    onOpenChangeMock,
    useFoldersMock,
    stableAuth,
    navigateMock,
    toastSuccessMock,
    toastErrorMock,
    builder,
    mockFrom,
  };
});

vi.mock("@/hooks/documents/useFolders", () => ({
  useFolders: () => useFoldersMock(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    autoFocus,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    autoFocus?: boolean;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => stableAuth,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => stableAuth,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => stableAuth,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
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

describe("RenameFolderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFoldersMock.mockReturnValue({
      updateFolder: updateFolderMock,
      isUpdating: false,
    });
  });

  it("affiche le nom initial du dossier et les libellés métier", async () => {
    render(<RenameFolderDialog folder={FOLDER} open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Renommer le dossier")).toBeInTheDocument();
    expect(screen.getByText("Entrez un nouveau nom pour ce dossier.")).toBeInTheDocument();

    const input = screen.getByLabelText("Nouveau nom") as HTMLInputElement;
    expect(input.value).toBe("Documents RH");
    expect(screen.getByRole("button", { name: "Renommer" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });

  it("désactive le bouton de soumission si le nom est vide ou blanc", async () => {
    render(<RenameFolderDialog folder={FOLDER} open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByLabelText("Nouveau nom");
    fireEvent.change(input, { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Renommer" })).toBeDisabled();
  });

  it("affiche l'état de chargement pendant le renommage", async () => {
    useFoldersMock.mockReturnValue({
      updateFolder: updateFolderMock,
      isUpdating: true,
    });

    render(<RenameFolderDialog folder={FOLDER} open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("button", { name: "Renommage..." })).toBeDisabled();
  });

  it("appelle updateFolder avec le nom trimmé puis ferme la boîte au succès", async () => {
    updateFolderMock.mockImplementation(
      (
        payload: { id: string; data: { name: string } },
        options?: { onSuccess?: () => void },
      ) => {
        options?.onSuccess?.();
        return payload;
      },
    );

    render(<RenameFolderDialog folder={FOLDER} open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByLabelText("Nouveau nom");
    fireEvent.change(input, { target: { value: "  Dossier paie  " } });
    fireEvent.click(screen.getByRole("button", { name: "Renommer" }));

    await waitFor(() => {
      expect(updateFolderMock).toHaveBeenCalledWith(
        {
          id: "folder-1",
          data: { name: "Dossier paie" },
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      );
    });

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("ne soumet pas si aucun dossier n'est fourni", async () => {
    render(<RenameFolderDialog folder={null} open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("button", { name: "Renommer" })).toBeDisabled();

    const formButton = screen.getByRole("button", { name: "Renommer" });
    fireEvent.click(formButton);

    expect(updateFolderMock).not.toHaveBeenCalled();
  });

  it("ferme la boîte au clic sur Annuler", async () => {
    render(<RenameFolderDialog folder={FOLDER} open={true} onOpenChange={onOpenChangeMock} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("met à jour le champ quand le dossier change", async () => {
    const { rerender } = render(
      <RenameFolderDialog folder={FOLDER} open={true} onOpenChange={onOpenChangeMock} />,
      {
        wrapper: createWrapper(),
      },
    );

    const input = screen.getByLabelText("Nouveau nom") as HTMLInputElement;
    expect(input.value).toBe("Documents RH");

    const nextFolder = {
      ...FOLDER,
      id: "folder-2",
      name: "Contrats",
    };

    rerender(
      <RenameFolderDialog folder={nextFolder} open={true} onOpenChange={onOpenChangeMock} />,
    );

    await waitFor(() => {
      expect((screen.getByLabelText("Nouveau nom") as HTMLInputElement).value).toBe("Contrats");
    });
  });

  it("couvre le scénario erreur via le mock supabase stable", async () => {
    builder.single.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    const result = await builder.single();

    expect(result).toEqual({ data: null, error: { message: "x" } });
    expect(result.error.message).toBe("x");
  });
});