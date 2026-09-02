import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContractAIToolbar } from "./ContractAIToolbar";

const {
  mockCallContractAiAssist,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  sanitizeMock,
} = vi.hoisted(() => ({
  mockCallContractAiAssist: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
  sanitizeMock: vi.fn((value: string) => value),
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: sanitizeMock,
  },
}));

vi.mock("@/services/contrats/contractAiAssist", () => ({
  callContractAiAssist: mockCallContractAiAssist,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ariaLabel,
    title,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    ariaLabel?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={props["aria-label"] ?? ariaLabel}
      title={title}
      className={className}
      data-variant={variant}
      data-size={size}
      type="button"
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    disabled,
    className,
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
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
  }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Sparkles: Icon,
    X: Icon,
    Wand2: Icon,
    Languages: Icon,
    FileCheck: Icon,
    Minimize2: Icon,
    Maximize2: Icon,
    CheckCircle: Icon,
    Loader2: Icon,
    AlertCircle: Icon,
  };
});

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

describe("ContractAIToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeMock.mockImplementation((value: string) => value);
  });

  it("affiche l'état de chargement puis le résultat d'une action rapide et applique le contenu généré", async () => {
    let resolvePromise: ((value: { result: string }) => void) | undefined;
    mockCallContractAiAssist.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const onApply = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ContractAIToolbar
        content="Texte initial"
        sectionTitle="Clause de confidentialité"
        onApply={onApply}
        onClose={onClose}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "Simplifier" }));

    expect(mockCallContractAiAssist).toHaveBeenCalledWith({
      action: "simplify",
      content: "Texte initial",
      sectionTitle: "Clause de confidentialité",
      customPrompt: undefined,
    });

    expect(screen.getByText("Analyse en cours...")).toBeInTheDocument();

    resolvePromise?.({ result: "<p>Texte simplifié</p>" });

    await waitFor(() => {
      expect(screen.getByText("Suggestion générée")).toBeInTheDocument();
    });

    expect(sanitizeMock).toHaveBeenCalledWith("<p>Texte simplifié</p>");
    expect(screen.getByText("Texte simplifié")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Appliquer" }));

    expect(onApply).toHaveBeenCalledWith("<p>Texte simplifié</p>");
    expect(mockToastSuccess).toHaveBeenCalledWith("Modifications appliquées");

    await waitFor(() => {
      expect(screen.queryByText("Suggestion générée")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("envoie un prompt personnalisé, affiche le résultat puis permet de l'annuler", async () => {
    mockCallContractAiAssist.mockResolvedValue({
      result: "<div>Version personnalisée</div>",
    });

    const user = userEvent.setup();

    render(
      <ContractAIToolbar
        content="Contenu source"
        sectionTitle="Préambule"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const textarea = screen.getByPlaceholderText("Ou décrivez votre demande personnalisée...");
    await user.type(textarea, "Ajoute une précision sur les délais");
    await user.click(screen.getAllByRole("button").at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(mockCallContractAiAssist).toHaveBeenCalledWith({
        action: "custom",
        content: "Contenu source",
        sectionTitle: "Préambule",
        customPrompt: "Ajoute une précision sur les délais",
      });
    });

    expect(await screen.findByText("Version personnalisée")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByText("Version personnalisée")).not.toBeInTheDocument();
    });
  });

  it("affiche une erreur métier lorsque le service IA échoue", async () => {
    mockCallContractAiAssist.mockResolvedValue({
      error: "Service indisponible",
    });

    const user = userEvent.setup();

    render(
      <ContractAIToolbar
        content="Texte à vérifier"
        sectionTitle="Clause finale"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "Vérifier" }));

    expect(await screen.findByText("Service indisponible")).toBeInTheDocument();
    expect(mockDebugError).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith("Erreur IA", {
      description: "Service indisponible",
    });
    expect(screen.queryByText("Suggestion générée")).not.toBeInTheDocument();
  });
});