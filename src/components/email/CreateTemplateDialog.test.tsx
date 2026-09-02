// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import { CreateTemplateDialog } from "./CreateTemplateDialog";

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockMutateAsync,
  mockUseCreateEmailTemplate,
  mockFrom,
} = vi.hoisted(() => {
  const createBuilder = () => {
    const result = { data: null, error: null };
    const b = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      gte: vi.fn(() => b),
      lte: vi.fn(() => b),
      in: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      insert: vi.fn(() => b),
      update: vi.fn(() => b),
      delete: vi.fn(() => b),
      upsert: vi.fn(() => b),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };
    return b;
  };

  return {
    AUTH_STATE: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockMutateAsync: vi.fn(),
    mockUseCreateEmailTemplate: vi.fn(),
    mockFrom: vi.fn(() => createBuilder()),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  Save: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="save-icon" {...props} />,
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
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
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
      aria-label={id}
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
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    rows,
    className,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
  }) => (
    <textarea
      id={id}
      aria-label={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  ),
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
    const options: React.ReactNode[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === React.Fragment) {
        React.Children.forEach(child.props.children as React.ReactNode, (nested) => {
          if (React.isValidElement(nested) && nested.type === React.Fragment) {
            React.Children.forEach(nested.props.children as React.ReactNode, (deep) => {
              options.push(deep);
            });
          } else {
            options.push(nested);
          }
        });
      } else {
        options.push(child);
      }
    });

    return (
      <select
        id="template-category"
        aria-label="template-category"
        data-testid="category-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Sélectionner une catégorie...</option>
        {options}
      </select>
    );
  },
  SelectTrigger: ({ children }: { children: React.ReactNode; id?: string }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="" disabled>
      {placeholder}
    </option>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/hooks/email/useEmailTemplates", () => ({
  useCreateEmailTemplate: () => mockUseCreateEmailTemplate(),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("CreateTemplateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateEmailTemplate.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it("affiche les valeurs initiales, détecte les variables uniques et crée un template avec les valeurs métier attendues", async () => {
    mockMutateAsync.mockResolvedValue({ data: { id: "tpl1" }, error: null });
    const onOpenChange = vi.fn();

    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        initialSubject="Bonjour {{firstName}} pour {{company}}"
        initialContent={"Bienvenue {{firstName}},\nVotre compte {{company}} est prêt.\nRef {{code}} {{code}}"}
      />
    );

    expect(screen.getByText("Créer un template d'email")).toBeInTheDocument();
    expect(screen.getByLabelText("template-subject")).toHaveValue("Bonjour {{firstName}} pour {{company}}");
    expect(screen.getByLabelText("template-content")).toHaveValue(
      "Bienvenue {{firstName}},\nVotre compte {{company}} est prêt.\nRef {{code}} {{code}}"
    );

    expect(screen.getByText("{{firstName}}")).toBeInTheDocument();
    expect(screen.getByText("{{company}}")).toBeInTheDocument();
    expect(screen.getByText("{{code}}")).toBeInTheDocument();
    expect(screen.getAllByText("{{code}}")).toHaveLength(1);

    const createButton = screen.getByRole("button", { name: /créer le template/i });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("template-name"), {
      target: { value: "  Relance client  " },
    });
    fireEvent.change(screen.getByTestId("category-select"), {
      target: { value: "Commercial" },
    });

    expect(createButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(createButton);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      name: "Relance client",
      subject: "Bonjour {{firstName}} pour {{company}}",
      content: "Bienvenue {{firstName}},\nVotre compte {{company}} est prêt.\nRef {{code}} {{code}}",
      category: "Commercial",
      variables: ["firstName", "company", "code"],
      is_active: true,
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("remet le formulaire à zéro à la réouverture avec de nouvelles valeurs initiales", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        initialSubject="Sujet A"
        initialContent="Contenu A {{alpha}}"
      />
    );

    fireEvent.change(screen.getByLabelText("template-name"), {
      target: { value: "Nom temporaire" },
    });
    fireEvent.change(screen.getByTestId("category-select"), {
      target: { value: "Support" },
    });
    fireEvent.change(screen.getByLabelText("template-subject"), {
      target: { value: "Sujet modifié" },
    });
    fireEvent.change(screen.getByLabelText("template-content"), {
      target: { value: "Contenu modifié {{beta}}" },
    });

    expect(screen.getByLabelText("template-name")).toHaveValue("Nom temporaire");
    expect(screen.getByLabelText("template-subject")).toHaveValue("Sujet modifié");
    expect(screen.getByLabelText("template-content")).toHaveValue("Contenu modifié {{beta}}");

    rerender(
      <CreateTemplateDialog
        open={false}
        onOpenChange={onOpenChange}
        initialSubject="Sujet B"
        initialContent="Contenu B {{gamma}}"
      />
    );

    rerender(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        initialSubject="Sujet B"
        initialContent="Contenu B {{gamma}}"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText("template-name")).toHaveValue("");
    });

    expect(screen.getByTestId("category-select")).toHaveValue("");
    expect(screen.getByLabelText("template-subject")).toHaveValue("Sujet B");
    expect(screen.getByLabelText("template-content")).toHaveValue("Contenu B {{gamma}}");
    expect(screen.getByText("{{gamma}}")).toBeInTheDocument();
    expect(screen.queryByText("{{beta}}")).not.toBeInTheDocument();
  });

  it("n'appelle pas la mutation si le nom est vide puis ferme au clic sur Annuler", async () => {
    const onOpenChange = vi.fn();

    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        initialSubject="Sujet"
        initialContent="Contenu"
      />
    );

    const createButton = screen.getByRole("button", { name: /créer le template/i });
    expect(createButton).toBeDisabled();

    fireEvent.click(createButton);
    expect(mockMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /annuler/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche l'état de chargement via le hook mocké", () => {
    mockUseCreateEmailTemplate.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });

    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        initialSubject="Sujet pending"
        initialContent="Contenu pending"
      />
    );

    const createButton = screen.getByRole("button", { name: /créer le template/i });
    expect(createButton).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("save-icon")).not.toBeInTheDocument();
  });

  it("couvre succès et erreur via un hook de mutation rendu avec QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (mode: "success" | "error") => {
            if (mode === "error") {
              throw { data: null, error: { message: "x" } };
            }
            return { data: { ok: true }, error: null };
          },
        }),
      { wrapper }
    );

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);

    await act(async () => {
      const response = await result.current.mutateAsync("success");
      expect(response).toEqual({ data: { ok: true }, error: null });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ data: { ok: true }, error: null });

    await act(async () => {
      await expect(result.current.mutateAsync("error")).rejects.toEqual({
        data: null,
        error: { message: "x" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({
      data: null,
      error: { message: "x" },
    });
  });
});