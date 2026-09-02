import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { stableUser, mockToastSuccess, mockToastError, mockNavigate, mockFrom } = vi.hoisted(() => {
  const stableUser = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockNavigate = vi.fn();

  const mockFrom = vi.fn();

  return { stableUser, mockToastSuccess, mockToastError, mockNavigate, mockFrom };
});

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-icon="icon" className={className} />
  );
  return {
    Download: Icon,
    X: Icon,
    CheckSquare: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/components/ui/button", () => {
  return {
    Button: ({
      children,
      onClick,
      disabled,
      className,
      "aria-label": ariaLabel,
      size,
      variant,
      ...rest
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      size?: string;
      variant?: string;
    }) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={className}
        aria-label={ariaLabel}
        data-size={size}
        data-variant={variant}
        {...rest}
      >
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/ui/progress", () => {
  return {
    Progress: ({ value, className }: { value?: number; className?: string }) => (
      <div role="progressbar" aria-valuenow={value ?? 0} className={className} />
    ),
  };
});

vi.mock("@/lib/utils", () => {
  return {
    cn: (...args: Array<unknown>) =>
      args
        .flatMap((a) => (typeof a === "string" ? [a] : a ? [String(a)] : []))
        .join(" ")
        .trim(),
  };
});

vi.mock("sonner", () => {
  return {
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
    },
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
    const state: { response: unknown } = { response: { data: null, error: null } };

    const builder = {
      __setResponse(next: unknown) {
        state.response = next;
        return builder;
      },
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      gte() {
        return builder;
      },
      lte() {
        return builder;
      },
      in() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      insert() {
        return builder;
      },
      update() {
        return builder;
      },
      delete() {
        return builder;
      },
      single() {
        return Promise.resolve(state.response);
      },
      maybeSingle() {
        return Promise.resolve(state.response);
      },
      then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(state.response).then(onFulfilled, onRejected);
      },
      catch(onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(state.response).catch(onRejected);
      },
      finally(onFinally?: () => void) {
        return Promise.resolve(state.response).finally(onFinally);
      },
    };

    return builder;
  };

  const builder = createBuilder();
  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null }),
      },
    },
  };
});

vi.mock("@/hooks/useAuth", () => {
  return {
    useAuth: () => stableUser,
  };
});

vi.mock("@/contexts/AuthContext", () => {
  return {
    useAuth: () => stableUser,
  };
});

vi.mock("@/components/AuthProvider", () => {
  return {
    useAuth: () => stableUser,
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import { BatchSelectionBar } from "./BatchSelectionBar";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("BatchSelectionBar", () => {
  it("ne rend rien quand selectedCount=0", () => {
    const onDownload = vi.fn();
    const onClearSelection = vi.fn();

    const { container } = render(
      <BatchSelectionBar
        selectedCount={0}
        onDownload={onDownload}
        onClearSelection={onClearSelection}
        isDownloading={false}
        downloadProgress={0}
      />,
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("button", { name: "Télécharger" })).toBeNull();
  });

  it("affiche le texte et déclenche les callbacks en mode prêt", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <BatchSelectionBar
        selectedCount={2}
        onDownload={onDownload}
        onClearSelection={onClearSelection}
        isDownloading={false}
        downloadProgress={0}
        className="extra-class"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("2 fichiers sélectionnés")).toBeTruthy();

    const downloadBtn = screen.getByRole("button", { name: "Télécharger" });
    expect(downloadBtn).toHaveProperty("disabled", false);

    const closeBtn = screen.getByRole("button", { name: "Fermer" });
    expect(closeBtn).toHaveProperty("disabled", false);

    expect(screen.queryByRole("progressbar")).toBeNull();

    await user.click(downloadBtn);
    expect(onDownload).toHaveBeenCalledTimes(1);

    await user.click(closeBtn);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("mode téléchargement: bouton désactivé, texte + loader, progress visible, callbacks non déclenchés", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <BatchSelectionBar
        selectedCount={1}
        onDownload={onDownload}
        onClearSelection={onClearSelection}
        isDownloading={true}
        downloadProgress={42}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("1 fichier sélectionné")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Téléchargement..." })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveProperty("disabled", true);

    const progress = screen.getByRole("progressbar");
    expect(progress.getAttribute("aria-valuenow")).toBe("42");

    await user.click(screen.getByRole("button", { name: "Téléchargement..." }));
    await user.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onDownload).toHaveBeenCalledTimes(0);
    expect(onClearSelection).toHaveBeenCalledTimes(0);
  });
});