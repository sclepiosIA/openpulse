import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("@/components/ui/button", () => {
  const ButtonMock = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  )
  return { Button: ButtonMock }
})

const { mockUseNavigate, mockUseSearchParams, mockSetSearchParams, mockGetSearchParams } =
  vi.hoisted(() => {
    const searchParamsStore = new URLSearchParams()
    const mockSetSearchParamsFn = vi.fn((next: URLSearchParams | URLSearchParams | string) => {
      if (next instanceof URLSearchParams) {
        const newParams = new URLSearchParams(next.toString())
        searchParamsStore.forEach((_, key) => searchParamsStore.delete(key))
        newParams.forEach((value, key) => searchParamsStore.set(key, value))
      } else {
        const newParams = new URLSearchParams(next)
        searchParamsStore.forEach((_, key) => searchParamsStore.delete(key))
        newParams.forEach((value, key) => searchParamsStore.set(key, value))
      }
    })

    const mockGetSearchParamsFn = vi.fn(() => {
      return new URLSearchParams(searchParamsStore.toString())
    })

    const mockUseSearchParamsImpl = () => {
      return [mockGetSearchParamsFn(), mockSetSearchParamsFn] as unknown as ReturnType<
        typeof import("react-router-dom")["useSearchParams"]
      >
    }

    const mockUseNavigateFn = vi.fn()

    return {
      mockUseNavigate: mockUseNavigateFn,
      mockUseSearchParams: mockUseSearchParamsImpl,
      mockSetSearchParams: mockSetSearchParamsFn,
      mockGetSearchParams: mockGetSearchParamsFn,
    }
  })

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockUseNavigate,
    useSearchParams: () => mockUseSearchParams(),
  }
})

vi.mock("lucide-react", () => {
  const IconMock = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} data-testid="star-icon" />
  return { Star: IconMock }
})

import { QuickFiltersGroupes } from "./QuickFiltersGroupes"

describe("QuickFiltersGroupes", () => {
  beforeEach(() => {
    mockSetSearchParams.mockClear()
    mockGetSearchParams.mockClear()
    mockUseNavigate.mockClear()
  })

  it("affiche tous les boutons de filtre avec le bouton 'Tous' sélectionné par défaut", () => {
    const initialParams = new URLSearchParams()
    ;(mockGetSearchParams as unknown as vi.Mock).mockReturnValueOnce(initialParams)

    render(<QuickFiltersGroupes />)

    const tousButton = screen.getByText("Tous")
    const ghtButton = screen.getByText("GHT")
    const groupeCliniquesButton = screen.getByText("Groupe Cliniques")
    const consortiumButton = screen.getByText("Consortium")
    const autreButton = screen.getByText("Autre")

    expect(tousButton).toBeInTheDocument()
    expect(ghtButton).toBeInTheDocument()
    expect(groupeCliniquesButton).toBeInTheDocument()
    expect(consortiumButton).toBeInTheDocument()
    expect(autreButton).toBeInTheDocument()

    expect(tousButton).toHaveAttribute("variant", "default")
    expect(ghtButton).toHaveAttribute("variant", "outline")
  })

  it("applique le variant 'default' sur le bouton correspondant au type courant dans l'URL", () => {
    const paramsWithTypeGht = new URLSearchParams()
    paramsWithTypeGht.set("type", "GHT")
    ;(mockGetSearchParams as unknown as vi.Mock).mockReturnValueOnce(paramsWithTypeGht)

    render(<QuickFiltersGroupes />)

    const tousButton = screen.getByText("Tous")
    const ghtButton = screen.getByText("GHT")

    expect(ghtButton).toHaveAttribute("variant", "default")
    expect(tousButton).toHaveAttribute("variant", "outline")
  })

  it("met à jour le paramètre 'type' lors du clic sur un bouton de type spécifique", () => {
    const initialParams = new URLSearchParams()
    ;(mockGetSearchParams as unknown as vi.Mock).mockReturnValueOnce(initialParams)

    render(<QuickFiltersGroupes />)

    const ghtButton = screen.getByText("GHT")
    fireEvent.click(ghtButton)

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1)
    const callArg = mockSetSearchParams.mock.calls[0][0]
    const resultParams =
      callArg instanceof URLSearchParams ? callArg : new URLSearchParams(String(callArg))

    expect(resultParams.get("type")).toBe("GHT")
  })

  it("supprime le paramètre 'type' quand on clique sur 'Tous'", () => {
    const paramsWithType = new URLSearchParams()
    paramsWithType.set("type", "Autre")
    ;(mockGetSearchParams as unknown as vi.Mock).mockReturnValueOnce(paramsWithType)

    render(<QuickFiltersGroupes />)

    const tousButton = screen.getByText("Tous")
    fireEvent.click(tousButton)

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1)
    const callArg = mockSetSearchParams.mock.calls[0][0]
    const resultParams =
      callArg instanceof URLSearchParams ? callArg : new URLSearchParams(String(callArg))

    expect(resultParams.get("type")).toBeNull()
  })

  it("affiche l'icône Star sur le bouton 'Tous'", () => {
    const initialParams = new URLSearchParams()
    ;(mockGetSearchParams as unknown as vi.Mock).mockReturnValueOnce(initialParams)

    render(<QuickFiltersGroupes />)

    const tousButton = screen.getByText("Tous")
    const icon = tousButton.querySelector("svg[data-testid='star-icon']")
    expect(icon).not.toBeNull()
  })
})