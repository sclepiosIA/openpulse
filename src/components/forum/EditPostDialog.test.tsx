import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditPostDialog } from "./EditPostDialog";

const {
  POST,
  UPDATED_PAYLOAD,
  onOpenChange,
  mutateAsync,
  debugError,
  toastError,
} = vi.hoisted(() => ({
  POST: {
    id: "post-1",
    titre: "Titre initial",
    contenu: "Contenu initial",
    theme: "pmsi",
    visibilite: "global" as const,
  },
  UPDATED_PAYLOAD: {
    postId: "post-1",
    updates: {
      titre: "Nouveau titre",
      contenu: "Nouveau contenu",
      theme: "smr",
    },
  },
  onOpenChange: vi.fn(),
  mutateAsync: vi.fn(),
  debugError: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/forum/useForumPosts", () => ({
  useUpdateForumPost: vi.fn(() => ({
    mutateAsync,
    isPending: false,
    isError: false,
  })),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="dialog" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>
        close-dialog
      </button>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    disabled,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <label htmlFor="theme-select">theme-select</label>
      <select
        id="theme-select"
        data-testid="theme-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Sélectionner un thème</option>
        <option value="pmsi">PMSI</option>
        <option value="smr">SMR</option>
        <option value="urgences">Urgences</option>
        <option value="completion_dossier">Complétion dossier</option>
        <option value="dictee_vocale">Dictée vocale</option>
        <option value="astuces">Astuces</option>
        <option value="bugs">Bugs</option>
        <option value="support">Support</option>
        <option value="autre">Autre</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
}));

vi.mock("@/components/email/LazyRichTextEditor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="Contenu *"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
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

describe("EditPostDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les valeurs initiales du post quand la fenêtre est ouverte", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EditPostDialog post={POST} open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    expect(screen.getByRole("heading", { name: "Modifier le post" })).toBeInTheDocument();
    expect(screen.getByLabelText("Titre *")).toHaveValue("Titre initial");
    expect(screen.getByLabelText("Contenu *")).toHaveValue("Contenu initial");
    expect(screen.getByTestId("theme-select")).toHaveValue("pmsi");
    expect(screen.getByRole("button", { name: "Modifier" })).toBeEnabled();
  });

  it("met à jour le post avec les valeurs métier attendues puis ferme la fenêtre", async () => {
    mutateAsync.mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EditPostDialog post={POST} open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), {
      target: { value: "Nouveau titre" },
    });
    fireEvent.change(screen.getByTestId("theme-select"), {
      target: { value: "smr" },
    });
    fireEvent.change(screen.getByLabelText("Contenu *"), {
      target: { value: "Nouveau contenu" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(UPDATED_PAYLOAD);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastError).not.toHaveBeenCalled();
    expect(debugError).not.toHaveBeenCalled();
  });

  it("affiche une erreur de validation et n'appelle pas la mutation si un champ requis est vide", async () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EditPostDialog post={POST} open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Veuillez remplir tous les champs");
    });

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("gère l'erreur de mutation et journalise l'erreur sans fermer la fenêtre", async () => {
    const error = { message: "x" };
    mutateAsync.mockRejectedValueOnce(error);

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EditPostDialog post={POST} open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), {
      target: { value: "Nouveau titre" },
    });
    fireEvent.change(screen.getByTestId("theme-select"), {
      target: { value: "smr" },
    });
    fireEvent.change(screen.getByLabelText("Contenu *"), {
      target: { value: "Nouveau contenu" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(UPDATED_PAYLOAD);
    });

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledWith("Error updating post:", error);
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("réinitialise les champs avec les données du post quand open repasse à true", async () => {
    const Wrapper = createWrapper();

    const { rerender } = render(
      <Wrapper>
        <EditPostDialog post={POST} open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), {
      target: { value: "Titre modifié localement" },
    });
    fireEvent.change(screen.getByLabelText("Contenu *"), {
      target: { value: "Contenu modifié localement" },
    });
    fireEvent.change(screen.getByTestId("theme-select"), {
      target: { value: "support" },
    });

    rerender(
      <Wrapper>
        <EditPostDialog post={POST} open={false} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    rerender(
      <Wrapper>
        <EditPostDialog post={POST} open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Titre *")).toHaveValue("Titre initial");
      expect(screen.getByLabelText("Contenu *")).toHaveValue("Contenu initial");
      expect(screen.getByTestId("theme-select")).toHaveValue("pmsi");
    });
  });
});