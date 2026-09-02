// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./table"

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: Array<string | false | null | undefined>) => inputs.filter(Boolean).join(" "),
}))

describe("table.tsx", () => {
  it("rend Table avec le wrapper responsive par défaut et fusionne les classes du table", () => {
    const tableRef = React.createRef<HTMLTableElement>()

    const { container } = render(
      <Table ref={tableRef} data-testid="table" className="custom-table">
        <TableCaption>Liste</TableCaption>
      </Table>
    )

    const wrapper = container.firstElementChild
    const table = screen.getByTestId("table")
    const caption = screen.getByText("Liste")

    expect(wrapper?.tagName).toBe("DIV")
    expect(wrapper).toHaveClass("relative", "w-full", "table-responsive")
    expect(wrapper).not.toHaveClass("overflow-auto")

    expect(table.tagName).toBe("TABLE")
    expect(table).toHaveClass("w-full", "caption-bottom", "text-sm", "min-w-[640px]", "sm:min-w-0", "custom-table")
    expect(caption.tagName).toBe("CAPTION")
    expect(tableRef.current).toBe(table)
  })

  it("désactive le mode responsive et applique overflow-auto", () => {
    const { container } = render(<Table data-testid="table" responsive={false} />)

    const wrapper = container.firstElementChild
    const table = screen.getByTestId("table")

    expect(wrapper).toHaveClass("relative", "w-full", "overflow-auto")
    expect(wrapper).not.toHaveClass("table-responsive")
    expect(table).toHaveClass("w-full", "caption-bottom", "text-sm")
    expect(table).not.toHaveClass("min-w-[640px]")
    expect(table).not.toHaveClass("sm:min-w-0")
  })

  it("rend tous les sous-composants avec leurs classes métier et le contenu attendu", () => {
    render(
      <Table data-testid="table">
        <TableCaption className="caption-extra">Résumé mensuel</TableCaption>
        <TableHeader className="header-extra" data-testid="thead">
          <TableRow className="row-head-extra">
            <TableHead className="head-extra">Nom</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="body-extra" data-testid="tbody">
          <TableRow className="row-body-extra" data-state="selected">
            <TableCell className="cell-extra">Produit A</TableCell>
            <TableCell>Actif</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter className="footer-extra" data-testid="tfoot">
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>1</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    const table = screen.getByTestId("table")
    const thead = screen.getByTestId("thead")
    const tbody = screen.getByTestId("tbody")
    const tfoot = screen.getByTestId("tfoot")
    const caption = screen.getByText("Résumé mensuel")
    const selectedRow = screen.getByText("Produit A").closest("tr")
    const headCell = screen.getByText("Nom")
    const bodyCell = screen.getByText("Produit A")

    expect(table).toContainElement(caption)
    expect(thead.tagName).toBe("THEAD")
    expect(thead).toHaveClass("[&_tr]:border-b", "header-extra")

    expect(tbody.tagName).toBe("TBODY")
    expect(tbody).toHaveClass("[&_tr:last-child]:border-0", "body-extra")

    expect(tfoot.tagName).toBe("TFOOT")
    expect(tfoot).toHaveClass("border-t", "bg-muted/50", "font-medium", "[&>tr]:last:border-b-0", "footer-extra")

    expect(caption).toHaveClass("mt-4", "text-sm", "text-muted-foreground", "caption-extra")

    expect(selectedRow).toHaveClass(
      "border-b",
      "transition-colors",
      "hover:bg-muted/50",
      "data-[state=selected]:bg-muted",
      "row-body-extra"
    )
    expect(selectedRow).toHaveAttribute("data-state", "selected")

    expect(headCell.tagName).toBe("TH")
    expect(headCell).toHaveClass(
      "h-12",
      "px-4",
      "text-left",
      "align-middle",
      "font-medium",
      "text-muted-foreground",
      "[&:has([role=checkbox])]:pr-0",
      "head-extra"
    )

    expect(bodyCell.tagName).toBe("TD")
    expect(bodyCell).toHaveClass("p-4", "align-middle", "[&:has([role=checkbox])]:pr-0", "cell-extra")
  })

  it("transmet les refs des sous-composants vers les éléments DOM attendus", () => {
    const headerRef = React.createRef<HTMLTableSectionElement>()
    const bodyRef = React.createRef<HTMLTableSectionElement>()
    const footerRef = React.createRef<HTMLTableSectionElement>()
    const rowRef = React.createRef<HTMLTableRowElement>()
    const headRef = React.createRef<HTMLTableCellElement>()
    const cellRef = React.createRef<HTMLTableCellElement>()
    const captionRef = React.createRef<HTMLTableCaptionElement>()

    render(
      <Table>
        <TableCaption ref={captionRef}>Cap</TableCaption>
        <TableHeader ref={headerRef}>
          <TableRow ref={rowRef}>
            <TableHead ref={headRef}>Colonne</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody ref={bodyRef}>
          <TableRow>
            <TableCell ref={cellRef}>Valeur</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter ref={footerRef}>
          <TableRow>
            <TableCell>Pied</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(headerRef.current?.tagName).toBe("THEAD")
    expect(bodyRef.current?.tagName).toBe("TBODY")
    expect(footerRef.current?.tagName).toBe("TFOOT")
    expect(rowRef.current?.tagName).toBe("TR")
    expect(headRef.current?.tagName).toBe("TH")
    expect(cellRef.current?.tagName).toBe("TD")
    expect(captionRef.current?.tagName).toBe("CAPTION")
  })
})