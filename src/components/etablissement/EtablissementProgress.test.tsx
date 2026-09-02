// @vitest-environment jsdom

import React from "react"
import { render, screen } from "@testing-library/react"
import { EtablissementProgress } from "./EtablissementProgress"

const { progressMock, cardParts } = vi.hoisted(() => ({
  progressMock: vi.fn(
    ({ value, className }: { value?: number; className?: string }) => (
      <div
        data-testid="progress"
        data-value={String(value ?? "")}
        data-class={className ?? ""}
      />
    )
  ),
  cardParts: {
    Card: ({ children }: { children: React.ReactNode }) => <section data-testid="card">{children}</section>,
    CardHeader: ({ children }: { children: React.ReactNode }) => <header data-testid="card-header">{children}</header>,
    CardTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="card-title">{children}</h2>,
    CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  },
}))

vi.mock("@/components/ui/card", () => cardParts)

vi.mock("@/components/ui/progress", () => ({
  Progress: progressMock,
}))

describe("EtablissementProgress", () => {
  beforeEach(() => {
    progressMock.mockClear()
  })

  it("affiche le titre, le libellé et le pourcentage fourni", () => {
    render(<EtablissementProgress progression={42} />)

    expect(screen.getByTestId("card")).toBeInTheDocument()
    expect(screen.getByTestId("card-header")).toBeInTheDocument()
    expect(screen.getByTestId("card-content")).toBeInTheDocument()
    expect(screen.getByTestId("card-title")).toHaveTextContent("Progression générale")
    expect(screen.getByText("Progression")).toBeInTheDocument()
    expect(screen.getByText("42%")).toBeInTheDocument()
  })

  it("passe la valeur de progression réelle au composant Progress avec la classe attendue", () => {
    render(<EtablissementProgress progression={67} />)

    expect(progressMock).toHaveBeenCalledTimes(1)
    const firstCall = progressMock.mock.calls[0]
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        value: 67,
        className: "h-3",
      })
    )

    const progress = screen.getByTestId("progress")
    expect(progress).toHaveAttribute("data-value", "67")
    expect(progress).toHaveAttribute("data-class", "h-3")
  })

  it("utilise 0 pour la barre lorsque la progression vaut 0 et affiche 0%", () => {
    render(<EtablissementProgress progression={0} />)

    expect(screen.getByText("0%")).toBeInTheDocument()
    const firstCall = progressMock.mock.calls[0]
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        value: 0,
        className: "h-3",
      })
    )
    expect(screen.getByTestId("progress")).toHaveAttribute("data-value", "0")
  })

  it("gère une progression négative en l'affichant telle quelle et en la transmettant à Progress", () => {
    render(<EtablissementProgress progression={-5} />)

    expect(screen.getByText("-5%")).toBeInTheDocument()
    const firstCall = progressMock.mock.calls[0]
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        value: -5,
        className: "h-3",
      })
    )
    expect(screen.getByTestId("progress")).toHaveAttribute("data-value", "-5")
  })
})