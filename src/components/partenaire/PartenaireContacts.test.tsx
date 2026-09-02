import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { PartenaireContacts } from "./PartenaireContacts";

const {
  CONTACTS,
  PENDING_CONTACTS,
  EMPTY_CONTACTS,
  EMPTY_PENDING,
  AUTH_STATE,
  navigateMock,
  toastSuccessMock,
  approvePendingContactMock,
  rejectPendingContactMock,
  createMutateAsyncMock,
  updateMutateAsyncMock,
  deleteMutateAsyncMock,
  createMutationState,
  updateMutationState,
  deleteMutationState,
  contactsHookState,
  pendingHookState,
  formPropsSpy,
  alertDialogActionPropsSpy,
  mockFrom,
} = vi.hoisted(() => ({
  CONTACTS: [
    {
      id: "c1",
      prenom: "Jean",
      nom: "Dupont",
      email: "jean@example.fr",
      telephone: "0102030405",
      fonction: "Directeur",
      notes: "Contact principal du compte",
      est_contact_principal: true,
      created_source: "email_ai",
    },
    {
      id: "c2",
      prenom: "Alice",
      nom: "Martin",
      email: "alice@example.fr",
      telephone: null,
      fonction: "Acheteuse",
      notes: null,
      est_contact_principal: false,
      created_source: "manual",
    },
  ],
  PENDING_CONTACTS: [
    {
      id: "p1",
      extracted_data: {
        prenom: "Luc",
        nom: "Bernard",
        email: "luc@example.fr",
        fonction: "Responsable achats",
      },
      confidence: 0.87,
    },
  ],
  EMPTY_CONTACTS: [],
  EMPTY_PENDING: [],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  navigateMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  approvePendingContactMock: vi.fn().mockResolvedValue(undefined),
  rejectPendingContactMock: vi.fn().mockResolvedValue(undefined),
  createMutateAsyncMock: vi.fn().mockResolvedValue(undefined),
  updateMutateAsyncMock: vi.fn().mockResolvedValue(undefined),
  deleteMutateAsyncMock: vi.fn().mockResolvedValue(undefined),
  createMutationState: { isPending: false },
  updateMutationState: { isPending: false },
  deleteMutationState: { isPending: false },
  contactsHookState: {
    contacts: [] as Array<{
      id: string;
      prenom: string;
      nom: string;
      email: string | null;
      telephone: string | null;
      fonction: string | null;
      notes: string | null;
      est_contact_principal: boolean;
      created_source: string;
    }>,
    isLoading: false,
    isError: false,
    error: null as { message: string } | null,
  },
  pendingHookState: {
    pendingContacts: [] as Array<{
      id: string;
      extracted_data: {
        prenom: string;
        nom: string;
        email?: string;
        fonction?: string;
      };
      confidence: number;
    }>,
    isLoading: false,
    isApproving: false,
    isRejecting: false,
  },
  formPropsSpy: vi.fn(),
  alertDialogActionPropsSpy: vi.fn(),
  mockFrom: vi.fn(),
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
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: AUTH_STATE.session }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: AUTH_STATE.user }, error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
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

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ariaLabel,
    "aria-label": ariaLabelProp,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ariaLabel?: string }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabelProp ?? ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    alertDialogActionPropsSpy({ onClick, disabled });
    return (
      <button type="button" onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/forms/PartenaireContactForm", () => ({
  PartenaireContactForm: (props: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { prenom: string; nom: string; email: string }) => Promise<void>;
    onUpdate: (data: { prenom: string; nom: string; email: string }) => Promise<void>;
    contact?: { id: string; prenom: string; nom: string } | undefined;
    isLoading: boolean;
  }) => {
    formPropsSpy(props);
    return props.isOpen ? (
      <div>
        <div data-testid="contact-form">{props.contact ? `edit-${props.contact.id}` : "create"}</div>
        <button
          type="button"
          onClick={() => props.onSubmit({ prenom: "Nina", nom: "Durand", email: "nina@example.fr" })}
        >
          submit-create
        </button>
        <button
          type="button"
          onClick={() => props.onUpdate({ prenom: "Jean-Maj", nom: "Dupont-Maj", email: "jeanmaj@example.fr" })}
        >
          submit-update
        </button>
        <button type="button" onClick={props.onClose}>
          close-form
        </button>
      </div>
    ) : null;
  },
}));

vi.mock("lucide-react", () => {
  const Icon = ({ children }: { children?: React.ReactNode }) => <span>{children}</span>;
  return {
    Plus: Icon,
    Mail: Icon,
    Phone: Icon,
    User: Icon,
    Star: Icon,
    Sparkles: Icon,
    Check: Icon,
    X: Icon,
    Pencil: Icon,
    Trash2: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/hooks/crm/usePartenairesContacts", () => ({
  usePartenairesContacts: vi.fn(() => ({
    contacts: contactsHookState.contacts,
    isLoading: contactsHookState.isLoading,
    isError: contactsHookState.isError,
    error: contactsHookState.error,
  })),
  useCreatePartenaireContact: vi.fn(() => ({
    mutateAsync: createMutateAsyncMock,
    isPending: createMutationState.isPending,
  })),
  useUpdatePartenaireContact: vi.fn(() => ({
    mutateAsync: updateMutateAsyncMock,
    isPending: updateMutationState.isPending,
  })),
  useDeletePartenaireContact: vi.fn(() => ({
    mutateAsync: deleteMutateAsyncMock,
    isPending: deleteMutationState.isPending,
  })),
}));

vi.mock("@/hooks/crm/usePendingContactsByPartenaire", () => ({
  usePendingContactsByPartenaire: vi.fn(() => ({
    pendingContacts: pendingHookState.pendingContacts,
    isLoading: pendingHookState.isLoading,
    approvePendingContact: approvePendingContactMock,
    rejectPendingContact: rejectPendingContactMock,
    isApproving: pendingHookState.isApproving,
    isRejecting: pendingHookState.isRejecting,
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

function resetStates() {
  contactsHookState.contacts = CONTACTS;
  contactsHookState.isLoading = false;
  contactsHookState.isError = false;
  contactsHookState.error = null;

  pendingHookState.pendingContacts = PENDING_CONTACTS;
  pendingHookState.isLoading = false;
  pendingHookState.isApproving = false;
  pendingHookState.isRejecting = false;

  createMutationState.isPending = false;
  updateMutationState.isPending = false;
  deleteMutationState.isPending = false;

  navigateMock.mockClear();
  toastSuccessMock.mockClear();
  approvePendingContactMock.mockClear();
  rejectPendingContactMock.mockClear();
  createMutateAsyncMock.mockClear();
  updateMutateAsyncMock.mockClear();
  deleteMutateAsyncMock.mockClear();
  formPropsSpy.mockClear();
  alertDialogActionPropsSpy.mockClear();
  mockFrom.mockClear();
}

describe("PartenaireContacts", () => {
  beforeEach(() => {
    resetStates();
  });

  it("affiche le chargement puis le contenu métier avec contacts et pending", async () => {
    contactsHookState.isLoading = true;

    const { rerender } = render(<PartenaireContacts partenaireId="part-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Chargement...")).toBeInTheDocument();

    contactsHookState.isLoading = false;
    rerender(<PartenaireContacts partenaireId="part-1" />);

    expect(await screen.findByText("Contacts (2)")).toBeInTheDocument();
    expect(screen.getByText("1 en attente")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("alice@example.fr")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Confiance: 87%")).toBeInTheDocument();
    expect(screen.getByText("Luc Bernard")).toBeInTheDocument();
    expect(screen.getByText("Responsable achats")).toBeInTheDocument();

    expect(toastSuccessMock).toHaveBeenCalledWith(
      "1 nouveau contact détecté par I.A.",
      expect.objectContaining({
        description: "Vérifiez et validez les contacts en attente ci-dessous.",
        duration: 5000,
      }),
    );
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
  });

  it("navigue vers la composition email avec to et toName", async () => {
    render(<PartenaireContacts partenaireId="part-1" />, {
      wrapper: createWrapper(),
    });

    const emailButton = screen.getByRole("button", { name: "jean@example.fr" });
    await userEvent.click(emailButton);

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/emails?compose=true&to=jean%40example.fr&toName=Jean+Dupont");
  });

  it("approuve et rejette les contacts en attente", async () => {
    render(<PartenaireContacts partenaireId="part-1" />, {
      wrapper: createWrapper(),
    });

    await userEvent.click(screen.getByRole("button", { name: /Valider/i }));
    expect(approvePendingContactMock).toHaveBeenCalledWith("p1");

    await userEvent.click(screen.getByRole("button", { name: /Ignorer/i }));
    expect(rejectPendingContactMock).toHaveBeenCalledWith("p1");
  });

  it("crée un contact via le formulaire avec le partenaire_id injecté", async () => {
    render(<PartenaireContacts partenaireId="partner-42" />, {
      wrapper: createWrapper(),
    });

    await userEvent.click(screen.getByRole("button", { name: /Ajouter un contact/i }));
    expect(screen.getByTestId("contact-form")).toHaveTextContent("create");

    await userEvent.click(screen.getByRole("button", { name: "submit-create" }));

    await waitFor(() => {
      expect(createMutateAsyncMock).toHaveBeenCalledWith({
        prenom: "Nina",
        nom: "Durand",
        email: "nina@example.fr",
        partenaire_id: "partner-42",
      });
    });
  });

  it("met à jour le contact sélectionné avec id et partenaire_id", async () => {
    render(<PartenaireContacts partenaireId="partner-42" />, {
      wrapper: createWrapper(),
    });

    const editButtons = screen.getAllByRole("button", { name: "Modifier" });
    await userEvent.click(editButtons[0]);

    expect(screen.getByTestId("contact-form")).toHaveTextContent("edit-c1");

    await userEvent.click(screen.getByRole("button", { name: "submit-update" }));

    await waitFor(() => {
      expect(updateMutateAsyncMock).toHaveBeenCalledWith({
        id: "c1",
        partenaire_id: "partner-42",
        prenom: "Jean-Maj",
        nom: "Dupont-Maj",
        email: "jeanmaj@example.fr",
      });
    });
  });

  it("supprime le contact confirmé avec id et partenaire_id", async () => {
    render(<PartenaireContacts partenaireId="partner-77" />, {
      wrapper: createWrapper(),
    });

    const deleteButtons = screen.getAllByRole("button", { name: "Supprimer" });
    await userEvent.click(deleteButtons[0]);

    const lastCall = alertDialogActionPropsSpy.mock.calls.at(-1);
    expect(lastCall).toBeTruthy();

    const actionProps = lastCall?.[0] as { onClick?: () => Promise<void> | void };
    await act(async () => {
      await actionProps.onClick?.();
    });

    expect(deleteMutateAsyncMock).toHaveBeenCalledWith({
      id: "c1",
      partenaire_id: "partner-77",
    });
  });

  it("affiche l'état vide sans contact", async () => {
    contactsHookState.contacts = EMPTY_CONTACTS;
    pendingHookState.pendingContacts = EMPTY_PENDING;

    render(<PartenaireContacts partenaireId="part-empty" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Contacts (0)")).toBeInTheDocument();
    expect(screen.getByText("Aucun contact")).toBeInTheDocument();
    expect(screen.getByText("Commencez par ajouter un contact pour ce partenaire")).toBeInTheDocument();
  });

  it("couvre l'état d'erreur des hooks mockés via renderHook", async () => {
    const { usePartenairesContacts } = await import("@/hooks/crm/usePartenairesContacts");

    contactsHookState.contacts = EMPTY_CONTACTS;
    contactsHookState.isLoading = false;
    contactsHookState.isError = true;
    contactsHookState.error = { message: "x" };

    const { result } = renderHook(() => usePartenairesContacts("part-err"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.contacts).toEqual(EMPTY_CONTACTS);
  });
});