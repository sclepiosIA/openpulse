import { render } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScrollToTop from "./ScrollToTop";

const { mockUseLocation, mockScrollTo, mockMainContentScrollTo } = vi.hoisted(() => {
  return {
    mockUseLocation: vi.fn(),
    mockScrollTo: vi.fn(),
    mockMainContentScrollTo: vi.fn(),
  };
});

vi.mock("react-router-dom", () => ({
  useLocation: () => mockUseLocation(),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const client = createQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

describe("ScrollToTop", () => {
  let originalScrollTo: typeof window.scrollTo;

  beforeEach(() => {
    originalScrollTo = window.scrollTo;
    (window as unknown as { scrollTo: typeof mockScrollTo }).scrollTo = mockScrollTo;
    mockScrollTo.mockClear();
    mockMainContentScrollTo.mockClear();
    mockUseLocation.mockReset();
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
  });

  it("scrolls window to top on initial render", () => {
    mockUseLocation.mockReturnValue({ pathname: "/path-a" });

    render(
      <Wrapper>
        <ScrollToTop />
      </Wrapper>
    );

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
  });

  it("scrolls main-content element to top when present", () => {
    const mainContent = document.createElement("div");
    mainContent.id = "main-content";
    (mainContent as unknown as { scrollTo: typeof mockMainContentScrollTo }).scrollTo =
      mockMainContentScrollTo;
    document.body.appendChild(mainContent);

    mockUseLocation.mockReturnValue({ pathname: "/path-b" });

    render(
      <Wrapper>
        <ScrollToTop />
      </Wrapper>
    );

    expect(mockMainContentScrollTo).toHaveBeenCalledTimes(1);
    expect(mockMainContentScrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
  });

  it("does not throw if main-content element is missing", () => {
    const lookup = document.getElementById("main-content");
    if (lookup) {
      lookup.remove();
    }

    mockUseLocation.mockReturnValue({ pathname: "/path-c" });

    expect(() => {
      render(
        <Wrapper>
          <ScrollToTop />
        </Wrapper>
      );
    }).not.toThrow();
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });

  it("reacts to pathname change and scrolls again", () => {
    const sequence = [{ pathname: "/first" }, { pathname: "/second" }];
    let callIndex = 0;
    mockUseLocation.mockImplementation(() => sequence[callIndex] || sequence[sequence.length - 1]);

    const { rerender } = render(
      <Wrapper>
        <ScrollToTop />
      </Wrapper>
    );

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0 });

    callIndex = 1;
    rerender(
      <Wrapper>
        <ScrollToTop />
      </Wrapper>
    );

    expect(mockScrollTo).toHaveBeenCalledTimes(2);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0 });
  });
});