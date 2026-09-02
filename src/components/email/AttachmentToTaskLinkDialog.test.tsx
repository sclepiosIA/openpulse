/* @vitest-environment jsdom */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AttachmentToTaskLinkDialog } from "./AttachmentToTaskLinkDialog";

const {
  TASKS,
  TOAST_FN,
  mockInvoke,
  mockUseTaches,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => ({
  TASKS: [
    {
      id: "task-1",
      titre: "Contrôle chaudière",
      etablissement_id: "eta-1",
      statut: "En cours",
      categories_taches: { id: "cat-1", nom: "maintenance", couleur: "#111" },
    },
    {
      id: "task-2",
      titre: "Inspection extincteurs",
      etablissement_id: "eta-1",
      statut: "Planifié",
      categories_taches: { id: "cat-2", nom: "sécurité", couleur: "#222" },
    },
    {
      id: "task-3",
      titre: "Tâche terminée",
      etablissement_id: "eta-1",
      statut: "Terminé",
      categories_taches: { id: "cat-3", nom: "maintenance", couleur: "#333" },
    },
    {
      id: "task-4",
      titre: "Autre établissement",
      etablissement_id: "eta-2",
      statut: "En cours",
      categories_taches: { id: "cat-4", nom: "maintenance", couleur: "#444" },
    },
  ],
  TOAST_FN: vi.fn(),
  mockInvoke: vi.fn(),
  mockUseTaches: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
}));

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/hooks/tasks/useTaches", () => ({
  useTaches: mockUseTaches,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h1 className={className}>{children}</h1>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
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
  }) => <div data-testid="select-root" data-value={value} data-onchange={String(Boolean(onValueChange))}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => (
    <button type="button" data-testid={`select-item-${value}`}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  Link: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="link-icon" {...props} />,
  CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="check-icon" {...props} />,
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-icon" {...props} />,
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="sparkles-icon" {...props} />,
}));

vi.mock("@/types/gantt", () => ({}));
vi.mock("@/lib/validations", () => ({}));

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

describe("AttachmentToTaskLinkDialog", () => {
  const attachment = {
    id: "att-1",
    filename: "rapport.pdf",
    mime_type: "application/pdf",
    storage_path: "docs/rapport.pdf",
  };

  const autoDetection = {
    type: "maintenance",
    confidence: 0.82,
    matchedKeywords: ["chaudière", "contrôle", "entretien"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état de chargement des tâches", () => {
    mockUseTaches.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(
      <AttachmentToTaskLinkDialog
        open={true}
        onOpenChange={vi.fn()}
        attachment={attachment}
        etablissementId="eta-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Associer à une tâche")).toBeInTheDocument();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(screen.getByText("rapport.pdf")).toBeInTheDocument();
  });

  it("affiche les informations métier, filtre les tâches et pré-sélectionne la tâche recommandée", async () => {
    mockUseTaches.mockReturnValue({
      data: TASKS,
      isLoading: false,
    });

    render(
      <AttachmentToTaskLinkDialog
        open={true}
        onOpenChange={vi.fn()}
        attachment={attachment}
        etablissementId="eta-1"
        messageSubject="Demande de maintenance urgente"
        autoDetection={autoDetection}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("rapport.pdf")).toBeInTheDocument();
    expect(screen.getByText("Email: Demande de maintenance urgente")).toBeInTheDocument();
    expect(screen.getByText("Type détecté : maintenance")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("chaudière")).toBeInTheDocument();
    expect(screen.getByText("contrôle")).toBeInTheDocument();
    expect(screen.getByText("entretien")).toBeInTheDocument();

    expect(screen.getByText("Contrôle chaudière")).toBeInTheDocument();
    expect(screen.getByText("Inspection extincteurs")).toBeInTheDocument();
    expect(screen.queryByText("Tâche terminée")).not.toBeInTheDocument();
    expect(screen.queryByText("Autre établissement")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("select-root")).toHaveAttribute("data-value", "task-1");
    });
  });

  it("associe le document à la tâche sélectionnée et affiche un toast de succès", async () => {
    const onOpenChange = vi.fn();

    mockUseTaches.mockReturnValue({
      data: TASKS,
      isLoading: false,
    });

    mockInvoke.mockResolvedValue({
      data: { version: 3 },
      error: null,
    });

    render(
      <AttachmentToTaskLinkDialog
        open={true}
        onOpenChange={onOpenChange}
        attachment={attachment}
        etablissementId="eta-1"
        autoDetection={autoDetection}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByTestId("select-root")).toHaveAttribute("data-value", "task-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /associer/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("auto-link-attachment-to-task", {
        body: {
          attachment_id: "att-1",
          etablissement_id: "eta-1",
          force_task_id: "task-1",
        },
      });
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Document associé",
      description: "rapport.pdf a été associé à la tâche (version 3)",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("gère l'erreur de liaison et affiche un toast destructif", async () => {
    mockUseTaches.mockReturnValue({
      data: TASKS,
      isLoading: false,
    });

    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "x" },
    });

    mockSanitizeSupabaseError.mockReturnValue("Erreur lisible");

    render(
      <AttachmentToTaskLinkDialog
        open={true}
        onOpenChange={vi.fn()}
        attachment={attachment}
        etablissementId="eta-1"
        autoDetection={autoDetection}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByTestId("select-root")).toHaveAttribute("data-value", "task-1");
    });

    fireEvent.click(screen.getByRole("button", { name: /associer/i }));

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: "x" });
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Erreur lisible",
      variant: "destructive",
    });
  });
});