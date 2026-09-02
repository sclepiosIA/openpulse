import { render, screen, fireEvent } from "@testing-library/react";
import { SlashCommandMenu } from "./SlashCommandMenu";

const { ACTIONS, GROUP_LABELS, LANGS, mockGetActions } = vi.hoisted(() => {
  const Icon = () => null;
  const ACTIONS = [
    {
      id: "improve",
      label: "Améliorer le texte",
      description: "Améliore la sélection",
      group: "edit",
      needsSelection: true,
      icon: Icon,
    },
    {
      id: "translate",
      label: "Traduire",
      description: "Traduit la sélection",
      group: "edit",
      needsSelection: true,
      icon: Icon,
    },
    {
      id: "summarize",
      label: "Résumer le document",
      description: "Résume le contenu",
      group: "create",
      needsSelection: false,
      icon: Icon,
    },
  ];
  const GROUP_LABELS = { edit: "Édition", create: "Création" };
  const LANGS = [
    { code: "en", label: "Anglais" },
    { code: "es", label: "Espagnol" },
  ];
  return {
    ACTIONS,
    GROUP_LABELS,
    LANGS,
    mockGetActions: vi.fn(() => ACTIONS),
  };
});

vi.mock("./actions", () => ({
  getActionsForSurface: mockGetActions,
  COPILOT_GROUP_LABEL: GROUP_LABELS,
  TRANSLATE_LANGUAGES: LANGS,
}));

vi.mock("lucide-react", () => ({
  Languages: () => null,
}));

vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="command-dialog">{children}</div> : null),
  CommandInput: ({
    placeholder,
    value,
    onValueChange,
  }: {
    placeholder: string;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <input
      data-testid="command-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({
    heading,
    children,
  }: {
    heading: string;
    children: React.ReactNode;
  }) => (
    <div>
      <div data-testid="group-heading">{heading}</div>
      {children}
    </div>
  ),
  CommandSeparator: () => <hr />,
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect: () => void;
  }) => (
    <div role="option" aria-selected={false} onClick={onSelect}>
      {children}
    </div>
  ),
}));

describe("SlashCommandMenu", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    surface: "document" as const,
    hasSelection: true,
    onSelectAction: vi.fn(),
    onFreePrompt: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne rend rien quand open=false", () => {
    render(<SlashCommandMenu {...baseProps} open={false} />);
    expect(screen.queryByTestId("command-dialog")).toBeNull();
  });

  it("affiche les groupes et actions pour la surface avec sélection", () => {
    render(<SlashCommandMenu {...baseProps} />);
    expect(mockGetActions).toHaveBeenCalledWith("document");
    const headings = screen.getAllByTestId("group-heading").map((h) => h.textContent);
    expect(headings).toContain("Édition");
    expect(headings).toContain("Création");
    expect(screen.getByText("Améliorer le texte")).toBeTruthy();
    expect(screen.getByText("Résumer le document")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Rechercher une action ou taper une consigne…"),
    ).toBeTruthy();
  });

  it("masque les actions nécessitant une sélection quand hasSelection=false", () => {
    render(<SlashCommandMenu {...baseProps} hasSelection={false} />);
    expect(screen.queryByText("Améliorer le texte")).toBeNull();
    expect(screen.queryByText("Traduire")).toBeNull();
    expect(screen.getByText("Résumer le document")).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "Décrire un document à rédiger, ou choisir une action…",
      ),
    ).toBeTruthy();
  });

  it("sélectionner une action standard appelle onSelectAction et ferme le dialogue", () => {
    render(<SlashCommandMenu {...baseProps} />);
    fireEvent.click(screen.getByText("Améliorer le texte"));
    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(baseProps.onSelectAction).toHaveBeenCalledWith(ACTIONS[0]);
  });

  it("l'action translate ouvre la liste des langues puis sélectionne une langue", () => {
    render(<SlashCommandMenu {...baseProps} />);
    fireEvent.click(screen.getByText("Traduire"));
    expect(baseProps.onSelectAction).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Choisir une langue…")).toBeTruthy();
    expect(screen.getByText("Langue cible")).toBeTruthy();
    fireEvent.click(screen.getByText("Espagnol"));
    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(baseProps.onSelectAction).toHaveBeenCalledWith(ACTIONS[1], {
      language: "es",
    });
  });

  it("affiche la consigne libre quand la requête dépasse 3 caractères sur surface document", () => {
    render(<SlashCommandMenu {...baseProps} />);
    fireEvent.change(screen.getByTestId("command-input"), {
      target: { value: "rédige un compte-rendu" },
    });
    const promptItem = screen.getByText(/Rédiger : « rédige un compte-rendu/);
    fireEvent.click(promptItem);
    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(baseProps.onFreePrompt).toHaveBeenCalledWith("rédige un compte-rendu");
  });

  it("n'affiche pas la consigne libre si surface != document", () => {
    render(<SlashCommandMenu {...baseProps} surface="spreadsheet" />);
    fireEvent.change(screen.getByTestId("command-input"), {
      target: { value: "rédige un compte-rendu" },
    });
    expect(screen.queryByText(/Rédiger :/)).toBeNull();
  });

  it("n'affiche pas la consigne libre si la requête est trop courte", () => {
    render(<SlashCommandMenu {...baseProps} />);
    fireEvent.change(screen.getByTestId("command-input"), {
      target: { value: "ab " },
    });
    expect(screen.queryByText(/Rédiger :/)).toBeNull();
  });
});