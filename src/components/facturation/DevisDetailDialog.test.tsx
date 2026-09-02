import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DevisDetailDialog } from "./DevisDetailDialog";

const { STABLE_DEVIS, useDevisDetailMock, createFactureMock, useFacturesMock, toastMock } = vi.hoisted(() => {
  const STABLE_DEVIS = {
    id: "d1",
    numero: "DEV-001",
    statut: "accepte",
    date_emission: "2024-01-10",
    date_validite: "2024-02-10",
    client_nom: "ACME",
    client_adresse: "1 rue test",
    client_email: "client@example.test",
    client_siret: "123 456 789 00012",
    etablissement_id: "e1",
    groupe_id: "g1",
    partenaire_id: "p1",
    contact_id: "c1",
    conditions_paiement: "30 jours",
    notes_internes: "Note interne",
    notes_client: "Note client",
    facture_id: null as string | null,
    commercial_id: "u2",
    partenaire_id: "p1",
    etablissement: { nom: "Etab A" },
    commercial: { first_name: "Jean", last_name: "Dupont" },
    lignes: [
      {
        id: "l1",
        designation: "Prestation A",
        description: "Détails",
        quantite: 2,
        unite: "h",
        prix_unitaire_ht: 50,
        taux_tva: 20,
        remise_pourcent: 0,
        montant_ht: 100,
        montant_tva: 20,
        montant_ttc: 120,
        produit_id: "pr1",
      },
    ],
    montant_ht: 100,
    montant_tva: 20,
    montant_ttc: 120,
  };

  const useDevisDetailMock = vi.fn<
    (id: string | undefined) => {
      data: typeof STABLE_DEVIS | null;
      isLoading: boolean;
      isError?: boolean;
      error?: { message: string } | null;
    }
  >();

  const createFactureMock = vi.fn<(payload: unknown) => Promise<unknown>>();
  const useFacturesMock = vi.fn<() => { createFacture: typeof createFactureMock; isCreating: boolean }>();

  const toastMock = { error: vi.fn<(msg: string) => void>(), success: vi.fn<(msg: string) => void>() };

  return { STABLE_DEVIS, useDevisDetailMock, createFactureMock, useFacturesMock, toastMock };
});

vi.mock("@/hooks/contracts/useDevis", () => ({
  useDevisDetail: (id: string | undefined) => useDevisDetailMock(id),
}));

vi.mock("@/hooks/billing/useFactures", () => ({
  useFactures: () => useFacturesMock(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/types/facturation", () => ({
  DEVIS_STATUT_LABELS: {
    accepte: "Accepté",
    brouillon: "Brouillon",
    envoye: "Envoyé",
    refuse: "Refusé",
  },
  DEVIS_STATUT_COLORS: {
    accepte: "bg-green",
    brouillon: "bg-gray",
    envoye: "bg-blue",
    refuse: "bg-red",
  },
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader2" {...props} />,
  FileText: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-filetext" {...props} />,
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-arrowright" {...props} />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; onOpenChange?: (o: boolean) => void; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode; className?: string }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant ?? ""} disabled={!!disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" data-class={className ?? ""}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr data-testid="separator" />,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement, client?: QueryClient) {
  const qc = client ?? createTestQueryClient();
  return { qc, ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>) };
}

describe("DevisDetailDialog", () => {
  it("affiche le loader pendant le chargement puis les infos du devis", () => {
    const client = createTestQueryClient();
    useFacturesMock.mockReturnValue({ createFacture: createFactureMock, isCreating: false });

    const onOpenChange = vi.fn<(open: boolean) => void>();

    useDevisDetailMock.mockReturnValueOnce({ data: null, isLoading: true });
    const { rerender } = renderWithClient(<DevisDetailDialog devisId="d1" open={true} onOpenChange={onOpenChange} />, client);
    expect(screen.getByTestId("icon-loader2")).toBeTruthy();

    useDevisDetailMock.mockReturnValueOnce({ data: STABLE_DEVIS, isLoading: false });
    rerender(
      <QueryClientProvider client={client}>
        <DevisDetailDialog devisId="d1" open={true} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    );

    expect(screen.getByText("Détail du devis — DEV-001")).toBeTruthy();
    expect(screen.getByTestId("badge").textContent).toBe("Accepté");
    expect(screen.getByText("ACME")).toBeTruthy();
    expect(screen.getByText("client@example.test")).toBeTruthy();
    expect(screen.getByText(/SIRET : 123 456 789 00012/)).toBeTruthy();
    expect(screen.getByText("Etab A")).toBeTruthy();
    expect(screen.getByText("Commercial : Jean Dupont")).toBeTruthy();

    expect(screen.getByText("Prestation A")).toBeTruthy();
    expect(screen.getByText("Détails")).toBeTruthy();
    expect(screen.getByText("2 h")).toBeTruthy();
    expect(screen.getByText("50.00 €")).toBeTruthy();
    expect(screen.getByText("20%")).toBeTruthy();
    expect(screen.getAllByText("120.00 €").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("100.00 €")).toBeTruthy();
    expect(screen.getByText("20.00 €")).toBeTruthy();

    expect(screen.getByText("Convertir en facture")).toBeTruthy();

    const noteHeader = screen.getByText("Notes client");
    expect(noteHeader).toBeTruthy();
    expect(screen.getByText("Note client")).toBeTruthy();
  });

  it("convertit en facture et ferme le dialog", async () => {
    useDevisDetailMock.mockReturnValue({ data: STABLE_DEVIS, isLoading: false });
    useFacturesMock.mockReturnValue({ createFacture: createFactureMock, isCreating: false });
    createFactureMock.mockResolvedValue({ id: "f1" });

    const onOpenChange = vi.fn<(open: boolean) => void>();

    const isoSpy = vi
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValueOnce("2024-03-01T00:00:00.000Z")
      .mockReturnValueOnce("2024-03-31T00:00:00.000Z");

    renderWithClient(<DevisDetailDialog devisId="d1" open={true} onOpenChange={onOpenChange} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Convertir en facture"));
    });

    expect(createFactureMock).toHaveBeenCalledTimes(1);
    expect(createFactureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_nom: "ACME",
        client_adresse: "1 rue test",
        client_email: "client@example.test",
        client_siret: "123 456 789 00012",
        etablissement_id: "e1",
        groupe_id: "g1",
        partenaire_id: "p1",
        contact_id: "c1",
        devis_id: "d1",
        commercial_id: "u2",
        conditions_paiement: "30 jours",
        notes_internes: "Note interne",
        notes_client: "Note client",
        date_emission: "2024-03-01",
        date_echeance: "2024-03-31",
        lignes: [
          expect.objectContaining({
            ordre: 0,
            designation: "Prestation A",
            description: "Détails",
            quantite: 2,
            unite: "h",
            prix_unitaire_ht: 50,
            taux_tva: 20,
            montant_ht: 100,
            montant_tva: 20,
            montant_ttc: 120,
            produit_id: "pr1",
            devis_ligne_id: "l1",
          }),
        ],
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    isoSpy.mockRestore();
  });

  it("affiche une erreur toast si la conversion échoue", async () => {
    useDevisDetailMock.mockReturnValue({ data: STABLE_DEVIS, isLoading: false });
    useFacturesMock.mockReturnValue({ createFacture: createFactureMock, isCreating: false });
    createFactureMock.mockRejectedValue(new Error("nope"));

    const onOpenChange = vi.fn<(open: boolean) => void>();

    renderWithClient(<DevisDetailDialog devisId="d1" open={true} onOpenChange={onOpenChange} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Convertir en facture"));
    });

    expect(toastMock.error).toHaveBeenCalledWith("Erreur lors de la conversion en facture");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});