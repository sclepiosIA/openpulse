// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { PendingContactsValidation } from "./PendingContactsValidation";

const {
  PENDING_CONTACTS,
  ETABLISSEMENTS,
  PARTENAIRES,
  GROUPES,
  AUTH_STATE,
  approveMutate,
  rejectMutate,
  sanitizeEmailSubjectMock,
  mockFrom,
} = vi.hoisted(() => ({
  PENDING_CONTACTS: [
    {
      id: "pc-1",
      confidence: 0.84,
      extracted_data: {
        nom: "Dupont",
        prenom: "Jean",
        fonction: "Directeur",
        email: "jean.dupont@example.fr",
        telephone: "0102030405",
      },
      etablissement_id: "etab-1",
      partenaire_id: null,
      groupe_id: null,
      etablissements: { nom: "Lycée A" },
      partenaires: null,
      groupes_etablissements: null,
      email_threads: { subject: "Re: Contact candidat" },
    },
    {
      id: "pc-2",
      confidence: 0.93,
      extracted_data: {
        nom: "Martin",
        prenom: "Claire",
        fonction: "",
        email: "",
        telephone: "",
      },
      etablissement_id: null,
      partenaire_id: "part-1",
      groupe_id: null,
      etablissements: null,
      partenaires: { nom: "Partenaire B" },
      groupes_etablissements: null,
      email_threads: null,
    },
  ],
  ETABLISSEMENTS: [{ id: "etab-1", nom: "Lycée A", ville: "Paris" }],
  PARTENAIRES: [{ id: "part-1", nom: "Partenaire B" }],
  GROUPES: [{ id: "grp-1", nom: "Groupe C" }],
  AUTH_STATE: {
    user: { id: "u-1", email: "user@test.local" },
    session: { user: { id: "u-1" } },
    isLoading: false,
  },
  approveMutate: vi.fn(),
  rejectMutate: vi.fn(),
  sanitizeEmailSubjectMock: vi.fn((subject: string) => `Sujet nettoyé: ${subject}`),
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    catch: vi.fn(() => Promise.resolve(result)),
  };
  mockFrom.mockReturnValue(builder);
  return { supabase: { from: mockFrom } };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/crm/usePendingContacts", () => ({
  usePendingContacts: vi.fn(),
  useApprovePendingContact: vi.fn(),
  useRejectPendingContact: vi.fn(),
}));

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissements: vi.fn(),
}));

vi.mock("@/hooks/crm/usePartenaires", () => ({
  usePartenaires: vi.fn(),
}));

vi.mock("@/hooks/crm/useGroupes", () => ({
  useGroupes: vi.fn(),
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: sanitizeEmailSubjectMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormField: ({
    render,
    name,
    control,
  }: {
    render: (props: { field: { value: string; onChange: (value: string) => void; name: string } }) => React.ReactNode;
    name: string;
    control: {
      _values?: Record<string, string>;
      _setValue?: (name: string, value: string) => void;
    };
  }) => {
    const value = control._values?.[name] ?? "";
    const onChange = (next: string) => {
      control._setValue?.(name, next);
    };
    return <>{render({ field: { value, onChange, name } })}</>;
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  FormMessage: () => null,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => <input value={value ?? ""} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
  }) => <textarea value={value ?? ""} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
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
    <select data-testid="select" value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return {
    CheckCircle2: Icon,
    XCircle: Icon,
    Edit: Icon,
    Mail: Icon,
    Building2: Icon,
    Users: Icon,
    AlertCircle: Icon,
  };
});

vi.mock("react-hook-form", () => ({
  useForm: (options?: { defaultValues?: Record<string, string> }) => {
    let values = { ...(options?.defaultValues ?? {}) };
    const control = {
      _values: values,
      _setValue: (name: string, value: string) => {
        values = { ...values, [name]: value };
        control._values = values;
      },
    };
    return {
      control,
      reset: (next?: Record<string, string>) => {
        values = {
          nom: "",
          prenom: "",
          fonction: "",
          email: "",
          telephone: "",
          entityType: "etablissement",
          etablissementId: "",
          partenaireId: "",
          groupeId: "",
          ...(next ?? {}),
        };
        control._values = values;
      },
      handleSubmit:
        (callback: (data: Record<string, string>) => void) => (event?: React.FormEvent<HTMLFormElement>) => {
          event?.preventDefault();
          callback(values);
        },
    };
  },
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: vi.fn(),
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

describe("PendingContactsValidation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const pendingContactsModule = await import("@/hooks/crm/usePendingContacts");
    const etablissementsModule = await import("@/hooks/crm/useEtablissements");
    const partenairesModule = await import("@/hooks/crm/usePartenaires");
    const groupesModule = await import("@/hooks/crm/useGroupes");

    vi.mocked(pendingContactsModule.usePendingContacts).mockReturnValue({
      data: PENDING_CONTACTS,
      isLoading: false,
      isError: false,
      error: null,
    });

    vi.mocked(pendingContactsModule.useApprovePendingContact).mockReturnValue({
      mutate: approveMutate,
      isPending: false,
    });

    vi.mocked(pendingContactsModule.useRejectPendingContact).mockReturnValue({
      mutate: rejectMutate,
      isPending: false,
    });

    vi.mocked(etablissementsModule.useEtablissements).mockReturnValue({
      data: ETABLISSEMENTS,
      isLoading: false,
    });

    vi.mocked(partenairesModule.usePartenaires).mockReturnValue({
      data: PARTENAIRES,
      isLoading: false,
    });

    vi.mocked(groupesModule.useGroupes).mockReturnValue({
      data: GROUPES,
      isLoading: false,
    });
  });

  it("configure correctement le wrapper QueryClientProvider pour renderHook", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 42, { wrapper });
    expect(result.current).toBe(42);
  });

  it("affiche l'état de chargement avec des skeletons", async () => {
    const pendingContactsModule = await import("@/hooks/crm/usePendingContacts");
    vi.mocked(pendingContactsModule.usePendingContacts).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<PendingContactsValidation />, { wrapper: createWrapper() });

    expect(screen.getAllByTestId("skeleton")).toHaveLength(4);
  });

  it("affiche les contacts en attente avec les valeurs métier réelles", () => {
    render(<PendingContactsValidation />, { wrapper: createWrapper() });

    expect(screen.getByText("Contacts en attente de validation")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Moyenne (84%)")).toBeInTheDocument();
    expect(screen.getByText("Directeur")).toBeInTheDocument();
    expect(screen.getByText("Lycée A")).toBeInTheDocument();
    expect(screen.getByText("Sujet nettoyé: Re: Contact candidat")).toBeInTheDocument();
    expect(screen.getByText("jean.dupont@example.fr")).toBeInTheDocument();
    expect(screen.getByText("0102030405")).toBeInTheDocument();
    expect(screen.getByText("Claire Martin")).toBeInTheDocument();
    expect(screen.getByText("Élevée (93%)")).toBeInTheDocument();
    expect(screen.getByText("Partenaire B")).toBeInTheDocument();
    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith("Re: Contact candidat");
  });

  it("déclenche l'approbation directe avec les données extraites du contact", async () => {
    render(<PendingContactsValidation />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByRole("button", { name: /approuver/i })[0]);

    await waitFor(() => {
      expect(approveMutate).toHaveBeenCalledWith({
        id: "pc-1",
        contactData: PENDING_CONTACTS[0].extracted_data,
      });
    });
  });

  it("ouvre le rejet et confirme avec la raison par défaut", async () => {
    render(<PendingContactsValidation />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByRole("button", { name: /^rejeter$/i })[0]);

    expect(screen.getByText("Rejeter le contact")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Raison du rejet...")).toBeInTheDocument();

    const dialogRejectButton = screen.getAllByRole("button", { name: /^rejeter$/i })[2];
    fireEvent.click(dialogRejectButton);

    await waitFor(() => {
      expect(rejectMutate).toHaveBeenCalledTimes(1);
      expect(rejectMutate.mock.calls[0]?.[0]).toEqual({
        id: "pc-1",
        reason: "Non spécifié",
      });
      expect(rejectMutate.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      );
    });
  });

  it("affiche l'état vide quand aucun contact n'est en attente", async () => {
    const pendingContactsModule = await import("@/hooks/crm/usePendingContacts");
    vi.mocked(pendingContactsModule.usePendingContacts).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<PendingContactsValidation />, { wrapper: createWrapper() });

    expect(screen.getByText("Aucun contact en attente de validation")).toBeInTheDocument();
  });

  it("couvre le cas d'erreur du hook avec isError et error.message", async () => {
    const pendingContactsModule = await import("@/hooks/crm/usePendingContacts");
    vi.mocked(pendingContactsModule.usePendingContacts).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    render(<PendingContactsValidation />, { wrapper: createWrapper() });

    expect(screen.getByText("Aucun contact en attente de validation")).toBeInTheDocument();
  });
});