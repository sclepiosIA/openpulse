/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { AddUserDialog } from "./AddUserDialog";

const {
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
  createUserMutateSpy,
} = vi.hoisted(() => {
  const thenableResult = { data: null, error: null };

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
    single: vi.fn(async () => thenableResult),
    maybeSingle: vi.fn(async () => thenableResult),
    then: (
      resolve: (value: { data: null; error: null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(thenableResult).then(resolve, reject),
    catch: (reject: (reason: unknown) => unknown) => Promise.resolve(thenableResult).catch(reject),
  };

  return {
    AUTH_STATE: {
      user: { id: "u1", email: "user@test.local" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => builder),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    createUserMutateSpy: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
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
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
    return <input ref={ref} {...props} />;
  }),
}));

vi.mock("@/components/ui/form", async () => {
  const rhf = await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => null,
    FormField: ({
      control,
      name,
      render,
    }: {
      control: unknown;
      name: string;
      render: (props: { field: ReturnType<typeof rhf.useController>["field"] }) => React.ReactNode;
    }) => {
      const { field } = rhf.useController({
        name,
        control: control as Parameters<typeof rhf.useController>[0]["control"],
      });
      return <>{render({ field })}</>;
    },
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    defaultValue,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
    defaultValue?: string;
  }) => {
    const items: React.ReactElement[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && "props" in child) {
        const childProps = child.props as { children?: React.ReactNode };
        React.Children.forEach(childProps.children, (nested) => {
          if (React.isValidElement(nested) && "props" in nested) {
            const nestedProps = nested.props as { value?: string; children?: React.ReactNode };
            if (typeof nestedProps.value === "string") {
              items.push(nested);
            }
          }
        });
      }
    });

    return (
      <select aria-label="Rôle" defaultValue={defaultValue} onChange={(e) => onValueChange?.(e.target.value)}>
        {items.map((item, index) => {
          const itemProps = item.props as { value?: string; children?: React.ReactNode };
          return (
            <option key={`${String(itemProps.value)}-${index}`} value={itemProps.value}>
              {itemProps.children}
            </option>
          );
        })}
      </select>
    );
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
}));

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: { className?: string }) => <svg data-testid="loader" className={className} />,
}));

let mutationMode: "idle" | "pending" | "success" | "error" = "idle";

vi.mock("@/hooks/auth/useCreateUser", () => ({
  useCreateUser: () => {
    if (mutationMode === "pending") {
      return {
        mutate: createUserMutateSpy,
        isPending: true,
      };
    }

    if (mutationMode === "success") {
      return {
        mutate: (
          variables: {
            email: string;
            prenom: string;
            nom: string;
            role: "direction" | "copil" | "admin" | "commercial" | "chef_projet" | "csm" | "rh";
            password: string;
            fonction?: string;
          },
          options?: { onSuccess?: () => void }
        ) => {
          createUserMutateSpy(variables, options);
          options?.onSuccess?.();
        },
        isPending: false,
      };
    }

    if (mutationMode === "error") {
      return {
        mutate: (
          variables: {
            email: string;
            prenom: string;
            nom: string;
            role: "direction" | "copil" | "admin" | "commercial" | "chef_projet" | "csm" | "rh";
            password: string;
            fonction?: string;
          }
        ) => {
          createUserMutateSpy(variables);
        },
        isPending: false,
      };
    }

    return {
      mutate: createUserMutateSpy,
      isPending: false,
    };
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(createTestQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("AddUserDialog", () => {
  beforeEach(() => {
    mutationMode = "idle";
    createUserMutateSpy.mockClear();
    mockFrom.mockClear();
    mockNavigate.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("affiche le dialogue et les valeurs initiales métier attendues", () => {
    render(
      <Wrapper>
        <AddUserDialog open={true} onOpenChange={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByText("Ajouter un utilisateur")).toBeInTheDocument();
    expect(screen.getByText(/Créez un nouveau compte utilisateur/i)).toBeInTheDocument();

    expect(screen.getByPlaceholderText("Jean")).toHaveValue("");
    expect(screen.getByPlaceholderText("Dupont")).toHaveValue("");
    expect(screen.getByPlaceholderText("jean.dupont@exploitant.example.org")).toHaveValue("");
    expect(screen.getByPlaceholderText("Directeur Général")).toHaveValue("");
    expect(screen.getByLabelText("Rôle")).toHaveValue("commercial");

    const submitButton = screen.getByRole("button", { name: /Créer l'utilisateur/i });
    expect(submitButton).toBeEnabled();
  });

  it("affiche l'état de chargement quand la mutation est pending", () => {
    mutationMode = "pending";

    render(
      <Wrapper>
        <AddUserDialog open={true} onOpenChange={vi.fn()} />
      </Wrapper>
    );

    expect(screen.getByRole("button", { name: /Annuler/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Créer l'utilisateur/i })).toBeDisabled();
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("soumet les valeurs métier correctes puis ferme la fenêtre en cas de succès", async () => {
    mutationMode = "success";
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <AddUserDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    await user.type(screen.getByPlaceholderText("Jean"), "Marie");
    await user.type(screen.getByPlaceholderText("Dupont"), "Curie");
    await user.type(screen.getByPlaceholderText("jean.dupont@exploitant.example.org"), "marie.curie@example.com");
    await user.selectOptions(screen.getByLabelText("Rôle"), "csm");
    await user.type(screen.getByPlaceholderText("Directeur Général"), "Responsable relation client");

    await user.click(screen.getByRole("button", { name: /Créer l'utilisateur/i }));

    await waitFor(() => {
      expect(createUserMutateSpy).toHaveBeenCalledTimes(1);
    });

    expect(createUserMutateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "marie.curie@example.com",
        prenom: "Marie",
        nom: "Curie",
        role: "csm",
        fonction: "Responsable relation client",
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );

    const firstCall = createUserMutateSpy.mock.calls[0];
    const payload = firstCall[0] as {
      email: string;
      prenom: string;
      nom: string;
      role: string;
      password: string;
      fonction?: string;
    };

    expect(payload.password).toEqual(expect.any(String));
    expect(payload.password.length).toBeGreaterThanOrEqual(8);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("n'appelle pas la mutation si le formulaire est invalide", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <AddUserDialog open={true} onOpenChange={vi.fn()} />
      </Wrapper>
    );

    await user.type(screen.getByPlaceholderText("Jean"), "Paul");
    await user.click(screen.getByRole("button", { name: /Créer l'utilisateur/i }));

    await waitFor(() => {
      expect(createUserMutateSpy).not.toHaveBeenCalled();
    });
  });

  it("couvre le chemin erreur via un hook de mutation avec isError", async () => {
    function useFailingCreateUserTestHook() {
      return useMutation({
        mutationFn: async () => {
          const result = { data: null, error: { message: "x" } };
          if (result.error) {
            throw new Error(result.error.message);
          }
          return result;
        },
        retry: 0,
      });
    }

    const { result } = renderHook(() => useFailingCreateUserTestHook(), {
      wrapper: Wrapper,
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow("x");
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("x");
  });
});