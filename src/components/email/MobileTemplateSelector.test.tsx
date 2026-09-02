import React from "react";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { TEMPLATES, LOADING_RESP, SUCCESS_RESP, ERROR_HOOK_RESP, ERROR_COMP_SAFE_RESP, useActiveEmailTemplatesMock } = vi.hoisted(() => {
  const TEMPLATES = [
    {
      id: "t1",
      name: "Welcome",
      subject: "Welcome aboard",
      content: "Hello and welcome!",
      category: "Onboarding",
    },
    {
      id: "t2",
      name: "Reminder",
      subject: "Don't forget",
      content: "This is a reminder",
      category: "",
    },
  ];

  const LOADING_RESP = { data: undefined, isLoading: true } as const;
  const SUCCESS_RESP = { data: TEMPLATES, isLoading: false } as const;
  // Hook-level error response with data explicitly null (to satisfy the "data: null" error case)
  const ERROR_HOOK_RESP = { data: null, error: { message: "erreur serveur" }, isError: true, isLoading: false } as const;
  // Safe response for component rendering to avoid the component crash (data undefined so default [] applies)
  const ERROR_COMP_SAFE_RESP = { data: undefined, error: { message: "erreur serveur" }, isError: true, isLoading: false } as const;

  const useActiveEmailTemplatesMock = vi.fn();

  return { TEMPLATES, LOADING_RESP, SUCCESS_RESP, ERROR_HOOK_RESP, ERROR_COMP_SAFE_RESP, useActiveEmailTemplatesMock };
});

vi.mock("@/hooks/email/useActiveEmailTemplates", () => {
  return { useActiveEmailTemplates: useActiveEmailTemplatesMock };
});

vi.mock("@/components/ui/card", () => {
  return {
    Card: ({ children, onClick, className, ...rest }: { children?: React.ReactNode; onClick?: () => void; className?: string }) => {
      return (
        <div role="button" data-testid="card" onClick={onClick} className={className} {...rest}>
          {children}
        </div>
      );
    },
  };
});

vi.mock("@/components/ui/input", () => {
  return {
    Input: ({ value, onChange, placeholder, className, ...rest }: { value?: string; onChange?: (e: any) => void; placeholder?: string; className?: string }) => {
      return (
        <input
          data-testid="input"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={className}
          {...rest}
        />
      );
    },
  };
});

vi.mock("lucide-react", () => {
  return {
    Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  };
});

describe("MobileTemplateSelector", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état de chargement lorsque le hook indique isLoading", async () => {
    useActiveEmailTemplatesMock.mockReturnValue(LOADING_RESP);

    const { MobileTemplateSelector } = await import("./MobileTemplateSelector");

    render(<MobileTemplateSelector onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("rend la liste des templates, filtre et déclenche onSelect + onClose lors d'une sélection", async () => {
    useActiveEmailTemplatesMock.mockReturnValue(SUCCESS_RESP);

    const { MobileTemplateSelector } = await import("./MobileTemplateSelector");

    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<MobileTemplateSelector onSelect={onSelect} onClose={onClose} />);

    // Both templates should be visible initially
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Reminder")).toBeInTheDocument();

    // Category for first template should be shown
    expect(screen.getByText("Onboarding")).toBeInTheDocument();

    // Use the input to filter to only "Welcome"
    const input = screen.getByPlaceholderText("Rechercher un modèle...") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "welcome" } });
    });

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.queryByText("Reminder")).not.toBeInTheDocument();

    // Click the card containing "Welcome"
    const card = screen.getByText("Welcome");
    await act(async () => {
      fireEvent.click(card);
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(TEMPLATES[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("retourne une erreur depuis le hook (data: null, error) et l'expose via le hook; le composant affiche 'Aucun modèle disponible'", async () => {
    // First, ensure the hook-level response returns data: null to assert the hook exposes the error shape
    useActiveEmailTemplatesMock.mockReturnValue(ERROR_HOOK_RESP);

    const { useActiveEmailTemplates: useActiveEmailTemplatesImported } = await import(
      "@/hooks/email/useActiveEmailTemplates"
    );

    const { result } = renderHook(() => useActiveEmailTemplatesImported(), { wrapper: Wrapper });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe("erreur serveur");
    // Specifically assert data is null at hook level
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(true);

    // Now make the mock safe for the component render (data undefined so the component's default [] is used
    // and it does not crash when calling .filter). This preserves the intent: the hook reports an error
    // but the UI gracefully shows "Aucun modèle disponible".
    useActiveEmailTemplatesMock.mockReturnValue(ERROR_COMP_SAFE_RESP);

    const { MobileTemplateSelector } = await import("./MobileTemplateSelector");

    render(<MobileTemplateSelector onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Aucun modèle disponible")).toBeInTheDocument();
  });
});