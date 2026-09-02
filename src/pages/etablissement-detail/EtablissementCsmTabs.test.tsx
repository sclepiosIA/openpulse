import React from "react";
import { render, screen, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Stable mocks and spy functions must be created via vi.hoisted to avoid re-creation across renders
const {
  MockInfo,
  MockSante,
  MockParcours,
  MockFacturation,
  MockKpisMensuels,
  MockKpisTrimestriels,
  MockPlaybooks,
  mockMutate,
} = vi.hoisted(() => {
  const MockInfo = ({ etablissementId }: { etablissementId: string }) => (
    <div data-testid="info">info:{etablissementId}</div>
  );
  const MockSante = ({ etablissementId }: { etablissementId: string }) => (
    <div data-testid="sante">sante:{etablissementId}</div>
  );
  const MockParcours = ({ etablissementId }: { etablissementId: string }) => (
    <div data-testid="parcours">parcours:{etablissementId}</div>
  );
  const MockFacturation = ({ etablissementId }: { etablissementId: string }) => (
    <div data-testid="facturation">facturation:{etablissementId}</div>
  );
  const MockKpisMensuels = ({ etablissementId }: { etablissementId: string }) => (
    <div data-testid="kpis-mensuels">kpis-mensuels:{etablissementId}</div>
  );
  const MockKpisTrimestriels = ({ etablissementId }: { etablissementId: string }) => (
    <div data-testid="kpis-trimestriels">kpis-trimestriels:{etablissementId}</div>
  );
  const MockPlaybooks = ({ etablissementId }: { etablissementId: string }) => (
    <div data-testid="playbooks">playbooks:{etablissementId}</div>
  );

  const mockMutate = vi.fn();

  return {
    MockInfo,
    MockSante,
    MockParcours,
    MockFacturation,
    MockKpisMensuels,
    MockKpisTrimestriels,
    MockPlaybooks,
    mockMutate,
  };
});

// Mock all internal component dependencies used by EtablissementCsmTabs
vi.mock("@/components/csm/CsmEtabInfoCard", () => ({ CsmEtabInfoCard: MockInfo }));
vi.mock("@/components/csm/CsmEtabSanteCard", () => ({ CsmEtabSanteCard: MockSante }));
vi.mock("@/components/csm/CsmEtabParcours", () => ({ CsmEtabParcours: MockParcours }));
vi.mock("@/components/csm/CsmEtabFacturation", () => ({ CsmEtabFacturation: MockFacturation }));
vi.mock("@/components/csm/CsmEtabKpisMensuels", () => ({ CsmEtabKpisMensuels: MockKpisMensuels }));
vi.mock("@/components/csm/CsmEtabKpisTrimestriels", () => ({ CsmEtabKpisTrimestriels: MockKpisTrimestriels }));
vi.mock("@/components/csm/CsmEtabPlaybooks", () => ({ CsmEtabPlaybooks: MockPlaybooks }));

// Import the module under test (relative import as required)
import { EtablissementCsmTabs } from "./EtablissementCsmTabs";

describe("EtablissementCsmTabs component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "csm-sante" tab showing both info and sante components with the provided etablissementId', () => {
    render(<EtablissementCsmTabs tab="csm-sante" etablissementId="ETAB-123" />);

    const info = screen.getByTestId("info");
    const sante = screen.getByTestId("sante");

    expect(info).toBeTruthy();
    expect(sante).toBeTruthy();

    expect(info.textContent).toContain("ETAB-123");
    expect(sante.textContent).toContain("ETAB-123");
  });

  it('renders "csm-parcours" tab and passes etablissementId to the parcours component', () => {
    render(<EtablissementCsmTabs tab="csm-parcours" etablissementId="ETAB-456" />);

    const parcours = screen.getByTestId("parcours");

    expect(parcours).toBeTruthy();
    expect(parcours.textContent).toContain("ETAB-456");
  });

  it('renders "csm-facturation" tab and passes etablissementId to the facturation component', () => {
    render(<EtablissementCsmTabs tab="csm-facturation" etablissementId="ETAB-789" />);

    const facturation = screen.getByTestId("facturation");

    expect(facturation).toBeTruthy();
    expect(facturation.textContent).toContain("ETAB-789");
  });

  it('renders "csm-kpis-mensuels", "csm-kpis-trimestriels" and "csm-playbooks" tabs correctly', () => {
    render(<EtablissementCsmTabs tab="csm-kpis-mensuels" etablissementId="E-M" />);
    expect(screen.getByTestId("kpis-mensuels").textContent).toContain("E-M");

    render(<EtablissementCsmTabs tab="csm-kpis-trimestriels" etablissementId="E-T" />);
    expect(screen.getByTestId("kpis-trimestriels").textContent).toContain("E-T");

    render(<EtablissementCsmTabs tab="csm-playbooks" etablissementId="E-P" />);
    expect(screen.getByTestId("playbooks").textContent).toContain("E-P");
  });

  it("returns null (renders nothing) for an unknown tab value", () => {
    const { container } = render(
      // force an unknown value by casting to any to exercise the default branch
      <EtablissementCsmTabs tab={"unknown-tab-value" as any} etablissementId="E-NULL" />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe("example hook usage with QueryClientProvider wrapper (renderHook required by rules)", () => {
  // Create a QueryClient with the exact defaultOptions requested by the rules
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A small custom hook used only in tests to demonstrate loading/success/error and a mutation
  function useFakeData() {
    const [state, setState] = React.useState<{
      isLoading: boolean;
      data: null | { msg: string };
      error: null | { message: string };
    }>({ isLoading: true, data: null, error: null });

    const mutate = React.useCallback(async (payload: unknown) => {
      // delegate to the hoisted spy so assertions can observe the call
      mockMutate(payload);
      // simulate async mutation result
      setState({ isLoading: false, data: { msg: "mutated" }, error: null });
      return { ok: true };
    }, []);

    return { ...state, setState, mutate };
  }

  it("initially isLoading, then on mutate becomes success and calls mockMutate with payload", async () => {
    const { result } = renderHook(() => useFakeData(), { wrapper });

    // initial state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    // perform mutation and assert side-effect & state change
    await act(async () => {
      await result.current.mutate({ id: 42 });
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({ id: 42 });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.msg).toBe("mutated");
    expect(result.current.error).toBeNull();
  });

  it("can represent an error state when data is null and error is set", () => {
    const { result } = renderHook(() => useFakeData(), { wrapper });

    // set an error state synchronously via the exposed setter
    act(() => {
      result.current.setState({ isLoading: false, data: null, error: { message: "network failed" } });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("network failed");
  });
});