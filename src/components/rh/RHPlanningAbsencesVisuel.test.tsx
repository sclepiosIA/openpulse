import React from "react";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  MOCK_PROFILES,
  MOCK_ABSENCES,
  mockCreateAbsence,
  mockUpdateAbsence,
  mockDeleteAbsence,
  rhState,
  mockToast,
  mockDebug,
} = vi.hoisted(() => {
  const MOCK_PROFILES = [
    { id: "p1", prenom: "Jean", nom: "Dupont" },
    { id: "p2", prenom: "Marie", nom: "Curie" },
  ];

  const MOCK_ABSENCES = [
    {
      id: "a1",
      profile_id: "p1",
      date_debut: "2024-06-10",
      date_fin: "2024-06-12",
      type_absence: "Congés payés",
      motif: "Vacances familiales",
      statut: "En attente",
      profiles: { prenom: "Jean", nom: "Dupont" },
    },
    {
      id: "a2",
      profile_id: "p2",
      date_debut: "2024-06-05",
      date_fin: "2024-06-05",
      type_absence: "RTT",
      motif: null,
      statut: "Validé",
      profiles: { prenom: "Marie", nom: "Curie" },
    },
  ];

  const mockCreateAbsence = vi.fn(async (data) => ({ data }));
  const mockUpdateAbsence = vi.fn(async (data) => ({ data }));
  const mockDeleteAbsence = vi.fn(async (id) => ({ id }));

  const rhState = {
    isLoading: false,
    absences: MOCK_ABSENCES,
    createAbsence: mockCreateAbsence,
    updateAbsence: mockUpdateAbsence,
    deleteAbsence: mockDeleteAbsence,
    error: null,
  };

  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
  };

  const mockDebug = {
    error: vi.fn(),
  };

  return {
    MOCK_PROFILES,
    MOCK_ABSENCES,
    mockCreateAbsence,
    mockUpdateAbsence,
    mockDeleteAbsence,
    rhState,
    mockToast,
    mockDebug,
  };
});

// Mock sonner toast
vi.mock("sonner", () => ({ toast: mockToast }));

// Mock debug
vi.mock("@/lib/debug", () => ({ debug: mockDebug }));

// Mock hooks used by the component
vi.mock("@/hooks/hr/useRHAbsences", () => ({
  useRHAbsences: (_maybe, _start, _end) => rhState,
}));

vi.mock("@/hooks/hr/usePeopleData", () => ({
  usePeopleData: () => ({ profiles: MOCK_PROFILES }),
}));

// Mock UI components and other internal components used
vi.mock("@/components/ui/card", () => {
  const Card = ({ children, className, ...rest }) => <div data-testid="card" className={className} {...rest}>{children}</div>;
  const CardContent = ({ children, className }) => <div data-testid="card-content" className={className}>{children}</div>;
  const CardHeader = ({ children }) => <div data-testid="card-header">{children}</div>;
  const CardTitle = ({ children, className }) => <div data-testid="card-title" className={className}>{children}</div>;
  const CardDescription = ({ children }) => <div data-testid="card-description">{children}</div>;
  return { Card, CardContent, CardHeader, CardTitle, CardDescription };
});

vi.mock("@/components/ui/button", () => {
  const Button = ({ children, onClick, size, variant, asChild, ...rest }) => {
    // Render as button for tests to click
    return (
      <button data-testid="button" onClick={onClick} {...rest}>
        {children}
      </button>
    );
  };
  return { Button };
});

vi.mock("@/components/ui/badge", () => {
  const Badge = ({ children, className, variant }) => <span data-testid="badge" className={className}>{children}</span>;
  return { Badge };
});

vi.mock("@/components/ui/skeleton", () => {
  const Skeleton = ({ className }) => <div data-testid="skeleton" className={className} />;
  return { Skeleton };
});

vi.mock("@/components/ui/calendar", () => {
  const Calendar = ({ selected, onSelect, mode, className, modifiers, modifiersStyles }) => {
    // Simple calendar mock: render selected date and provide clickable day to change date
    return (
      <div data-testid="calendar" className={className}>
        <div data-testid="calendar-selected">{selected && selected.toISOString().slice(0, 10)}</div>
        <button
          data-testid="calendar-select-sample"
          onClick={() => {
            const d = new Date();
            onSelect && onSelect(d);
          }}
        >
          select
        </button>
      </div>
    );
  };
  return { Calendar };
});

vi.mock("@/components/ui/select", () => {
  const Select = ({ children, value, onValueChange }) => <div data-testid="select">{children}</div>;
  const SelectContent = ({ children }) => <div data-testid="select-content">{children}</div>;
  const SelectItem = ({ children, value }) => <div data-testid="select-item" data-value={value}>{children}</div>;
  const SelectTrigger = ({ children }) => <div data-testid="select-trigger">{children}</div>;
  const SelectValue = ({ placeholder }) => <div data-testid="select-value">{placeholder}</div>;
  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

vi.mock("@/components/ui/dialog", () => {
  const Dialog = ({ children, open, onOpenChange }) => <div data-testid="dialog">{children}</div>;
  const DialogTrigger = ({ children }) => <div data-testid="dialog-trigger">{children}</div>;
  const DialogContent = ({ children }) => <div data-testid="dialog-content">{children}</div>;
  const DialogHeader = ({ children }) => <div data-testid="dialog-header">{children}</div>;
  const DialogTitle = ({ children }) => <div data-testid="dialog-title">{children}</div>;
  const DialogDescription = ({ children }) => <div data-testid="dialog-description">{children}</div>;
  const DialogFooter = ({ children }) => <div data-testid="dialog-footer">{children}</div>;
  return { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
});

vi.mock("@/components/ui/label", () => {
  const Label = ({ children }) => <label>{children}</label>;
  return { Label };
});

vi.mock("@/components/ui/input", () => {
  const Input = (props) => <input {...props} />;
  return { Input };
});

vi.mock("@/components/ui/textarea", () => {
  const Textarea = (props) => <textarea {...props} />;
  return { Textarea };
});

// Mock lucide-react icons
vi.mock("lucide-react", () => ({ Plus: () => null, Calendar: () => null }));

// Mock any other internal modules that could be imported by the component (safe defaults)
vi.mock("@/components/ui", () => ({}));

// Ensure global confirm is stubbed and controllable
vi.stubGlobal("confirm", vi.fn(() => true));

// Now import the component under test and the mocked hook for direct renderHook assertions
import { RHPlanningAbsencesVisuel } from "./RHPlanningAbsencesVisuel";
import { useRHAbsences } from "@/hooks/hr/useRHAbsences";

// Helper to create a wrapper with fresh QueryClient as required
function createWrapper() {
  return function Wrapper({ children }) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  // Reset mocks and state to defaults
  mockCreateAbsence.mockClear();
  mockUpdateAbsence.mockClear();
  mockDeleteAbsence.mockClear();
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  mockDebug.error.mockClear();
  rhState.isLoading = false;
  rhState.absences = MOCK_ABSENCES;
  rhState.createAbsence = mockCreateAbsence;
  rhState.updateAbsence = mockUpdateAbsence;
  rhState.deleteAbsence = mockDeleteAbsence;
  rhState.error = null;
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("RHPlanningAbsencesVisuel - integration tests", () => {
  it("renders loading skeletons when hook reports loading", async () => {
    rhState.isLoading = true;
    rhState.absences = null;

    const Wrapper = createWrapper();
    render(<RHPlanningAbsencesVisuel />, { wrapper: Wrapper });

    // Header should be rendered
    const headers = screen.getAllByText("Planning des absences");
    expect(headers.length).toBeGreaterThan(0);

    // Skeletons: component renders 5 Skeleton components when loading
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(5);

    // cleanup change
    rhState.isLoading = false;
  });

  it("renders statistics and a list of absences when data is available", async () => {
    rhState.isLoading = false;
    rhState.absences = MOCK_ABSENCES;

    const Wrapper = createWrapper();
    render(<RHPlanningAbsencesVisuel />, { wrapper: Wrapper });

    // Total absences equals number of mock absences (may appear in multiple places)
    const totalMatches = screen.getAllByText(String(MOCK_ABSENCES.length));
    expect(totalMatches.length).toBeGreaterThan(0);

    // En attente count: only one in MOCK_ABSENCES
    const enAttenteCount = MOCK_ABSENCES.filter((a) => a.statut === "En attente").length;
    const enAttenteMatches = screen.getAllByText(String(enAttenteCount));
    expect(enAttenteMatches.length).toBeGreaterThan(0);

    // Validées count
    const valideCount = MOCK_ABSENCES.filter((a) => a.statut === "Validé").length;
    const valideMatches = screen.getAllByText(String(valideCount));
    expect(valideMatches.length).toBeGreaterThan(0);

    // Check that a specific absence entry is rendered with name, type and motif
    const nameMatches = screen.getAllByText("Jean Dupont");
    expect(nameMatches.length).toBeGreaterThan(0);

    const typeMatches = screen.getAllByText("Congés payés");
    expect(typeMatches.length).toBeGreaterThan(0);

    const motifMatches = screen.getAllByText("Vacances familiales");
    expect(motifMatches.length).toBeGreaterThan(0);
  });

  it("calls updateAbsence with correct payload when validating an 'En attente' absence", async () => {
    rhState.isLoading = false;
    rhState.absences = MOCK_ABSENCES;

    const Wrapper = createWrapper();
    render(<RHPlanningAbsencesVisuel />, { wrapper: Wrapper });

    // There should be a "Valider" button for the en attente absence
    const validateButtons = screen.getAllByText("Valider");
    expect(validateButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(validateButtons[0]);
    });

    await waitFor(() => {
      expect(mockUpdateAbsence).toHaveBeenCalled();
      // Expect called with id a1 and statut 'Validé'
      expect(mockUpdateAbsence).toHaveBeenCalledWith({ id: "a1", statut: "Validé" });
    });
  });

  it("calls deleteAbsence when clicking Supprimer and confirm returns true", async () => {
    rhState.isLoading = false;
    rhState.absences = MOCK_ABSENCES;
    // ensure confirm returns true
    vi.stubGlobal("confirm", vi.fn(() => true));

    const Wrapper = createWrapper();
    render(<RHPlanningAbsencesVisuel />, { wrapper: Wrapper });

    const deleteButtons = screen.getAllByText("Supprimer");
    expect(deleteButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(mockDeleteAbsence).toHaveBeenCalledWith("a1");
    });
  });

  it("exposes error object when hook returns an error (renderHook check)", async () => {
    // Simulate hook error state
    rhState.absences = null;
    rhState.error = { message: "échec de la requête" };
    rhState.isLoading = false;

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useRHAbsences(undefined, "2024-06-01", "2024-06-30"), {
      wrapper: Wrapper,
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error.message).toBe("échec de la requête");

    // component should render fallback text for no absences
    render(<RHPlanningAbsencesVisuel />, { wrapper: Wrapper });
    const noAbsenceMatches = screen.getAllByText("Aucune absence pour cette période");
    expect(noAbsenceMatches.length).toBeGreaterThan(0);

    // reset
    rhState.error = null;
    rhState.absences = MOCK_ABSENCES;
  });
});