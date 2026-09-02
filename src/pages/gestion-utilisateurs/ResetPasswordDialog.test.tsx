/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

const {
  mockMutateAsync,
  mockUseAdminResetPassword,
  mockGenerateSecurePassword,
  mockToast,
  mockUseToast,
  mockDebugError,
  clipboardWriteText,
  AUTH_STATE,
  SUPABASE_ROWS,
  mockFrom,
} = vi.hoisted(() => {
  const mutateAsync = vi.fn();
  const useAdminResetPassword = vi.fn();
  const generateSecurePassword = vi.fn();
  const toast = vi.fn();
  const useToast = vi.fn();
  const debugError = vi.fn();
  const writeText = vi.fn();

  const authState = {
    user: { id: "u1", email: "admin@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const rows = [{ id: "1" }];

  const from = vi.fn(() => {
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
      single: vi.fn(async () => ({ data: rows[0], error: null })),
      maybeSingle: vi.fn(async () => ({ data: rows[0], error: null })),
      then: (onFulfilled: (value: { data: typeof rows; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).catch(onRejected),
    };
    return builder;
  });

  return {
    mockMutateAsync: mutateAsync,
    mockUseAdminResetPassword: useAdminResetPassword,
    mockGenerateSecurePassword: generateSecurePassword,
    mockToast: toast,
    mockUseToast: useToast,
    mockDebugError: debugError,
    clipboardWriteText: writeText,
    AUTH_STATE: authState,
    SUPABASE_ROWS: rows,
    mockFrom: from,
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

vi.mock("@/hooks/auth/useAdminResetPassword", () => ({
  generateSecurePassword: mockGenerateSecurePassword,
  useAdminResetPassword: mockUseAdminResetPassword,
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: mockUseToast,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => {
  type ButtonProps = {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    ariaLabel?: string;
    "aria-label"?: string;
  };
  const Button = (props: ButtonProps) => {
    const { children, onClick, disabled, type = "button", ariaLabel } = props;
    const aria = ariaLabel ?? props["aria-label"];
    return (
      <button type={type} onClick={onClick} disabled={disabled} aria-label={aria}>
        {children}
      </button>
    );
  };
  return { Button };
});

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    type,
    minLength,
    className,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    minLength?: number;
    className?: string;
  }) => (
    <input
      aria-label="Nouveau mot de passe temporaire"
      value={value}
      onChange={onChange}
      type={type}
      minLength={minLength}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/auth/PasswordStrengthIndicator", () => ({
  PasswordStrengthIndicator: ({ password }: { password: string }) => (
    <div data-testid="password-strength">force:{password.length}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  Eye: () => <svg data-testid="icon-eye" />,
  EyeOff: () => <svg data-testid="icon-eye-off" />,
  Copy: () => <svg data-testid="icon-copy" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Key: () => <svg data-testid="icon-key" />,
  Info: () => <svg data-testid="icon-info" />,
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

describe("ResetPasswordDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockGenerateSecurePassword.mockReturnValue("Gen12#Ab");
    mockUseAdminResetPassword.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
  });

  it("affiche le contenu métier, met à jour le mot de passe, génère et copie", async () => {
    const onOpenChange = vi.fn();
    const onPasswordChange = vi.fn();

    render(
      <ResetPasswordDialog
        open={true}
        onOpenChange={onOpenChange}
        user={{ id: "user-42", prenom: "Jean", nom: "Dupont" }}
        password="Temp12#A"
        onPasswordChange={onPasswordChange}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Réinitialiser le mot de passe")).toBeInTheDocument();
    expect(
      screen.getByText("Définissez un nouveau mot de passe temporaire pour Jean Dupont")
    ).toBeInTheDocument();
    expect(
      screen.getByText("L'utilisateur devra changer ce mot de passe à sa prochaine connexion.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("password-strength")).toHaveTextContent("force:8");

    const input = screen.getByLabelText("Nouveau mot de passe temporaire") as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByLabelText("Masquer"));
    expect((screen.getByLabelText("Nouveau mot de passe temporaire") as HTMLInputElement).type).toBe("text");

    fireEvent.change(screen.getByLabelText("Nouveau mot de passe temporaire"), {
      target: { value: "Changed9#" },
    });
    expect(onPasswordChange).toHaveBeenCalledWith("Changed9#");

    fireEvent.click(screen.getByRole("button", { name: /générer/i }));
    expect(mockGenerateSecurePassword).toHaveBeenCalledWith(12);
    expect(onPasswordChange).toHaveBeenCalledWith("Gen12#Ab");

    fireEvent.click(screen.getByLabelText("Copier"));
    expect(clipboardWriteText).toHaveBeenCalledWith("Temp12#A");
    expect(mockToast).toHaveBeenCalledWith({
      title: "Copié !",
      description: "Le mot de passe a été copié dans le presse-papier",
    });
  });

  it("désactive le bouton pendant le chargement puis exécute la réinitialisation avec les bonnes valeurs", async () => {
    const onOpenChange = vi.fn();
    const onPasswordChange = vi.fn();

    const mutationState = {
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    };

    mockUseAdminResetPassword.mockReturnValue(mutationState);

    const { rerender } = render(
      <ResetPasswordDialog
        open={true}
        onOpenChange={onOpenChange}
        user={{ id: "user-42", prenom: "Jean", nom: "Dupont" }}
        password="Temp12#A"
        onPasswordChange={onPasswordChange}
      />,
      { wrapper: createWrapper() }
    );

    const loadingButton = screen.getByRole("button", { name: /réinitialisation/i });
    expect(loadingButton).toBeDisabled();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    mutationState.isPending = false;
    mockMutateAsync.mockResolvedValueOnce({ data: { success: true }, error: null });
    mockUseAdminResetPassword.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    rerender(
      <ResetPasswordDialog
        open={true}
        onOpenChange={onOpenChange}
        user={{ id: "user-42", prenom: "Jean", nom: "Dupont" }}
        password="Temp12#A"
        onPasswordChange={onPasswordChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /réinitialiser/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userId: "user-42",
        newPassword: "Temp12#A",
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onPasswordChange).toHaveBeenCalledWith("");
  });

  it("gère l'erreur de mutation sans fermer la fenêtre et journalise l'erreur", async () => {
    const onOpenChange = vi.fn();
    const onPasswordChange = vi.fn();
    const error = new Error("x");

    mockMutateAsync.mockRejectedValueOnce(error);
    mockUseAdminResetPassword.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
      error: { message: "x" },
    });

    render(
      <ResetPasswordDialog
        open={true}
        onOpenChange={onOpenChange}
        user={{ id: "user-42", prenom: "Jean", nom: "Dupont" }}
        password="Temp12#A"
        onPasswordChange={onPasswordChange}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole("button", { name: /réinitialiser/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userId: "user-42",
        newPassword: "Temp12#A",
      });
    });

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith("Error resetting password:", error);
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onPasswordChange).not.toHaveBeenCalledWith("");
  });

  it("expose un état d'erreur via le hook mocké avec renderHook et wrapper QueryClientProvider", () => {
    mockUseAdminResetPassword.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
      error: { message: "x" },
    });

    const { result } = renderHook(() => mockUseAdminResetPassword(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
  });

  it("désactive la réinitialisation si le mot de passe est vide ou trop court", () => {
    const onOpenChange = vi.fn();
    const onPasswordChange = vi.fn();

    const { rerender } = render(
      <ResetPasswordDialog
        open={true}
        onOpenChange={onOpenChange}
        user={{ id: "user-42", prenom: "Jean", nom: "Dupont" }}
        password=""
        onPasswordChange={onPasswordChange}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole("button", { name: /réinitialiser/i })).toBeDisabled();

    rerender(
      <ResetPasswordDialog
        open={true}
        onOpenChange={onOpenChange}
        user={{ id: "user-42", prenom: "Jean", nom: "Dupont" }}
        password="Court7"
        onPasswordChange={onPasswordChange}
      />
    );

    expect(screen.getByRole("button", { name: /réinitialiser/i })).toBeDisabled();
  });
});