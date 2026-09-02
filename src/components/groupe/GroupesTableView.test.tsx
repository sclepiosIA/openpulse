import React from "react"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GroupesTableView } from "./GroupesTableView"

const { GROUPES } = vi.hoisted(() => ({
  GROUPES: [
    {
      id: "g1",
      nom: "Beta Santé",
      type: "GHT",
      region: "Occitanie",
      nombre_etablissements: 12,
      modules_deployes: ["SMUR", "Urgences", "Réanimation"],
      progression_moyenne: 75.4,
      total_passages_urgences_annuel: 125000,
      logo_url: null,
    },
    {
      id: "g2",
      nom: "Alpha Care",
      type: "Privé",
      region: "Auvergne-Rhône-Alpes",
      nombre_etablissements: 3,
      modules_deployes: [],
      progression_moyenne: 42.1,
      total_passages_urgences_annuel: null,
      logo_url: null,
    },
    {
      id: "g3",
      nom: "Gamma Hospitalier",
      type: "Public",
      region: null,
      nombre_etablissements: 20,
      modules_deployes: ["Bloc", "Imagerie"],
      progression_moyenne: 91.9,
      total_passages_urgences_annuel: 9500,
      logo_url: null,
    },
  ],
}))

vi.mock("@/hooks/crm/useGroupes", () => ({}))

vi.mock("@/components/ui/groupe-badge", () => ({
  GroupeBadge: ({ type }: { type: string }) => <span data-testid="groupe-badge">{type}</span>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}))

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value} className={className} data-testid="progress" />
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("lucide-react", () => ({
  MoreHorizontal: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-more" {...props} />,
  Eye: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-eye" {...props} />,
  Mail: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-mail" {...props} />,
  Trash2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-trash" {...props} />,
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-building" {...props} />,
}))

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    className,
    style,
  }: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
  }) => (
    <tr className={className} style={style}>
      {children}
    </tr>
  ),
  TableHead: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <th className={className}>{children}</th>,
  TableCell: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <td className={className}>{children}</td>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    className,
    asChild,
  }: {
    children: React.ReactNode
    className?: string
    asChild?: boolean
  }) =>
    asChild ? (
      <div className={className} data-as-child="true">
        {children}
      </div>
    ) : (
      <div className={className} data-as-child="false">
        {children}
      </div>
    ),
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock("@/components/layout/CRMTableWrapper", () => ({
  CRMTableWrapper: ({ children }: { children: React.ReactNode; minWidth?: string }) => (
    <div data-testid="crm-table-wrapper">{children}</div>
  ),
}))

vi.mock("@/components/layout/CRMSortableHeader", () => ({
  CRMSortableHeader: ({
    children,
    field,
    onSort,
  }: {
    children: React.ReactNode
    field: string
    currentSortField?: string
    currentSortDirection?: "asc" | "desc"
    onSort: (key: string) => void
    align?: string
  }) => (
    <th>
      <button type="button" onClick={() => onSort(field)}>
        {children}
      </button>
    </th>
  ),
}))

vi.mock("@/components/layout/CRMEmptyState", () => ({
  CRMEmptyState: ({
    title,
    description,
  }: {
    icon?: React.ComponentType
    title: string
    description: string
    variant?: string
  }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock("@/components/ui/EntityAvatar", () => ({
  EntityAvatar: ({ name }: { name: string; logoUrl?: string | null; size?: string }) => (
    <div data-testid="entity-avatar">{name}</div>
  ),
}))

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("GroupesTableView", () => {
  it("affiche l'état vide quand aucun groupe n'est fourni", () => {
    renderWithProviders(<GroupesTableView groupes={[]} />)

    expect(screen.getByTestId("empty-state")).toBeInTheDocument()
    expect(screen.getByText("Aucun groupe trouvé")).toBeInTheDocument()
    expect(
      screen.getByText("Modifiez vos critères de recherche ou créez un nouveau groupe."),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("crm-table-wrapper")).not.toBeInTheDocument()
  })

  it("affiche les données métier des groupes avec liens, modules, progression, passages et actions", () => {
    const { container } = renderWithProviders(<GroupesTableView groupes={GROUPES} />)

    expect(screen.getByTestId("crm-table-wrapper")).toBeInTheDocument()

    const rows = Array.from(container.querySelectorAll("tbody tr"))
    expect(rows).toHaveLength(3)

    const firstRow = rows[0]
    expect(within(firstRow).getByRole("link", { name: "Beta Santé" })).toHaveAttribute("href", "/groupes/g1")
    expect(within(firstRow).getByText("Occitanie")).toBeInTheDocument()
    expect(within(firstRow).getByText("SMUR")).toBeInTheDocument()
    expect(within(firstRow).getByText("Urgences")).toBeInTheDocument()
    expect(within(firstRow).getByText("+1")).toBeInTheDocument()
    expect(within(firstRow).getByText("75%")).toBeInTheDocument()
    expect(within(firstRow).getByText("125,000")).toBeInTheDocument()
    expect(within(firstRow).getByText("Voir détails")).toBeInTheDocument()
    expect(within(firstRow).getByText("Envoyer email")).toBeInTheDocument()
    expect(within(firstRow).getByText("Supprimer")).toBeInTheDocument()

    const secondRow = rows[1]
    expect(within(secondRow).getByRole("link", { name: "Alpha Care" })).toHaveAttribute("href", "/groupes/g2")
    expect(within(secondRow).getByText("Auvergne-Rhône-Alpes")).toBeInTheDocument()
    expect(within(secondRow).getByText("Aucun")).toBeInTheDocument()
    expect(within(secondRow).getByText("42%")).toBeInTheDocument()
    expect(within(secondRow).getAllByText("-")).toHaveLength(1)

    const thirdRow = rows[2]
    expect(within(thirdRow).getByRole("link", { name: "Gamma Hospitalier" })).toHaveAttribute("href", "/groupes/g3")
    expect(within(thirdRow).getByText("Bloc")).toBeInTheDocument()
    expect(within(thirdRow).getByText("Imagerie")).toBeInTheDocument()
    expect(within(thirdRow).getByText("92%")).toBeInTheDocument()
    expect(within(thirdRow).getByText("9,500")).toBeInTheDocument()

    expect(screen.getAllByTestId("groupe-badge").map((el) => el.textContent)).toEqual([
      "GHT",
      "Privé",
      "Public",
    ])
    expect(screen.getAllByRole("button", { name: "Plus d'options" })).toHaveLength(3)
    expect(screen.getAllByTestId("entity-avatar")).toHaveLength(3)
    expect(screen.getAllByRole("progressbar").map((el) => el.getAttribute("aria-valuenow"))).toEqual([
      "75.4",
      "42.1",
      "91.9",
    ])
  })

  it("trie par nom en ordre ascendant puis descendant au clic sur l'en-tête", () => {
    const { container } = renderWithProviders(<GroupesTableView groupes={GROUPES} />)

    const getNames = () =>
      Array.from(container.querySelectorAll("tbody tr")).map((row) => {
        const link = within(row).getAllByRole("link")[0]
        return link.textContent
      })

    expect(getNames()).toEqual(["Beta Santé", "Alpha Care", "Gamma Hospitalier"])

    fireEvent.click(screen.getByRole("button", { name: "Nom" }))
    expect(getNames()).toEqual(["Alpha Care", "Beta Santé", "Gamma Hospitalier"])

    fireEvent.click(screen.getByRole("button", { name: "Nom" }))
    expect(getNames()).toEqual(["Gamma Hospitalier", "Beta Santé", "Alpha Care"])
  })

  it("trie numériquement par nombre d'établissements", () => {
    const { container } = renderWithProviders(<GroupesTableView groupes={GROUPES} />)

    const getNames = () =>
      Array.from(container.querySelectorAll("tbody tr")).map((row) => {
        const link = within(row).getAllByRole("link")[0]
        return link.textContent
      })

    fireEvent.click(screen.getByRole("button", { name: "Établissements" }))
    expect(getNames()).toEqual(["Alpha Care", "Beta Santé", "Gamma Hospitalier"])

    fireEvent.click(screen.getByRole("button", { name: "Établissements" }))
    expect(getNames()).toEqual(["Gamma Hospitalier", "Beta Santé", "Alpha Care"])
  })

  it("place les valeurs nulles de région en fin de tri ascendant", () => {
    const { container } = renderWithProviders(<GroupesTableView groupes={GROUPES} />)

    fireEvent.click(screen.getByRole("button", { name: "Région" }))

    const rows = Array.from(container.querySelectorAll("tbody tr"))
    const names = rows.map((row) => within(row).getAllByRole("link")[0].textContent)

    expect(names).toEqual(["Alpha Care", "Beta Santé", "Gamma Hospitalier"])
  })
})