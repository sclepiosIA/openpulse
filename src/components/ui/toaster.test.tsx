/* @vitest-environment jsdom */

import React from "react"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "./toaster"

const { TOASTS_LOADING, TOASTS_SUCCESS, TOASTS_ERROR, mockUseToast } = vi.hoisted(
  () => ({
    TOASTS_LOADING: [] as Array<{
      id: string
      title?: React.ReactNode
      description?: React.ReactNode
      action?: React.ReactNode
      open?: boolean
    }>,
    TOASTS_SUCCESS: [
      {
        id: "t1",
        title: "Saved",
        description: "Profile updated",
        action: "Undo",
        open: true,
      },
      {
        id: "t2",
        title: "Notice",
        description: "Background sync complete",
        open: true,
      },
    ] as Array<{
      id: string
      title?: React.ReactNode
      description?: React.ReactNode
      action?: React.ReactNode
      open?: boolean
    }>,
    TOASTS_ERROR: [
      {
        id: "t3",
        title: "Error",
        description: "x",
        open: true,
      },
    ] as Array<{
      id: string
      title?: React.ReactNode
      description?: React.ReactNode
      action?: React.ReactNode
      open?: boolean
    }>,
    mockUseToast: vi.fn(),
  })
)

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: mockUseToast,
}))

vi.mock("@/components/ui/toast", () => {
  const ReactLocal = React
  return {
    ToastProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="toast-provider">{children}</div>
    ),
    ToastViewport: () => <div data-testid="toast-viewport" />,
    Toast: ({
      children,
      open,
    }: {
      children: React.ReactNode
      open?: boolean
    }) => (
      <div data-testid="toast" data-open={String(Boolean(open))}>
        {children}
      </div>
    ),
    ToastTitle: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="toast-title">{children}</div>
    ),
    ToastDescription: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="toast-description">{children}</div>
    ),
    ToastClose: () => <button data-testid="toast-close" />,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("Toaster", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("affiche le provider et le viewport quand il n'y a aucun toast", () => {
    mockUseToast.mockReturnValue({ toasts: TOASTS_LOADING })

    render(<Toaster />, { wrapper: createWrapper() })

    expect(screen.getByTestId("toast-provider")).toBeInTheDocument()
    expect(screen.getByTestId("toast-viewport")).toBeInTheDocument()
    expect(screen.queryAllByTestId("toast")).toHaveLength(0)
  })

  it("rend les toasts avec leurs valeurs métier réelles", () => {
    mockUseToast.mockReturnValue({ toasts: TOASTS_SUCCESS })

    render(<Toaster />, { wrapper: createWrapper() })

    const toasts = screen.getAllByTestId("toast")
    expect(toasts).toHaveLength(2)
    expect(toasts[0]).toHaveAttribute("data-open", "true")
    expect(toasts[1]).toHaveAttribute("data-open", "true")

    expect(screen.getByText("Saved")).toBeInTheDocument()
    expect(screen.getByText("Profile updated")).toBeInTheDocument()
    expect(screen.getByText("Undo")).toBeInTheDocument()

    expect(screen.getByText("Notice")).toBeInTheDocument()
    expect(screen.getByText("Background sync complete")).toBeInTheDocument()

    expect(screen.getAllByTestId("toast-title")).toHaveLength(2)
    expect(screen.getAllByTestId("toast-description")).toHaveLength(2)
    expect(screen.getAllByTestId("toast-close")).toHaveLength(2)
  })

  it("rend un toast d'erreur avec le message x", () => {
    mockUseToast.mockReturnValue({ toasts: TOASTS_ERROR })

    render(<Toaster />, { wrapper: createWrapper() })

    expect(screen.getAllByTestId("toast")).toHaveLength(1)
    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByText("x")).toBeInTheDocument()
    expect(screen.getByTestId("toast-close")).toBeInTheDocument()
    expect(screen.getByTestId("toast-viewport")).toBeInTheDocument()
  })
})