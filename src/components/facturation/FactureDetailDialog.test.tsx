import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FactureDetailDialog } from "./FactureDetailDialog";

const { FACTURE_DATA, mockUseFactureDetail, mockPaiementDialog, mockModePaiementLabels } = vi.hoisted(() => {
  const FACTURE_DATA = {
    id: "f1",
    numero: "F-2024-001",
    statut: "validee",
    date_emission: "2024-01-10T00:00:00.000Z",
    date_echeance: "2024-01-31T00:00:00.000Z",
    client_nom: "Client Test",
    client_email: "client@example.com",
    client_siret: "12345678900011",
    etablissement: {
      nom: "Etablissement Test",
    },
    devis: {
      numero: "D-2024-001",
    },
    lignes: [
      {
        id: "l1",
        designation: "Prestation A",
        description: "Description A",
        quantite: 2,
        unite: "h",
        prix_unitaire_ht: 100,
        taux_tva: 20,
        montant_ttc: 240,
      },
      {
        id: "l2",
        designation: "Produit B",
        description: null,
        quantite: 1,
        unite: "u",
        prix_unitaire_ht: 50,
        taux_tva: 20,
        montant_ttc: 60,
      },
    ],
    montant_ht: 250,
    montant_tva: 50,
    montant_ttc: 300,
    montant_paye: 120,
    paiements: [
      {
        id: "p1",
        montant: 120,
        mode_paiement: "carte",
        date_paiement: "2024-01-15T00:00:00.000Z",
        reference_paiement: "REF-001",
      },
    ],
    notes_client: "Merci pour votre confiance.",
  };

  const mockUseFactureDetail = vi.fn();
  const mockPaiementDialog = vi.fn(() => null);
  const mockModePaiementLabels: Record<string, string> = {
    carte: "Carte bancaire",
  };

  return { FACTURE_DATA, mockUseFactureDetail, mockPaiementDialog, mockModePaiementLabels };
});

vi.mock("@/components/ui/dialog", () => {
  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="dialog-root" data-open={open} onClick={() => onOpenChange(open)}>
      {children}
    </div>
  );
  const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  );
  const DialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  );
  const DialogFooter = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
});

vi.mock("@/components/ui/button", () => {
  const Button = ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} onClick={onClick}>
      {children}
    </button>
  );
  return { Button };
});

vi.mock("@/components/ui/badge", () => {
  const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  );
  return { Badge };
});

vi.mock("@/components/ui/separator", () => {
  const Separator = () => <hr data-testid="separator" />;
  return { Separator };
});

vi.mock("@/hooks/billing/useFactures", () => ({
  useFactureDetail: (...args: unknown[]) => mockUseFactureDetail(...args),
}));

vi.mock("@/types/facturation", () => {
  const FACTURE_STATUT_LABELS: Record<string, string> = {
    validee: "Validée",
    brouillon: "Brouillon",
    annulee: "Annulée",
  };
  const FACTURE_STATUT_COLORS: Record<string, string> = {
    validee: "bg-green",
    brouillon: "bg-gray",
    annulee: "bg-red",
  };
  const MODE_PAIEMENT_LABELS = mockModePaiementLabels;
  return { FACTURE_STATUT_LABELS, FACTURE_STATUT_COLORS, MODE_PAIEMENT_LABELS };
});

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <span data-icon className={className} />;
  return {
    Loader2: Icon,
    FileText: Icon,
    CreditCard: Icon,
  };
});

vi.mock("./PaiementDialog", () => ({
  PaiementDialog: (props: { factureId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) =>
    mockPaiementDialog(props),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

describe("FactureDetailDialog", () => {
  it("affiche un état de chargement lorsque la facture est en cours de récupération", () => {
    mockUseFactureDetail.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    const loader = screen.getByTestId("dialog-content").querySelector(".animate-spin");
    expect(loader).not.toBeNull();
  });

  it("affiche les détails de la facture lorsque la récupération réussit", () => {
    mockUseFactureDetail.mockReturnValue({
      data: FACTURE_DATA,
      isLoading: false,
      isError: false,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByText(/Facture — F-2024-001/)).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveTextContent("Validée");
    expect(screen.getByText("Client Test")).toBeInTheDocument();
    expect(screen.getByText("client@example.com")).toBeInTheDocument();
    expect(screen.getByText(/SIRET : 12345678900011/)).toBeInTheDocument();
    expect(screen.getByText("Etablissement Test")).toBeInTheDocument();
    expect(screen.getByText(/Devis : D-2024-001/)).toBeInTheDocument();

    expect(screen.getByText("Prestation A")).toBeInTheDocument();
    expect(screen.getByText("Description A")).toBeInTheDocument();
    expect(screen.getByText("Produit B")).toBeInTheDocument();

    const qteCells = screen.getAllByText(/ h| u$/);
    expect(qteCells.map((el) => el.textContent)).toEqual(expect.arrayContaining(["2 h", "1 u"]));

    expect(screen.getAllByText("100.00 €")[0]).toBeInTheDocument();
    expect(screen.getAllByText("50.00 €")[0]).toBeInTheDocument();
    expect(screen.getAllByText("20%").length).toBeGreaterThan(0);
    expect(screen.getByText("240.00 €")).toBeInTheDocument();
    expect(screen.getByText("60.00 €")).toBeInTheDocument();

    const totalHt = screen.getAllByText("250.00 €")[0];
    const totalTva = screen.getAllByText("50.00 €")[0];
    const totalTtc = screen.getAllByText("300.00 €")[0];
    const totalPaye = screen.getAllByText("120.00 €")[0];
    const resteDu = screen.getAllByText("180.00 €")[0];

    expect(totalHt).toBeInTheDocument();
    expect(totalTva).toBeInTheDocument();
    expect(totalTtc).toBeInTheDocument();
    expect(totalPaye).toBeInTheDocument();
    expect(resteDu).toBeInTheDocument();

    expect(screen.queryByText(/Aucun paiement enregistré/)).toBeNull();
    expect(screen.getByText(/120.00 € — Carte bancaire/)).toBeInTheDocument();
    expect(screen.getByText(/Réf : REF-001/)).toBeInTheDocument();

    const notesBlock = screen.getByText("Notes client");
    expect(notesBlock).toBeInTheDocument();
    expect(screen.getByText("Merci pour votre confiance.")).toBeInTheDocument();
  });

  it("affiche le message aucun paiement enregistré quand il n'y a pas de paiements", () => {
    mockUseFactureDetail.mockReturnValue({
      data: { ...FACTURE_DATA, paiements: [] },
      isLoading: false,
      isError: false,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByText(/Aucun paiement enregistré/)).toBeInTheDocument();
  });

  it("affiche le bouton de paiement uniquement quand un reste est dû et la facture n'est pas annulée", () => {
    mockUseFactureDetail.mockReturnValue({
      data: FACTURE_DATA,
      isLoading: false,
      isError: false,
    });

    const Wrapper = createWrapper();

    const { rerender } = render(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByText("Enregistrer un paiement")).toBeInTheDocument();

    mockUseFactureDetail.mockReturnValueOnce({
      data: { ...FACTURE_DATA, montant_paye: FACTURE_DATA.montant_ttc },
      isLoading: false,
      isError: false,
    });

    rerender(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.queryByText("Enregistrer un paiement")).toBeNull();

    mockUseFactureDetail.mockReturnValueOnce({
      data: { ...FACTURE_DATA, statut: "annulee", montant_paye: 0 },
      isLoading: false,
      isError: false,
    });

    rerender(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.queryByText("Enregistrer un paiement")).toBeNull();
  });

  it("ouvre le PaiementDialog quand on clique sur Enregistrer un paiement", async () => {
    mockUseFactureDetail.mockReturnValue({
      data: FACTURE_DATA,
      isLoading: false,
      isError: false,
    });

    mockPaiementDialog.mockImplementation(
      ({ factureId, open }: { factureId: string | null; open: boolean }) => (
        <div data-testid="paiement-dialog" data-facture-id={factureId ?? ""} data-open={open} />
      ),
    );

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByTestId("paiement-dialog")).toHaveAttribute("data-open", "false");

    const button = screen.getByText("Enregistrer un paiement");
    await act(async () => {
      button.click();
    });

    expect(screen.getByTestId("paiement-dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("paiement-dialog")).toHaveAttribute("data-facture-id", "f1");
  });

  it("appelle onOpenChange(false) quand on clique sur Fermer", async () => {
    mockUseFactureDetail.mockReturnValue({
      data: FACTURE_DATA,
      isLoading: false,
      isError: false,
    });

    const Wrapper = createWrapper();
    const onOpenChange = vi.fn();

    render(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    const closeButton = screen.getByText("Fermer");
    await act(async () => {
      closeButton.click();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("gère le cas où aucune facture n'est retournée (isError simulé)", () => {
    mockUseFactureDetail.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <FactureDetailDialog factureId="f1" open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByText("Fermer")).toBeInTheDocument();
    expect(screen.queryByText(/Facture —/)).toBeNull();
    expect(screen.queryByText("Enregistrer un paiement")).toBeNull();
  });

  it("n'appelle pas useFactureDetail quand factureId est null (passe undefined au hook)", () => {
    mockUseFactureDetail.mockClear();
    mockUseFactureDetail.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <FactureDetailDialog factureId={null} open={false} onOpenChange={() => {}} />
      </Wrapper>,
    );

    expect(mockUseFactureDetail).toHaveBeenCalledWith(undefined);
  });
});