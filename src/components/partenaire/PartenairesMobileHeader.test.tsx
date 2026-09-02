import { ReactElement } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { PartenairesMobileHeader } from "./PartenairesMobileHeader"

const { mockOpenDrawer } = vi.hoisted(() => {
  return {
    mockOpenDrawer: vi.fn(),
  }
})

vi.mock("@/contexts/MobileDrawerContext", () => ({
  useMobileDrawer: () => ({
    open: mockOpenDrawer,
  }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: (props: { children: ReactElement | ReactElement[] | string; onClick?: () => void; "aria-label"?: string }) => {
    // simple passthrough button mock
    return (
      <button onClick={props.onClick} aria-label={props["aria-label"]}>
        {props.children}
      </button>
    )
  },
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) => {
    return (
      <input
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
      />
    )
  },
}))

vi.mock("@/components/ui/dropdown-menu", () => {
  const DropdownMenu = ({ children }: { children: ReactElement | ReactElement[] }) => <div>{children}</div>
  const DropdownMenuTrigger = ({ children }: { children: ReactElement }) => <div>{children}</div>
  const DropdownMenuContent = ({ children }: { children: ReactElement | ReactElement[] }) => <div>{children}</div>
  const DropdownMenuItem = (props: { children: ReactElement | string; onClick?: () => void }) => (
    <div role="menuitem" onClick={props.onClick}>
      {props.children}
    </div>
  )
  const DropdownMenuSeparator = () => <div role="separator" />
  const DropdownMenuSub = ({ children }: { children: ReactElement | ReactElement[] }) => <div>{children}</div>
  const DropdownMenuSubTrigger = ({ children }: { children: ReactElement | string }) => <div>{children}</div>
  const DropdownMenuSubContent = ({ children }: { children: ReactElement | ReactElement[] }) => <div>{children}</div>

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
  }
})

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": dataTestId }: { "data-testid"?: string }) => <span data-testid={dataTestId || "icon"} />
  return {
    Handshake: Icon,
    Search: Icon,
    Plus: Icon,
    Menu: Icon,
    MoreHorizontal: Icon,
    BarChart3: Icon,
    RefreshCw: Icon,
    Download: Icon,
    Filter: Icon,
    CheckSquare: Icon,
    FileText: Icon,
    FileSpreadsheet: Icon,
  }
})

vi.mock("@/lib/utils", () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}))

describe("PartenairesMobileHeader", () => {
  const setup = (overrides?: Partial<React.ComponentProps<typeof PartenairesMobileHeader>>) => {
    const defaultProps: React.ComponentProps<typeof PartenairesMobileHeader> = {
      searchValue: "foo",
      onSearchChange: vi.fn(),
      onCreateClick: vi.fn(),
      stats: {
        displayed: 10,
        total: 50,
        actifs: 7,
        valeur: "12 k€",
      },
      toolbar: <div data-testid="toolbar-item">Toolbar</div>,
      showGlobalNav: true,
      showStats: false,
      onToggleStats: vi.fn(),
      onAdvancedSearch: vi.fn(),
      onExport: vi.fn(),
      onRefresh: vi.fn(),
      selectionMode: false,
      onToggleSelectionMode: vi.fn(),
    }

    const props = { ...defaultProps, ...overrides }

    const view = render(<PartenairesMobileHeader {...props} />)
    return { ...view, props }
  }

  it("affiche le titre, les stats et la valeur métier", () => {
    setup()

    expect(screen.getByText("Partenaires")).toBeInTheDocument()
    expect(screen.getByText(/10 affich\./)).toBeInTheDocument()
    expect(screen.getByText(/7 actifs/)).toBeInTheDocument()
    expect(screen.getByText(/12 k€/)).toBeInTheDocument()
  })

  it("appelle onSearchChange lors de la saisie dans la recherche", () => {
    const { props } = setup()
    const input = screen.getByLabelText("Chercher...")

    fireEvent.change(input, { target: { value: "bar" } })

    expect(props.onSearchChange).toHaveBeenCalledTimes(1)
    expect(props.onSearchChange).toHaveBeenCalledWith("bar")
  })

  it("appelle open du drawer quand on clique sur le bouton menu", () => {
    setup()
    const menuButton = screen.getByRole("button", { name: "Menu" })

    fireEvent.click(menuButton)

    expect(mockOpenDrawer).toHaveBeenCalledTimes(1)
  })

  it("peut masquer le bouton de navigation globale", () => {
    setup({ showGlobalNav: false })

    const menuButtons = screen.queryByRole("button", { name: "Menu" })
    expect(menuButtons).toBeNull()
  })

  it("toggle des stats appelle onToggleStats et change les labels", () => {
    const { rerender, props } = setup({ showStats: false })
    const toggleButton = screen.getByRole("button", { name: "Afficher les statistiques" })

    fireEvent.click(toggleButton)
    expect(props.onToggleStats).toHaveBeenCalledTimes(1)

    rerender(
      <PartenairesMobileHeader
        {...props}
        showStats={true}
      />
    )

    const hideButton = screen.getByRole("button", { name: "Masquer les statistiques" })
    expect(hideButton).toBeInTheDocument()
  })

  it("appelle onCreateClick quand on clique sur le bouton d'ajout", () => {
    const { props } = setup()
    const createButton = screen.getByRole("button", { name: "Ajouter un partenaire" })

    fireEvent.click(createButton)

    expect(props.onCreateClick).toHaveBeenCalledTimes(1)
  })

  it("affiche la toolbar quand elle est fournie", () => {
    setup()

    expect(screen.getByTestId("toolbar-item")).toBeInTheDocument()
  })

  it("n'affiche pas la toolbar quand elle est absente", () => {
    render(
      <PartenairesMobileHeader
        searchValue=""
        onSearchChange={vi.fn()}
        onCreateClick={vi.fn()}
        stats={{ displayed: 0, total: 0, actifs: 0, valeur: "0 €" }}
        showStats={false}
        onToggleStats={vi.fn()}
        onAdvancedSearch={vi.fn()}
        onExport={vi.fn()}
        onRefresh={vi.fn()}
        selectionMode={false}
        onToggleSelectionMode={vi.fn()}
      />
    )

    expect(screen.queryByTestId("toolbar-item")).toBeNull()
  })

  it("appelle onAdvancedSearch depuis le menu", () => {
    const { props } = setup()
    const advancedSearchItem = screen.getByText("Recherche avancée")

    fireEvent.click(advancedSearchItem)

    expect(props.onAdvancedSearch).toHaveBeenCalledTimes(1)
  })

  it("appelle onExport avec csv, excel et pdf", () => {
    const { props } = setup()
    const csvItem = screen.getByText("CSV")
    const excelItem = screen.getByText("Excel")
    const pdfItem = screen.getByText("PDF")

    fireEvent.click(csvItem)
    fireEvent.click(excelItem)
    fireEvent.click(pdfItem)

    expect(props.onExport).toHaveBeenCalledWith("csv")
    expect(props.onExport).toHaveBeenCalledWith("excel")
    expect(props.onExport).toHaveBeenCalledWith("pdf")
    expect((props.onExport as unknown as jest.Mock).mock.calls.length || (props.onExport as unknown as vi.Mock).mock.calls.length).toBe(3)
  })

  it("appelle onToggleSelectionMode et affiche le bon libellé selon selectionMode", () => {
    const { props, rerender } = setup({ selectionMode: false })

    const selectionItem = screen.getByText("Mode sélection")
    fireEvent.click(selectionItem)
    expect(props.onToggleSelectionMode).toHaveBeenCalledTimes(1)

    rerender(
      <PartenairesMobileHeader
        {...props}
        selectionMode={true}
      />
    )

    expect(screen.getByText("Désactiver sélection")).toBeInTheDocument()
  })

  it("appelle onRefresh depuis le menu", () => {
    const { props } = setup()
    const refreshItem = screen.getByText("Actualiser")

    fireEvent.click(refreshItem)

    expect(props.onRefresh).toHaveBeenCalledTimes(1)
  })
})