import React from "react";
import { render, screen, fireEvent, act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { EmailContent } from "./EmailContent";

const {
  sanitizedHtmlBlocked,
  sanitizedHtmlNoImages,
  sanitizeEmailHtmlMock,
  sanitizeEmailTextMock,
  MockButton,
  EyeComp,
  EyeOffComp,
  FileTextComp,
  authState,
  mockFrom
} = vi.hoisted(() => {
  const sanitizedHtmlBlocked = '<div>Hello<img data-original-src="http://example.test/img.png" alt="img"/></div>';
  const sanitizedHtmlNoImages = '<div>Hello<img src="http://example.test/img.png" alt="img"/></div>';

  const sanitizeEmailHtmlMock = vi.fn((html: string) => {
    if (typeof html === "string" && html.includes("blocked")) {
      return sanitizedHtmlBlocked;
    }
    return sanitizedHtmlNoImages;
  });

  const sanitizeEmailTextMock = vi.fn((t: string) => {
    const safe = String(t ?? "");
    return `<div class="sanitized-text">${safe.replace(/\n/g, "<br/>")}</div>`;
  });

  const MockButton: React.FC<{
    children?: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }> = ({ children, onClick, ...rest }) =>
    React.createElement("button", { onClick, ...rest }, children);

  const IconFactory = (name: string) => (props: { children?: React.ReactNode }) =>
    React.createElement("span", { "data-icon": name }, props.children);

  const EyeComp = IconFactory("Eye");
  const EyeOffComp = IconFactory("EyeOff");
  const FileTextComp = IconFactory("FileText");

  const authState = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
    isAdmin: true
  };

  interface BuilderType {
    __response: unknown;
    select: () => BuilderType;
    eq: () => BuilderType;
    gte: () => BuilderType;
    lte: () => BuilderType;
    in: () => BuilderType;
    order: () => BuilderType;
    limit: () => BuilderType;
    insert: () => BuilderType;
    update: () => BuilderType;
    delete: () => BuilderType;
    single: () => Promise<unknown>;
    maybeSingle: () => Promise<unknown>;
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (fn?: (reason: unknown) => unknown) => Promise<unknown>;
  }

  const response = { data: [{ id: "1", name: "r1" }], error: null };

  const builder: BuilderType = {
    __response: response,
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    lte() { return this; },
    in() { return this; },
    order() { return this; },
    limit() { return this; },
    insert() { return this; },
    update() { return this; },
    delete() { return this; },
    single() { return Promise.resolve(this.__response); },
    maybeSingle() { return Promise.resolve(this.__response); },
    then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(this.__response).then(onFulfilled, onRejected);
    },
    catch(fn?: (reason: unknown) => unknown) {
      return Promise.resolve(this.__response).catch(fn);
    }
  };

  const mockFromFn = vi.fn(() => builder) as unknown as (table: string) => BuilderType;

  return {
    sanitizedHtmlBlocked,
    sanitizedHtmlNoImages,
    sanitizeEmailHtmlMock,
    sanitizeEmailTextMock,
    MockButton,
    EyeComp,
    EyeOffComp,
    FileTextComp,
    authState,
    mockFrom: mockFromFn
  };
});

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailHtml: sanitizeEmailHtmlMock,
  sanitizeEmailText: sanitizeEmailTextMock
}));

vi.mock("@/components/ui/button", () => ({
  Button: MockButton
}));

vi.mock("lucide-react", () => ({
  Eye: EyeComp,
  EyeOff: EyeOffComp,
  FileText: FileTextComp
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom }
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock("react-router", () => ({
  useNavigate: vi.fn()
}));

describe("EmailContent component", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  });

  const Wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders fallback message when no content provided", () => {
    render(React.createElement(EmailContent, {}), { wrapper: Wrapper });
    expect(screen.getByText("Aucun contenu disponible")).toBeTruthy();
  });

  it("renders sanitized plain text when only textContent is provided", () => {
    const plain = "Hello & world\nSecond line";
    render(React.createElement(EmailContent, { textContent: plain, className: "extra-class" }), { wrapper: Wrapper });
    expect(sanitizeEmailTextMock).toHaveBeenCalledWith(plain);
    const el = screen.getByText("Hello & world", { exact: false });
    expect(el).toBeTruthy();
    const container = el.closest(".email-content");
    expect(container).toBeTruthy();
    expect(container?.className).toContain("extra-class");
  });

  it("renders HTML content with blocked images and allows showing external images", async () => {
    render(React.createElement(EmailContent, { htmlContent: "this is blocked html", textContent: "Plain text" }), { wrapper: Wrapper });

    expect(sanitizeEmailHtmlMock).toHaveBeenCalledWith("this is blocked html");

    expect(screen.getByText(/Les images externes sont bloquées pour votre sécurité/)).toBeTruthy();

    const showBtn = screen.getByText("Afficher les images");
    expect(showBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(showBtn);
    });

    expect(screen.getByText("Masquer les images")).toBeTruthy();

    const img = document.querySelector(".email-content img") as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("http://example.test/img.png");
  });

  it("allows toggling to plain text view when both html and text are provided, then back to HTML", async () => {
    render(React.createElement(EmailContent, { htmlContent: "blocked", textContent: "Plain toggled text" }), { wrapper: Wrapper });

    const plainBtn = screen.getByText("Texte brut");
    expect(plainBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(plainBtn);
    });

    expect(sanitizeEmailTextMock).toHaveBeenCalledWith("Plain toggled text");
    expect(screen.getByText("Plain toggled text")).toBeTruthy();

    const backBtn = screen.getByText("Afficher en HTML");
    expect(backBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(screen.getByText(/Les images externes sont bloquées pour votre sécurité/)).toBeTruthy();
  });

  it("works with react-query: shows loading -> success then shows error on rejection", async () => {
    const useTestQuery = (shouldFail = false) =>
      useQuery({
        queryKey: ["test", shouldFail],
        queryFn: async () => {
          if (shouldFail) {
            throw new Error("simulated failure");
          }
          return { ok: true, value: 123 };
        }
      });

    const hookWrapper = ({ children }: { children?: React.ReactNode }) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 }
        }
      });
      return React.createElement(QueryClientProvider, { client }, children);
    };

    const { result: resultSuccess } = renderHook(() => useTestQuery(false), { wrapper: hookWrapper });
    expect(resultSuccess.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(resultSuccess.current.isSuccess).toBe(true);
      expect(resultSuccess.current.data).toEqual({ ok: true, value: 123 });
    });

    const { result: resultError } = renderHook(() => useTestQuery(true), { wrapper: hookWrapper });
    expect(resultError.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(resultError.current.isError).toBe(true);
      expect(resultError.current.error).toBeTruthy();
      const err = resultError.current.error as Error;
      expect(err.message).toBe("simulated failure");
    });
  });
});