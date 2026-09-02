/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PasswordsTabContent,
  AuthenticationTabContent,
  SessionsTabContent,
  LogsTabContent,
} from "./GestionSecuriteTabs";

const {
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const resolved = { data: null, error: null };

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
    single: vi.fn(async () => resolved),
    maybeSingle: vi.fn(async () => resolved),
    then: (resolve: (value: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve),
    catch: (reject: (reason: unknown) => unknown) => Promise.resolve(resolved).catch(reject),
  };

  return {
    AUTH_STATE: {
      user: { id: "u1", email: "test@local.dev" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => builder),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      aria-pressed={checked ? "true" : "false"}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? "on" : "off"}
    </button>
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props}>{children}</tr>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    RefreshCw: Icon,
    AlertTriangle: Icon,
    CheckCircle: Icon,
    Monitor: Icon,
    Activity: Icon,
    Globe: Icon,
    Smartphone: Icon,
    XCircle: Icon,
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
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

describe("GestionSecuriteTabs", () => {
  it("crée correctement le wrapper QueryClientProvider pour renderHook", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => 42, { wrapper });

    expect(result.current).toBe(42);
  });

  it("rend PasswordsTabContent et met à jour les champs numériques et booléens", () => {
    const updateConfig = vi.fn();
    const configState = {
      passwordMinLength: 12,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSymbols: false,
      passwordExpiration: 90,
      twoFactorRequired: false,
      sessionTimeout: 1800,
      maxLoginAttempts: 5,
      lockoutDuration: 30,
      ipWhitelistEnabled: false,
      bruteForceProtection: true,
      securityHeaders: true,
      auditLogging: true,
      loginAlerts: true,
      suspiciousActivityAlerts: true,
      passwordChangeAlerts: true,
    };

    render(<PasswordsTabContent configState={configState} updateConfig={updateConfig} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Politique des mots de passe")).toBeInTheDocument();
    expect(screen.getByText(/Les mots de passe doivent contenir au minimum 12 caractères/)).toBeInTheDocument();
    expect(screen.getByText(/des majuscules/)).toBeInTheDocument();
    expect(screen.getByText(/des minuscules/)).toBeInTheDocument();
    expect(screen.getByText(/des chiffres/)).toBeInTheDocument();
    expect(screen.queryByText(/des symboles/)).not.toBeInTheDocument();
    expect(screen.getByText(/Ils expirent après 90 jours/)).toBeInTheDocument();

    const numericInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numericInputs[0], { target: { value: "14" } });
    fireEvent.change(numericInputs[1], { target: { value: "120" } });

    const switches = screen.getAllByRole("button");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[3]);

    expect(updateConfig).toHaveBeenCalledWith("passwordMinLength", 14);
    expect(updateConfig).toHaveBeenCalledWith("passwordExpiration", 120);
    expect(updateConfig).toHaveBeenCalledWith("passwordRequireUppercase", false);
    expect(updateConfig).toHaveBeenCalledWith("passwordRequireSymbols", true);
  });

  it("rend AuthenticationTabContent et affiche la zone IP si activée", () => {
    const updateConfig = vi.fn();
    const configState = {
      passwordMinLength: 12,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSymbols: true,
      passwordExpiration: 90,
      twoFactorRequired: true,
      sessionTimeout: 3600,
      maxLoginAttempts: 3,
      lockoutDuration: 15,
      ipWhitelistEnabled: true,
      bruteForceProtection: true,
      securityHeaders: true,
      auditLogging: true,
      loginAlerts: true,
      suspiciousActivityAlerts: true,
      passwordChangeAlerts: true,
    };

    render(<AuthenticationTabContent configState={configState} updateConfig={updateConfig} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Paramètres d'authentification")).toBeInTheDocument();
    expect(screen.getByText("Adresses IP autorisées")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("192.168.1.0/24")).toBeInTheDocument();
    expect(screen.getByText("Ajouter")).toBeInTheDocument();

    const numericInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numericInputs[0], { target: { value: "7200" } });
    fireEvent.change(numericInputs[1], { target: { value: "6" } });
    fireEvent.change(numericInputs[2], { target: { value: "45" } });

    const switches = screen.getAllByRole("button");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);

    expect(updateConfig).toHaveBeenCalledWith("sessionTimeout", 7200);
    expect(updateConfig).toHaveBeenCalledWith("maxLoginAttempts", 6);
    expect(updateConfig).toHaveBeenCalledWith("lockoutDuration", 45);
    expect(updateConfig).toHaveBeenCalledWith("twoFactorRequired", false);
    expect(updateConfig).toHaveBeenCalledWith("ipWhitelistEnabled", false);
  });

  it("rend SessionsTabContent en état de chargement", () => {
    render(
      <SessionsTabContent sessionsLoading userSessions={undefined} onTerminate={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Chargement des sessions...")).toBeInTheDocument();
  });

  it("rend SessionsTabContent vide sans session active", () => {
    render(
      <SessionsTabContent sessionsLoading={false} userSessions={[]} onTerminate={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Aucune session active")).toBeInTheDocument();
    expect(
      screen.getByText("Les sessions apparaîtront ici lors des connexions utilisateurs authentifiés"),
    ).toBeInTheDocument();
  });

  it("rend SessionsTabContent avec des sessions et termine une session utilisateur", () => {
    const onTerminate = vi.fn();
    const userSessions = [
      {
        id: "s1",
        userId: "u1",
        userName: "Alice Martin",
        email: "alice@example.dev",
        deviceType: "mobile",
        ipAddress: "10.0.0.1",
        location: "Paris",
        sessionStart: "2024-01-02T10:00:00.000Z",
        lastActivity: "2024-01-02T10:05:00.000Z",
      },
      {
        id: "s2",
        userId: "u2",
        userName: "Bob Durand",
        email: "bob@example.dev",
        deviceType: "desktop",
        ipAddress: "10.0.0.2",
        location: "Lyon",
        sessionStart: "2024-01-03T09:00:00.000Z",
        lastActivity: "2024-01-03T09:10:00.000Z",
      },
    ];

    render(
      <SessionsTabContent sessionsLoading={false} userSessions={userSessions} onTerminate={onTerminate} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Sessions utilisateurs actives")).toBeInTheDocument();
    expect(screen.getByText("2 sessions")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("bob@example.dev")).toBeInTheDocument();
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("IP: 10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("📍 Paris")).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", { name: "Terminer la session" });
    fireEvent.click(confirmButtons[0]);

    expect(onTerminate).toHaveBeenCalledTimes(1);
    expect(onTerminate).toHaveBeenCalledWith("u1");
  });

  it("rend LogsTabContent vide sans logs", () => {
    render(<LogsTabContent securityLogs={[]} onBlockIP={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Aucun log de sécurité")).toBeInTheDocument();
    expect(screen.getByText("Les événements de sécurité apparaîtront ici")).toBeInTheDocument();
  });

  it("rend LogsTabContent avec des logs et bloque une IP à haut risque", () => {
    const onBlockIP = vi.fn();
    const securityLogs = [
      {
        id: "l1",
        created_at: "2024-02-01T08:30:00.000Z",
        log_type: "failed_login",
        risk_level: "high",
        profiles: { prenom: "Jean", nom: "Dupont" },
        user_email: "jean@example.dev",
        ip_address: "203.0.113.5",
        location: "Marseille",
        user_agent: "Firefox",
      },
      {
        id: "l2",
        created_at: "2024-02-01T09:00:00.000Z",
        log_type: "login",
        risk_level: "low",
        profiles: null,
        user_email: "claire@example.dev",
        ip_address: "198.51.100.8",
        location: null,
        user_agent: null,
      },
    ];

    render(<LogsTabContent securityLogs={securityLogs} onBlockIP={onBlockIP} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Échec connexion")).toBeInTheDocument();
    expect(screen.getByText("Connexion")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("claire@example.dev")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.5")).toBeInTheDocument();
    expect(screen.getByText("Marseille")).toBeInTheDocument();
    expect(screen.getAllByText("N/A")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Bloquer IP" }));

    expect(onBlockIP).toHaveBeenCalledTimes(1);
    expect(onBlockIP).toHaveBeenCalledWith("203.0.113.5");
  });
});