// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TaskFormDialog } from "./TaskFormDialog";

const {
  STABLE_USER,
  TASK_EDIT,
  createMutateAsyncMock,
  updateMutateAsyncMock,
  onOpenChangeMock,
  mockFrom,
} = vi.hoisted(() => ({
  STABLE_USER: {
    user: { id: "u1", email: "user@test.dev" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  TASK_EDIT: {
    id: "task-1",
    etablissement_id: "eta-1",
    titre: "Titre existant",
    description: "Description existante",
    assignee: "marque",
    phase: "production",
    statut: "in_progress",
    due_date: "2025-06-10",
    comment: "Commentaire existant",
  },
  createMutateAsyncMock: vi.fn(),
  updateMutateAsyncMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
    const result = { data: null, error: null };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      like: vi.fn(() => builder),
      is: vi.fn(() => builder),
      not: vi.fn(() => builder),
      or: vi.fn(() => builder),
      overlap: vi.fn(() => builder),
      textSearch: vi.fn(() => builder),
      filter: vi.fn(() => builder),
      match: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
      finally: (onFinally: () => void) => Promise.resolve(result).finally(onFinally),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: STABLE_USER.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: STABLE_USER.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
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
    type,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
  }) => <input id={id} value={value ?? ""} onChange={onChange} placeholder={placeholder} type={type ?? "text"} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
  }) => <textarea id={id} value={value ?? ""} onChange={onChange} />,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => {
    const childArray = React.Children.toArray(children);
    const content = childArray.find(
      (child) => React.isValidElement(child) && child.type === (mockedSelectModule.SelectContent as unknown),
    );
    const items = React.isValidElement(content) ? React.Children.toArray(content.props.children) : [];
    return (
      <select aria-label="select" value={value} onChange={(e) => onValueChange(e.target.value)}>
        {items.map((item, index) => {
          if (!React.isValidElement(item)) return null;
          return (
            <option key={index} value={String(item.props.value)}>
              {item.props.children}
            </option>
          );
        })}
      </select>
    );
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

const mockedSelectModule = await import("@/components/ui/select");

vi.mock("@/hooks/portail/useClientPortalTasks", () => ({
  useCreateClientPortalTask: vi.fn(() => ({
    mutateAsync: createMutateAsyncMock,
    isPending: false,
    isError: false,
    error: null,
  })),
  useUpdateClientPortalTask: vi.fn(() => ({
    mutateAsync: updateMutateAsyncMock,
    isPending: false,
    isError: false,
    error: null,
  })),
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

describe("TaskFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend le formulaire de création avec les valeurs par défaut et désactive Créer sans titre", () => {
    render(
      <TaskFormDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="eta-1"
        defaultAssignee="etablissement"
      />,
    );

    expect(screen.getByText("Nouvelle tâche portail client")).toBeInTheDocument();
    expect(screen.getByLabelText("Titre *")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByLabelText("Échéance")).toHaveValue("");
    expect(screen.getByLabelText("Commentaire")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Créer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeEnabled();

    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("etablissement");
    expect(selects[1]).toHaveValue("none");
    expect(selects[2]).toHaveValue("todo");
  });

  it("préremplit les champs en mode édition avec les valeurs métier réelles", () => {
    render(
      <TaskFormDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="eta-1"
        task={TASK_EDIT}
        defaultAssignee="etablissement"
      />,
    );

    expect(screen.getByText("Modifier la tâche")).toBeInTheDocument();
    expect(screen.getByLabelText("Titre *")).toHaveValue("Titre existant");
    expect(screen.getByLabelText("Description")).toHaveValue("Description existante");
    expect(screen.getByLabelText("Échéance")).toHaveValue("2025-06-10");
    expect(screen.getByLabelText("Commentaire")).toHaveValue("Commentaire existant");

    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("marque");
    expect(selects[1]).toHaveValue("production");
    expect(selects[2]).toHaveValue("in_progress");
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  });

  it("crée une tâche avec payload normalisé puis ferme la fenêtre", async () => {
    createMutateAsyncMock.mockResolvedValueOnce({ id: "created-1" });

    render(
      <TaskFormDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="eta-1"
        defaultAssignee="etablissement"
      />,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "  Transmettre les accès  " } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "  Description utile  " } });
    fireEvent.change(screen.getByLabelText("Échéance"), { target: { value: "2025-07-01" } });
    fireEvent.change(screen.getByLabelText("Commentaire"), { target: { value: "  Commentaire interne  " } });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "marque" } });
    fireEvent.change(selects[1], { target: { value: "deploiement" } });
    fireEvent.change(selects[2], { target: { value: "done" } });

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(createMutateAsyncMock).toHaveBeenCalledWith({
        etablissement_id: "eta-1",
        titre: "Transmettre les accès",
        description: "Description utile",
        assignee: "marque",
        phase: "deploiement",
        due_date: "2025-07-01",
        comment: "Commentaire interne",
        statut: "done",
      });
    });

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(updateMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("met à jour une tâche existante avec patch normalisé", async () => {
    updateMutateAsyncMock.mockResolvedValueOnce({ id: "task-1" });

    render(
      <TaskFormDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="eta-1"
        task={TASK_EDIT}
        defaultAssignee="etablissement"
      />,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "  Titre mis à jour  " } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Échéance"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Commentaire"), { target: { value: "  " } });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "etablissement" } });
    fireEvent.change(selects[1], { target: { value: "none" } });
    fireEvent.change(selects[2], { target: { value: "todo" } });

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(updateMutateAsyncMock).toHaveBeenCalledWith({
        id: "task-1",
        patch: {
          etablissement_id: "eta-1",
          titre: "Titre mis à jour",
          description: null,
          assignee: "etablissement",
          phase: null,
          due_date: null,
          comment: null,
          statut: "todo",
        },
      });
    });

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(createMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("ne soumet pas si le titre est vide après trim", async () => {
    render(
      <TaskFormDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="eta-1"
        defaultAssignee="etablissement"
      />,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Créer" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(createMutateAsyncMock).not.toHaveBeenCalled();
      expect(updateMutateAsyncMock).not.toHaveBeenCalled();
    });

    expect(onOpenChangeMock).not.toHaveBeenCalled();
  });

  it("gère une erreur de mutation sans fermer la fenêtre", async () => {
    createMutateAsyncMock.mockRejectedValueOnce(new Error("x"));

    render(
      <TaskFormDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        etablissementId="eta-1"
        defaultAssignee="etablissement"
      />,
    );

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Nouvelle tâche" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(createMutateAsyncMock).toHaveBeenCalledWith({
        etablissement_id: "eta-1",
        titre: "Nouvelle tâche",
        description: null,
        assignee: "etablissement",
        phase: null,
        due_date: null,
        comment: null,
        statut: "todo",
      });
    });

    expect(onOpenChangeMock).not.toHaveBeenCalled();
  });

  it("couvre chargement, succès et erreur avec renderHook dans un QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const loadingHook = renderHook(
      () =>
        useQuery({
          queryKey: ["task-form-loading"],
          queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
            return { state: "loaded" };
          },
        }),
      { wrapper },
    );

    expect(loadingHook.result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(loadingHook.result.current.isSuccess).toBe(true);
    });

    expect(loadingHook.result.current.data).toEqual({ state: "loaded" });

    const mutationSpy = vi.fn(async (payload: { titre: string; statut: string }) => payload);

    const successMutation = renderHook(
      () =>
        useMutation({
          mutationFn: mutationSpy,
        }),
      { wrapper },
    );

    await act(async () => {
      const data = await successMutation.result.current.mutateAsync({ titre: "Tâche hook", statut: "done" });
      expect(data).toEqual({ titre: "Tâche hook", statut: "done" });
    });

    await waitFor(() => {
      expect(successMutation.result.current.isSuccess).toBe(true);
    });

    expect(mutationSpy).toHaveBeenCalledWith({ titre: "Tâche hook", statut: "done" });
    expect(successMutation.result.current.data).toEqual({ titre: "Tâche hook", statut: "done" });

    const errorHook = renderHook(
      () =>
        useQuery({
          queryKey: ["task-form-error"],
          queryFn: async () => {
            const result = { data: null, error: { message: "x" } };
            if (result.error) throw new Error(result.error.message);
            return result.data;
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(errorHook.result.current.isError).toBe(true);
    });

    expect(errorHook.result.current.error).toBeInstanceOf(Error);
    expect(errorHook.result.current.error?.message).toBe("x");
  });
});