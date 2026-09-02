// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog"

const { cnMock, buttonVariantsMock } = vi.hoisted(() => ({
  cnMock: vi.fn((...inputs: Array<string | undefined | null | false>) =>
    inputs.filter(Boolean).join(" ")
  ),
  buttonVariantsMock: vi.fn((options?: { variant?: string }) =>
    options?.variant === "outline" ? "btn btn-outline" : "btn btn-default"
  ),
}))

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}))

vi.mock("@/components/ui/button", () => ({
  buttonVariants: buttonVariantsMock,
}))

describe("alert-dialog.tsx", () => {
  beforeEach(() => {
    cnMock.mockClear()
    buttonVariantsMock.mockClear()
  })

  it("ouvre la boîte de dialogue et affiche le contenu métier attendu", async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger>Ouvrir</AlertDialogTrigger>
        <AlertDialogContent data-testid="content">
          <AlertDialogHeader data-testid="header">
            <AlertDialogTitle>Supprimer l’élément</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter data-testid="footer">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Ouvrir" }))

    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText("Supprimer l’élément")).toBeInTheDocument()
    expect(
      screen.getByText("Cette action est irréversible.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirmer" })).toBeInTheDocument()
  })

  it("ferme la boîte de dialogue via le bouton cancel", async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog defaultOpen>
        <AlertDialogTrigger>Ouvrir</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Suppression</AlertDialogTitle>
          <AlertDialogDescription>Confirmez la suppression.</AlertDialogDescription>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    )

    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Annuler" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("compose correctement les classes utilitaires pour content, action et cancel dans un dialog valide", async () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent data-testid="content" className="custom-content">
          <AlertDialogTitle>Titre</AlertDialogTitle>
          <AlertDialogDescription>Description visible</AlertDialogDescription>
          <AlertDialogAction className="custom-action">Valider</AlertDialogAction>
          <AlertDialogCancel className="custom-cancel">Retour</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    )

    const content = screen.getByTestId("content")
    const action = screen.getByRole("button", { name: "Valider" })
    const cancel = screen.getByRole("button", { name: "Retour" })

    expect(buttonVariantsMock).toHaveBeenCalledWith()
    expect(buttonVariantsMock).toHaveBeenCalledWith({ variant: "outline" })

    expect(content.className).toContain("fixed left-[50%] top-[50%] z-50")
    expect(content.className).toContain("max-w-lg")
    expect(content.className).toContain("custom-content")

    expect(action.className).toContain("btn btn-default")
    expect(action.className).toContain("custom-action")

    expect(cancel.className).toContain("btn btn-outline")
    expect(cancel.className).toContain("mt-2 sm:mt-0")
    expect(cancel.className).toContain("custom-cancel")
  })

  it("applique les classes structurelles attendues sur header et footer", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader data-testid="header" className="header-extra">
            <AlertDialogTitle>Titre</AlertDialogTitle>
            <AlertDialogDescription>Description</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter data-testid="footer" className="footer-extra">
            <AlertDialogCancel>Non</AlertDialogCancel>
            <AlertDialogAction>Oui</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    const header = screen.getByTestId("header")
    const footer = screen.getByTestId("footer")

    expect(header.className).toContain("flex flex-col space-y-2 text-center sm:text-left")
    expect(header.className).toContain("header-extra")

    expect(footer.className).toContain("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2")
    expect(footer.className).toContain("footer-extra")
  })

  it("rend le titre et la description avec les classes métier attendues", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle className="title-extra">Titre critique</AlertDialogTitle>
          <AlertDialogDescription className="desc-extra">
            Détail de confirmation
          </AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    )

    const title = screen.getByText("Titre critique")
    const description = screen.getByText("Détail de confirmation")

    expect(title.className).toContain("text-lg font-semibold")
    expect(title.className).toContain("title-extra")

    expect(description.className).toContain("text-sm text-muted-foreground")
    expect(description.className).toContain("desc-extra")
  })
})