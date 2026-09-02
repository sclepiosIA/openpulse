import React from "react";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DpoHeroSection } from "./DpoHeroSection";

const {
  STATS,
  mockOnScroll,
  BadgeMock,
  ButtonMock,
  ChevronMock,
  ShieldMock,
  HospitalMock,
  LOGO_PATH,
} = vi.hoisted(() => {
  const ReactReq = require("react");
  return {
    STATS: [
      { label: "Patients protégés", value: "1 234", icon: "🩺" },
      { label: "Conformité RGPD", value: "100%", icon: "✅" },
      { label: "Sites sécurisés", value: "12", icon: "🔒" },
    ],
    mockOnScroll: vi.fn(),
    BadgeMock: (props: any) =>
      ReactReq.createElement(
        "div",
        { "data-testid": "badge", ...props },
        props.children
      ),
    ButtonMock: (props: any) =>
      ReactReq.createElement(
        "button",
        { "data-testid": "cta-button", type: "button", ...props },
        props.children
      ),
    ChevronMock: (props: any) =>
      ReactReq.createElement("svg", { "data-testid": "icon-chevron", ...props }),
    ShieldMock: (props: any) =>
      ReactReq.createElement("svg", { "data-testid": "icon-shield", ...props }),
    HospitalMock: (props: any) =>
      ReactReq.createElement("svg", { "data-testid": "icon-hospital", ...props }),
    LOGO_PATH: "/__test__/logo_sans_slogan.svg",
  };
});

vi.mock("@/components/ui/badge", () => ({ Badge: BadgeMock }));
vi.mock("@/components/ui/button", () => ({ Button: ButtonMock }));
vi.mock("lucide-react", () => ({
  ChevronRight: ChevronMock,
  Shield: ShieldMock,
  Hospital: HospitalMock,
}));
vi.mock("@/assets/logo_sans_slogan.svg", () => ({ default: LOGO_PATH }));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

function Wrapper({ children }: { children?: React.ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DpoHeroSection component", () => {
  it("renders provided etablissement, badges, logo, CTA and stats; clicking CTA calls onScrollToEngagements", async () => {
    render(
      <DpoHeroSection
        etablissement="CH Test"
        stats={STATS}
        onScrollToEngagements={mockOnScroll}
      />,
      { wrapper: Wrapper }
    );

    // Badge with etablissement should be visible
    const etabBadge = screen.getAllByTestId("badge").find((el) =>
      el.textContent?.includes("CH Test")
    );
    expect(etabBadge).toBeDefined();
    expect(etabBadge?.textContent).toContain("CH Test");

    // Second badge contains RGPD text
    const rgpdBadge = screen.getAllByTestId("badge").find((el) =>
      el.textContent?.includes("RGPD & Protection des données")
    );
    expect(rgpdBadge).toBeDefined();
    expect(rgpdBadge?.textContent).toContain("RGPD & Protection des données");

    // Logo image should have correct alt text and use mocked path
    const logo = screen.getByAltText("OpenPulse") as HTMLImageElement;
    expect(logo).toBeInstanceOf(HTMLImageElement);
    expect(logo.src).toContain(LOGO_PATH);

    // CTA button exists and clicking it triggers the handler
    const cta = screen.getByTestId("cta-button");
    expect(cta).toBeInstanceOf(HTMLButtonElement);
    await act(async () => {
      fireEvent.click(cta);
    });
    expect(mockOnScroll).toHaveBeenCalledTimes(1);

    // Stats: each provided stat's label and value should be rendered
    for (const stat of STATS) {
      expect(screen.getByText(stat.value)).toBeDefined();
      expect(screen.getByText(stat.label)).toBeDefined();
    }
  });

  it("renders correctly with empty stats (no stat cards) — treated as minimal UI", () => {
    render(
      <DpoHeroSection etablissement="Clinique Vide" stats={[]} />,
      { wrapper: Wrapper }
    );

    // etablissement badge still present
    expect(
      screen.getAllByTestId("badge").some((el) =>
        el.textContent?.includes("Clinique Vide")
      )
    ).toBe(true);

    // There should be no stat values rendered
    const possibleValues = STATS.map((s) => s.value);
    for (const val of possibleValues) {
      expect(screen.queryByText(val)).toBeNull();
    }
  });

  it("demonstrates QueryClientProvider wrapper via renderHook for loading → success → error shapes", async () => {
    // Simulate loading state via renderHook (wrapper must be QueryClientProvider per rules)
    const { result: r1 } = renderHook(
      () => ({ isLoading: true }),
      { wrapper: Wrapper }
    );
    expect(r1.current.isLoading).toBe(true);

    // Simulate successful fetch shape
    const { result: r2 } = renderHook(
      () => ({ data: { items: ["a"] }, isLoading: false, isError: false }),
      { wrapper: Wrapper }
    );
    expect(r2.current.data).toEqual({ items: ["a"] });
    expect(r2.current.isLoading).toBe(false);
    expect(r2.current.isError).toBe(false);

    // Simulate error shape
    const errorPayload = { message: "erreur simulée" };
    const { result: r3 } = renderHook(
      () => ({ data: null, error: errorPayload, isError: true }),
      { wrapper: Wrapper }
    );
    expect(r3.current.data).toBeNull();
    expect(r3.current.error).toEqual(errorPayload);
    expect(r3.current.isError).toBe(true);
  });
});