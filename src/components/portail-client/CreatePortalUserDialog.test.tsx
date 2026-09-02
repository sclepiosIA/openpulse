/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatePortalUserDialog } from "./CreatePortalUserDialog";

const {
  ETABS,
  createMutateAsync,
  useCreateClientPortalUserMock,
  useEtablissementsMock,
  onOpenChangeMock,
} = vi.hoisted(() => ({
  ETABS: [
    { id: "etab-1", nom: "Clinique du Lac", ville: "Lyon", region: "Auvergne-Rhône-Alpes", code_postal: "69001" },
    { id: "etab-2", nom: "Centre Horizon", ville: "Paris", region: "Île-de-France", code_postal: "75010" },
  ],
  createMutateAsync: vi.fn(),
  useCreateClientPortalUserMock: vi.fn(),
  useEtablissementsMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
      catch: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    },
  };
});

vi.mock("@/hooks/portail/useClientPortal", () => ({
  useCreateClientPortalUser: () => useCreateClientPortalUserMock(),
}));

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissements: () => useEtablissementsMock(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Copy: Icon,
    Check: Icon,
    KeyRound: Icon,
    ChevronsUpDown: Icon,
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type = "button",
    disabled,
    className,
    role,
    "aria-expanded": ariaExpanded,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
    role?: string;
    "aria-expanded"?: boolean;
    "aria-label"?: string;
  }) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      role={role}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    type,
    required,
    readOnly,
    className,
    placeholder,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    type?: string;
    required?: boolean;
    readOnly?: boolean;
    className?: string;
    placeholder?: string;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      type={type}
      required={required}
      readOnly={readOnly}
      className={className}
      placeholder={placeholder}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode; shouldFilter?: boolean }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({
    value,
    onValueChange,
    placeholder,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label="command-input"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    value?: string;
    onSelect?: (value: string) => void;
  }) => (
    <button type="button" onClick={() => onSelect?.("")}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("CreatePortalUserDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useEtablissementsMock.mockReturnValue({
      data: ETABS,
    });

    useCreateClientPortalUserMock.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    });

    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: vi.fn(),
        },
      },
      configurable: true,
    });
  });

  it("affiche le formulaire, permet de sélectionner un établissement et soumet les données normalisées", async () => {
    createMutateAsync.mockResolvedValue({ temp_password: "tmp-pass" });

    render(
      <CreatePortalUserDialog
        open={true}
        onOpenChange={onOpenChangeMock}
      />,
    );

    expect(screen.getByText("Créer un compte portail client")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom complet")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByRole("button", { name: /créer le compte/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Nom complet"), "  Jean Dupont  ");
    await userEvent.type(screen.getByLabelText("Email"), "  JEAN@EXAMPLE.COM  ");

    await userEvent.click(screen.getByRole("button", { name: /clinique du lac/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /créer le compte/i })).toBeEnabled();
    });

    await userEvent.click(screen.getByRole("button", { name: /créer le compte/i }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        email: "jean@example.com",
        full_name: "Jean Dupont",
        etablissement_id: "etab-1",
      });
    });

    expect(await screen.findByDisplayValue("tmp-pass")).toBeInTheDocument();
    expect(screen.getByText("Mot de passe temporaire")).toBeInTheDocument();
    expect(screen.getByText(/communiquez ce mot de passe au client/i)).toBeInTheDocument();
  });

  it("utilise directement etablissementId passé en prop et masque le sélecteur", async () => {
    createMutateAsync.mockResolvedValue({ temp_password: "pwd-temp" });

    render(
      <CreatePortalUserDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="etab-2"
      />,
    );

    expect(screen.queryByText("Établissement")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nom complet"), "Alice Martin");
    await userEvent.type(screen.getByLabelText("Email"), "alice@test.fr");

    const submitButton = screen.getByRole("button", { name: /créer le compte/i });
    expect(submitButton).toBeEnabled();

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        email: "alice@test.fr",
        full_name: "Alice Martin",
        etablissement_id: "etab-2",
      });
    });

    expect(await screen.findByDisplayValue("pwd-temp")).toBeInTheDocument();
  });

  it("copie le mot de passe temporaire dans le presse-papiers", async () => {
    createMutateAsync.mockResolvedValue({ temp_password: "copy-me" });

    render(
      <CreatePortalUserDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="etab-1"
      />,
    );

    await userEvent.type(screen.getByLabelText("Nom complet"), "Bob");
    await userEvent.type(screen.getByLabelText("Email"), "bob@test.fr");
    await userEvent.click(screen.getByRole("button", { name: /créer le compte/i }));

    expect(await screen.findByDisplayValue("copy-me")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("copy-me");
  });

  it("réinitialise les champs et appelle onOpenChange(false) lors de l'annulation", async () => {
    render(
      <CreatePortalUserDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="etab-1"
      />,
    );

    const nameInput = screen.getByLabelText("Nom complet");
    const emailInput = screen.getByLabelText("Email");

    await userEvent.type(nameInput, "Temp Name");
    await userEvent.type(emailInput, "temp@test.fr");

    expect(nameInput).toHaveValue("Temp Name");
    expect(emailInput).toHaveValue("temp@test.fr");

    fireEvent.click(screen.getByRole("button", { name: /annuler/i }));

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("affiche l'état pending sur le bouton de soumission", () => {
    useCreateClientPortalUserMock.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: true,
    });

    render(
      <CreatePortalUserDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="etab-1"
      />,
    );

    const submitButton = screen.getByRole("button", { name: /création/i });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Création...");
  });
});