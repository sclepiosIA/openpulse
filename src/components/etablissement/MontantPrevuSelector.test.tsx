import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MontantPrevuSelector } from "./MontantPrevuSelector";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: { children?: React.ReactNode; onClick?: () => void; [k: string]: unknown }) => (
    <button onClick={onClick} aria-label={props["aria-label"] as string | undefined}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Pencil: () => null,
  Check: () => null,
}));

describe("MontantPrevuSelector", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("affiche '-' quand value est null sans formatDisplay", () => {
    const onSave = vi.fn();
    render(<MontantPrevuSelector value={null} onSave={onSave} />);
    expect(screen.getByText("-")).toBeTruthy();
  });

  it("utilise formatDisplay quand fourni", () => {
    const onSave = vi.fn();
    const formatDisplay = vi.fn((v: number | null) => (v != null ? `CUSTOM:${v}` : "vide"));
    render(<MontantPrevuSelector value={2500} onSave={onSave} formatDisplay={formatDisplay} />);
    expect(screen.getByText("CUSTOM:2500")).toBeTruthy();
    expect(formatDisplay).toHaveBeenCalledWith(2500);
  });

  it("calcule les paliers en mensuel (divisor 12) et appelle onSave au clic", () => {
    const onSave = vi.fn();
    render(
      <MontantPrevuSelector
        value={null}
        onSave={onSave}
        tarifsPalliers={{ palier1: 12000, palier2: 24000 }}
        periodicite="mensuel"
      />
    );
    expect(screen.getByText("Paliers")).toBeTruthy();
    expect(screen.getByText("Palier 1")).toBeTruthy();
    expect(screen.getByText("Palier 2")).toBeTruthy();
    expect(screen.queryByText("Palier 3")).toBeNull();
    expect(screen.queryByText("Palier 4")).toBeNull();

    fireEvent.click(screen.getByText("Palier 1"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(1000);

    fireEvent.click(screen.getByText("Palier 2"));
    expect(onSave).toHaveBeenCalledWith(2000);
  });

  it("utilise dureeMois pour calculer le diviseur (12/dureeMois)", () => {
    const onSave = vi.fn();
    render(
      <MontantPrevuSelector
        value={null}
        onSave={onSave}
        tarifsPalliers={{ palier1: 12000 }}
        dureeMois={6}
      />
    );
    fireEvent.click(screen.getByText("Palier 1"));
    // 12000 / (12/6) = 6000
    expect(onSave).toHaveBeenCalledWith(6000);
  });

  it("respecte la periodicite trimestrielle (divisor 4)", () => {
    const onSave = vi.fn();
    render(
      <MontantPrevuSelector
        value={null}
        onSave={onSave}
        tarifsPalliers={{ palier1: 12000 }}
        periodicite="trimestriel"
      />
    );
    fireEvent.click(screen.getByText("Palier 1"));
    expect(onSave).toHaveBeenCalledWith(3000);
  });

  it("affiche les subdivisions à partir du montant annuel estimé et appelle onSave", () => {
    const onSave = vi.fn();
    // value=1000 mensuel → annuel estimé 12000
    render(<MontantPrevuSelector value={1000} onSave={onSave} periodicite="mensuel" />);
    expect(screen.getByText("Subdivisions")).toBeTruthy();

    fireEvent.click(screen.getByText("Trimestriel"));
    expect(onSave).toHaveBeenCalledWith(3000);

    fireEvent.click(screen.getByText("Semestriel"));
    expect(onSave).toHaveBeenCalledWith(6000);

    fireEvent.click(screen.getByText("Annuel"));
    expect(onSave).toHaveBeenCalledWith(12000);
  });

  it("n'affiche pas la section Subdivisions quand value est null", () => {
    const onSave = vi.fn();
    render(<MontantPrevuSelector value={null} onSave={onSave} />);
    expect(screen.queryByText("Subdivisions")).toBeNull();
  });

  it("n'affiche pas la section Paliers quand tarifsPalliers est absent ou vide", () => {
    const onSave = vi.fn();
    render(<MontantPrevuSelector value={null} onSave={onSave} tarifsPalliers={{ palier1: 0 }} />);
    expect(screen.queryByText("Paliers")).toBeNull();
  });

  it("sauvegarde un montant libre via le bouton Valider (parsing fr avec virgule et espaces)", () => {
    const onSave = vi.fn();
    render(<MontantPrevuSelector value={null} onSave={onSave} />);
    const input = screen.getByPlaceholderText("Ex: 5 000");
    fireEvent.change(input, { target: { value: "1 234,567" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    // arrondi à 2 décimales : Math.round(1234.567 * 100) / 100
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(1234.57);
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("sauvegarde un montant libre via la touche Enter", () => {
    const onSave = vi.fn();
    render(<MontantPrevuSelector value={null} onSave={onSave} />);
    const input = screen.getByPlaceholderText("Ex: 5 000");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith(500);
  });

  it("n'appelle pas onSave pour une saisie libre invalide ou négative", () => {
    const onSave = vi.fn();
    render(<MontantPrevuSelector value={null} onSave={onSave} />);
    const input = screen.getByPlaceholderText("Ex: 5 000");

    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "-50" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("affiche toujours la section Montant libre", () => {
    const onSave = vi.fn();
    render(<MontantPrevuSelector value={null} onSave={onSave} />);
    expect(screen.getByText("Montant libre")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ex: 5 000")).toBeTruthy();
  });
});