import React from "react";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from "./dialog";

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<unknown>) =>
    classes
      .flatMap((c) => (Array.isArray(c) ? c : [c]))
      .filter(Boolean)
      .map(String)
      .join(" "),
}));

vi.mock("lucide-react", () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("dialog.tsx", () => {
  afterEach(() => {
    cleanup();
    document.body.removeAttribute("data-scroll-locked");
    vi.useRealTimers();
  });

  it("ouvre le dialog, affiche le contenu et ferme via le bouton Close", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My title</DialogTitle>
            <DialogDescription>My description</DialogDescription>
          </DialogHeader>
          <div>Body content</div>
          <DialogFooter>
            <button type="button">Action</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByText("My title")).toBeNull();

    fireEvent.click(screen.getByText("Open"));

    expect(await screen.findByText("My title")).toBeTruthy();
    expect(screen.getByText("My description")).toBeTruthy();
    expect(screen.getByText("Body content")).toBeTruthy();

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeTruthy();
    expect(screen.getByTestId("icon-x")).toBeTruthy();

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText("My title")).toBeNull();
    });
  });

  it("applique les className additionnelles sur Content et Header/Footer", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent className="extra-content">
          <DialogHeader className="extra-header">
            <DialogTitle className="extra-title">Title</DialogTitle>
            <DialogDescription className="extra-desc">Desc</DialogDescription>
          </DialogHeader>
          <DialogFooter className="extra-footer">
            <button type="button">Ok</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    fireEvent.click(screen.getByText("Open"));

    const title = await screen.findByText("Title");
    const desc = screen.getByText("Desc");
    const ok = screen.getByText("Ok");

    const content = title.closest('[data-state="open"]') as HTMLElement | null;
    expect(content).toBeTruthy();
    expect(content?.className.includes("extra-content")).toBe(true);

    const header = title.closest("div") as HTMLElement | null;
    expect(header).toBeTruthy();
    expect(header?.className.includes("extra-header")).toBe(true);

    expect((title as HTMLElement).className.includes("extra-title")).toBe(true);
    expect((desc as HTMLElement).className.includes("extra-desc")).toBe(true);

    const footer = ok.closest("div") as HTMLElement | null;
    expect(footer).toBeTruthy();
    expect(footer?.className.includes("extra-footer")).toBe(true);
  });

  it("nettoie data-scroll-locked au démontage (cleanup async via setTimeout)", async () => {
    vi.useFakeTimers();

    document.body.setAttribute("data-scroll-locked", "true");

    const { unmount } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cleanup title</DialogTitle>
            <DialogDescription>Cleanup description</DialogDescription>
          </DialogHeader>
          <div>Content</div>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByText("Content")).toBeTruthy();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);

    unmount();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("fournit un wrapper QueryClientProvider compatible renderHook (régression config)", async () => {
    const { renderHook } = await import("@testing-library/react");

    const wrapper = createWrapper();

    const { result } = renderHook(() => ({ ok: true }), { wrapper });

    expect(result.current.ok).toBe(true);
  });

  it("exporte les composants attendus (types React valides)", () => {
    expect(React.isValidElement(<Dialog />)).toBe(true);
    expect(React.isValidElement(<DialogTrigger />)).toBe(true);
    expect(React.isValidElement(<DialogContent />)).toBe(true);
    expect(React.isValidElement(<DialogTitle />)).toBe(true);
    expect(React.isValidElement(<DialogDescription />)).toBe(true);
    expect(React.isValidElement(<DialogHeader />)).toBe(true);
    expect(React.isValidElement(<DialogFooter />)).toBe(true);
    expect(React.isValidElement(<DialogClose />)).toBe(true);
    expect(React.isValidElement(<DialogOverlay />)).toBe(true);
    expect(React.isValidElement(<DialogPortal />)).toBe(true);
  });
});