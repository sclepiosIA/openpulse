import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { FinancesRevenus } from "./FinancesRevenus";

const { CONTRATS, mockUseContrats } = vi.hoisted(() => {
  const CONTRATS = [
    {
      id: "c1",
      numero: "CT-001",
      titre: "Licence annuelle",
      statut: "actif",
      type: "licence",
      client_nom: "Clinique A",
      etablissement: { nom: "Hôpital Nord" },
      date_signature: "2024-01-15",
      montant_mensuel_ht: 1000,
      montant_annuel_ht: 12000,
    },
    {
      id: "c2",
      numero: "CT-002",
      titre: "Support premium",
      statut: "signe",
      type: "support",
      client_nom: "Client B",
      etablissement: null,
      date_signature: null,
      montant_mensuel_ht: 500,
      montant_annuel_ht: 6000,
    },
    {
      id: "c3",
      numero: "CT-003",
      titre: "Brouillon X",
      statut: "brouillon",
      type: "autre",
      client_nom: "Client C",
      etablissement: null,
      date_signature: null,
      montant_mensuel_ht: 999,
      montant_annuel_ht: 9999,
    },
  ];
  return { CONTRATS, mockUseContrats: vi.fn() };
});

vi.mock("@/hooks/contracts/useContrats", () => ({
  useContrats: mockUseContrats,
}));

vi.mock("@/components/common/PageDataState", () => ({
  PageDataState: ({
    isLoading,
    isError,
    children,
  }: {
    isLoading?: boolean;
    isError?: boolean;
    children?: ReactNode;
  }) => {
    if (isLoading) return <div data-testid="page-loading" />;
    if (isError) return <div data-testid="page-error" />;
    return <>{children}</>;
  },
}));

// Testing Library normalise les espaces (dont U+202F/U+00A0) en espace simple :
// on normalise donc aussi la chaîne attendue.
const fmt = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s/g, " ");

function renderPage() {
  return render(
    <MemoryRouter>
      <FinancesRevenus />
    </MemoryRouter>
  );
}

describe("FinancesRevenus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état de chargement quand la query est en cours", () => {
    mockUseContrats.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByTestId("page-loading")).toBeTruthy();
    expect(screen.queryByText("Revenu mensuel HT")).toBeNull();
  });

  it("affiche l'état d'erreur quand la query échoue", () => {
    mockUseContrats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("x"),
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByTestId("page-error")).toBeTruthy();
    expect(screen.queryByText("Revenu annuel HT")).toBeNull();
  });

  it("affiche les totaux et le tableau des contrats signés uniquement", () => {
    mockUseContrats.mockReturnValue({
      data: CONTRATS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    // 2 contrats signés (le brouillon est exclu)
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("Brouillon X")).toBeNull();

    // Totaux : 1000 + 500 mensuel, 12000 + 6000 annuel
    expect(screen.getByText(fmt(1500))).toBeTruthy();
    expect(screen.getByText(fmt(18000))).toBeTruthy();

    // Lignes du tableau
    expect(screen.getByText("Hôpital Nord")).toBeTruthy();
    expect(screen.getByText("Client B")).toBeTruthy();
    expect(screen.getByText("Licence annuelle")).toBeTruthy();
    expect(screen.getByText("Licence")).toBeTruthy();
    expect(screen.getByText("Support premium")).toBeTruthy();

    // Statuts traduits
    expect(screen.getByText("Actif")).toBeTruthy();
    expect(screen.getByText("Signé")).toBeTruthy();

    // Montants par ligne
    expect(screen.getByText(fmt(1000))).toBeTruthy();
    expect(screen.getByText(fmt(12000))).toBeTruthy();
    expect(screen.getByText(fmt(500))).toBeTruthy();
    expect(screen.getByText(fmt(6000))).toBeTruthy();

    // Lien vers le détail du contrat
    const link = screen.getByLabelText("Ouvrir le contrat CT-001");
    expect(link.getAttribute("href")).toBe("/contrats?contrat=c1");
  });

  it("filtre les contrats via la recherche et recalcule les totaux", () => {
    mockUseContrats.mockReturnValue({
      data: CONTRATS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    const input = screen.getByPlaceholderText("Rechercher un contrat...");
    fireEvent.change(input, { target: { value: "support" } });

    expect(screen.getByText("Support premium")).toBeTruthy();
    expect(screen.queryByText("Hôpital Nord")).toBeNull();
    // Totaux recalculés : 500 apparaît dans le total mensuel ET la ligne
    expect(screen.getAllByText(fmt(500)).length).toBe(2);
    expect(screen.getAllByText(fmt(6000)).length).toBe(2);
    expect(screen.queryByText(fmt(1500))).toBeNull();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("affiche le message dédié quand la recherche ne trouve rien", () => {
    mockUseContrats.mockReturnValue({
      data: CONTRATS,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    const input = screen.getByPlaceholderText("Rechercher un contrat...");
    fireEvent.change(input, { target: { value: "zzz-introuvable" } });

    expect(
      screen.getByText("Aucun contrat ne correspond à la recherche.")
    ).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("affiche le message vide quand aucun contrat signé n'existe", () => {
    mockUseContrats.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(
      screen.getByText("Aucun contrat signé pour le moment.")
    ).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getAllByText(fmt(0)).length).toBe(2);
  });
});