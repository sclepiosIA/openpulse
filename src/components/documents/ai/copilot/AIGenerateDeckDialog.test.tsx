import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

const {
  SUCCESS_RESPONSE,
  ERROR_RESPONSE,
  mockFrom,
  mockInvoke,
  mockGetSession,
  mockGetUser,
  mockOnAuthStateChange,
  mockRpc,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const ROWS = [{ id: "1", title: "row stable" }];
  const GENERATED_SLIDES = [
    {
      title: "Constat",
      bullets: ["Risque élevé", "Coûts évitables"],
      notes: "Ouvrir avec un exemple.",
    },
    {
      title: "Plan d'action",
      bullets: ["Former les équipes", "Suivre les indicateurs"],
      notes: "Insister sur la mesure.",
    },
  ];
  const SUCCESS_RESPONSE = {
    data: {
      title: "Plan prévention",
      slides: GENERATED_SLIDES,
    },
    error: null,
  };
  const ERROR_RESPONSE = {
    data: null,
    error: Object.assign(new Error("x"), { message: "x" }),
  };
  const queryResult = { data: ROWS, error: null };
  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);
  const methods = [
    "select",
    "eq",
    "neq",
    "gte",
    "lte",
    "gt",
    "lt",
    "in",
    "is",
    "order",
    "limit",
    "range",
    "insert",
    "update",
    "upsert",
    "delete",
    "match",
    "filter",
    "contains",
    "overlaps",
    "throwOnError",
  ];

  methods.forEach((method) => {
    builder[method] = chain;
  });

  builder.single = vi.fn(() => Promise.resolve(queryResult));
  builder.maybeSingle = vi.fn(() => Promise.resolve(queryResult));
  builder.then = vi.fn(
    (
      onfulfilled?: ((value: typeof queryResult) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(queryResult).then(onfulfilled ?? undefined, onrejected ?? undefined),
  );
  builder.catch = vi.fn((onrejected?: ((reason: unknown) => unknown) | null) =>
    Promise.resolve(queryResult).catch(onrejected ?? undefined),
  );

  const mockFrom = vi.fn(() => builder);
  const mockRpc = vi.fn(() => Promise.resolve(queryResult));

  type InvokeOptions = { body: Record<string, unknown> };
  type InvokeResponse = typeof SUCCESS_RESPONSE | typeof ERROR_RESPONSE;
  const mockInvoke = vi.fn((_name: string, _options: InvokeOptions): Promise<InvokeResponse> =>
    Promise.resolve(SUCCESS_RESPONSE),
  );

  const AUTH_USER = { id: "u1", email: "t@t.co" };
  const AUTH_SESSION = { user: AUTH_USER };
  const mockGetSession = vi.fn(() => Promise.resolve({ data: { session: AUTH_SESSION }, error: null }));
  const mockGetUser = vi.fn(() => Promise.resolve({ data: { user: AUTH_USER }, error: null }));
  const mockUnsubscribe = vi.fn();
  const mockOnAuthStateChange = vi.fn(() => ({
    data: {
      subscription: {
        unsubscribe: mockUnsubscribe,
      },
    },
  }));

  return {
    SUCCESS_RESPONSE,
    ERROR_RESPONSE,
    mockFrom,
    mockInvoke,
    mockGetSession,
    mockGetUser,
    mockOnAuthStateChange,
    mockRpc,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("lucide-react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const Sparkles = ({ className }: { className?: string }) =>
    React.createElement("span", { "aria-hidden": true, className, "data-testid": "sparkles-icon" });

  const Loader2 = ({ className }: { className?: string }) =>
    React.createElement("span", { "aria-hidden": true, className, "data-testid": "loader-icon" });

  return { Sparkles, Loader2 };
});

vi.mock("@/components/ui/dialog", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  type DialogProps = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: ReactNode;
  };

  const Dialog = ({ open = true, children }: DialogProps) =>
    open ? React.createElement("div", { "data-testid": "dialog-root" }, children) : null;

  const DialogContent = ({ children, className: _className, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement("section", { role: "dialog", "aria-modal": true, ...props }, children);

  const DialogHeader = ({ children, className: _className, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", { ...props }, children);

  const DialogFooter = ({ children, className: _className, ...props }: HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", { ...props }, children);

  const DialogTitle = ({ children, className: _className, ...props }: HTMLAttributes<HTMLHeadingElement>) =>
    React.createElement("h2", { ...props }, children);

  const DialogDescription = ({ children, className: _className, ...props }: HTMLAttributes<HTMLParagraphElement>) =>
    React.createElement("p", { ...props }, children);

  return {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogPortal: ({ children }: { children?: ReactNode }) => React.createElement(React.Fragment, null, children),
    DialogOverlay: ({ children }: { children?: ReactNode }) => React.createElement("div", null, children),
    DialogClose: ({ children }: { children?: ReactNode }) => React.createElement("button", { type: "button" }, children),
    DialogTrigger: ({ children }: { children?: ReactNode }) =>
      React.createElement("button", { type: "button" }, children),
  };
});

vi.mock("@/components/ui/button", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    asChild?: boolean;
  };

  const Button = ({
    children,
    variant: _variant,
    asChild: _asChild,
    type,
    ...props
  }: MockButtonProps) => React.createElement("button", { type: type ?? "button", ...props }, children);

  return { Button, buttonVariants: vi.fn(() => "") };
});

vi.mock("@/components/ui/input", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const Input = (props: InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props);

  return { Input };
});

vi.mock("@/components/ui/label", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const Label = (props: LabelHTMLAttributes<HTMLLabelElement>) => React.createElement("label", props);

  return { Label };
});

vi.mock("@/components/ui/textarea", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => React.createElement("textarea", props);

  return { Textarea };
});

import { AIGenerateDeckDialog, type GeneratedDeck } from "./AIGenerateDeckDialog";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderDialog(overrides: Partial<ComponentProps<typeof AIGenerateDeckDialog>> = {}) {
  const defaultOnOpenChange = vi.fn<(value: boolean) => void>();
  const defaultOnGenerated = vi.fn<(deck: GeneratedDeck) => void>();

  const props: ComponentProps<typeof AIGenerateDeckDialog> = {
    open: overrides.open ?? true,
    onOpenChange: overrides.onOpenChange ?? defaultOnOpenChange,
    onGenerated: overrides.onGenerated ?? defaultOnGenerated,
    documentId: Object.prototype.hasOwnProperty.call(overrides, "documentId") ? overrides.documentId : null,
  };

  const result = render(
    <QueryClientProvider client={createQueryClient()}>
      <AIGenerateDeckDialog {...props} />
    </QueryClientProvider>,
  );

  return {
    ...result,
    onOpenChange: props.onOpenChange,
    onGenerated: props.onGenerated,
  };
}

describe("AIGenerateDeckDialog", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(SUCCESS_RESPONSE);
    mockFrom.mockClear();
    mockRpc.mockClear();
    mockGetSession.mockClear();
    mockGetUser.mockClear();
    mockOnAuthStateChange.mockClear();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le formulaire de génération avec ses valeurs initiales", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Générer un deck avec l'IA")).toBeInTheDocument();
    expect(
      screen.getByText("Décrivez le sujet, l'IA structure titre + puces + notes orateur pour chaque slide."),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Sujet / objectif")).toHaveValue("");
    expect(screen.getByLabelText("Public cible (optionnel)")).toHaveValue("");
    expect(screen.getByLabelText("Nombre de slides")).toHaveValue(10);
    expect(screen.getByLabelText("Nombre de slides")).toHaveAttribute("min", "3");
    expect(screen.getByLabelText("Nombre de slides")).toHaveAttribute("max", "25");

    expect(screen.getByRole("button", { name: /annuler/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /générer/i })).toBeDisabled();
  });

  it("désactive les contrôles et affiche l'état de chargement pendant l'appel IA", async () => {
    let resolveInvoke: (value: typeof SUCCESS_RESPONSE) => void = () => undefined;
    const pendingInvoke = new Promise<typeof SUCCESS_RESPONSE>((resolve) => {
      resolveInvoke = resolve;
    });
    mockInvoke.mockReturnValueOnce(pendingInvoke);

    renderDialog();

    fireEvent.change(screen.getByLabelText("Sujet / objectif"), {
      target: { value: "Deck prévention" },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(screen.getByLabelText("Sujet / objectif")).toBeDisabled();
    expect(screen.getByLabelText("Public cible (optionnel)")).toBeDisabled();
    expect(screen.getByLabelText("Nombre de slides")).toBeDisabled();
    expect(screen.getByRole("button", { name: /annuler/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /générer/i })).toBeDisabled();

    await act(async () => {
      resolveInvoke(SUCCESS_RESPONSE);
      await pendingInvoke;
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Sujet / objectif")).toBeEnabled();
      expect(screen.getByRole("button", { name: /annuler/i })).toBeEnabled();
    });
  });

  it("appelle la fonction Supabase avec les champs normalisés puis remonte le deck généré", async () => {
    const { onGenerated, onOpenChange } = renderDialog({ documentId: "doc-1" });

    fireEvent.change(screen.getByLabelText("Sujet / objectif"), {
      target: { value: "  prévention chutes  " },
    });
    fireEvent.change(screen.getByLabelText("Public cible (optionnel)"), {
      target: { value: "  comité  " },
    });
    fireEvent.change(screen.getByLabelText("Nombre de slides"), {
      target: { value: "30" },
    });

    expect(screen.getByLabelText("Nombre de slides")).toHaveValue(25);

    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("presentation-ai-generate", {
        body: {
          prompt: "prévention chutes",
          audience: "comité",
          slideCount: 25,
          documentId: "doc-1",
        },
      });
    });

    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledWith({
        title: SUCCESS_RESPONSE.data.title,
        slides: SUCCESS_RESPONSE.data.slides,
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith("2 slides générées");
    expect(toastError).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Sujet / objectif")).toHaveValue("");
  });

  it("affiche une erreur et ne ferme pas le dialogue quand Supabase renvoie une erreur", async () => {
    mockInvoke.mockResolvedValueOnce(ERROR_RESPONSE);
    const { onGenerated, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText("Sujet / objectif"), {
      target: { value: "Sujet fiable" },
    });
    fireEvent.click(screen.getByRole("button", { name: /générer/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("x");
    });

    expect(mockInvoke).toHaveBeenCalledWith("presentation-ai-generate", {
      body: {
        prompt: "Sujet fiable",
        audience: undefined,
        slideCount: 10,
        documentId: null,
      },
    });
    expect(onGenerated).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Sujet / objectif")).toHaveValue("Sujet fiable");
  });
});