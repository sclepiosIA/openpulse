import React from "react"
import { render, fireEvent, screen, act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { mockRpc, mockToast, debugMock } = vi.hoisted(() => {
  return {
    mockRpc: vi.fn(),
    mockToast: vi.fn(),
    debugMock: {
      log: vi.fn(),
      error: vi.fn(),
    },
  }
})

vi.mock("@/lib/supabaseBrowser", () => {
  return {
    supabase: {
      rpc: mockRpc,
    },
  }
})

vi.mock("@/hooks/shared/use-toast", () => {
  return {
    useToast: () => ({ toast: mockToast }),
  }
})

vi.mock("@/lib/debug", () => {
  return { debug: debugMock }
})

vi.mock("@/components/ui/button", () => {
  const React = require("react")
  return {
    Button: ({ children, ...props }: any) => {
      return React.createElement("button", { ...props, type: "button" }, children)
    },
  }
})

vi.mock("@/components/ui/alert-dialog", () => {
  const React = require("react")
  return {
    AlertDialog: ({ children }: any) => React.createElement(React.Fragment, null, children),
    AlertDialogTrigger: ({ children }: any) => React.createElement(React.Fragment, null, children),
    AlertDialogContent: ({ children }: any) => React.createElement("div", null, children),
    AlertDialogHeader: ({ children }: any) => React.createElement("div", null, children),
    AlertDialogTitle: ({ children }: any) => React.createElement("div", null, children),
    AlertDialogDescription: ({ children }: any) => React.createElement("div", null, children),
    AlertDialogFooter: ({ children }: any) => React.createElement("div", null, children),
    AlertDialogCancel: ({ children }: any) => React.createElement("button", { type: "button" }, children),
    AlertDialogAction: ({ children, onClick, ...props }: any) =>
      React.createElement("button", { type: "button", onClick, ...props }, children),
  }
})

vi.mock("lucide-react", () => {
  const React = require("react")
  return {
    RefreshCw: (props: any) => React.createElement("svg", props, null),
    AlertTriangle: (props: any) => React.createElement("svg", props, null),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

const Wrapper = ({ children }: any) => {
  const client = createQueryClient()
  return React.createElement(QueryClientProvider, { client }, children)
}

describe("ResetProspectTasksButton", () => {
  it("useToast hook provides the stable toast function (renderHook wrapper)", async () => {
    const { useToast } = await import("@/hooks/shared/use-toast")
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })
    expect(typeof result.current.toast).toBe("function")
    act(() => {
      result.current.toast({ title: "t" })
    })
    expect(mockToast).toHaveBeenCalledWith({ title: "t" })
  })

  it("shows loading state while rpc pending and then shows success toast with correct totals", async () => {
    let resolveDeferred: (value: any) => void = () => {}
    const deferred = new Promise<any>((res) => {
      resolveDeferred = res
    })
    mockRpc.mockImplementationOnce(() => deferred)

    const { ResetProspectTasksButton } = await import("./ResetProspectTasksButton")
    render(React.createElement(ResetProspectTasksButton))

    const triggerButton = screen.getByRole("button", { name: /Réinitialiser les tâches prospects/ })
    expect(triggerButton).toBeInTheDocument()
    expect(triggerButton).not.toBeDisabled()

    const actionButton = screen.getByRole("button", { name: /^Réinitialiser$/ })
    await act(async () => {
      fireEvent.click(actionButton)
    })

    const triggerWhileLoading = screen.getByRole("button", { name: /Réinitialiser les tâches prospects/ })
    expect(triggerWhileLoading).toBeDisabled()

    const sampleResults = [
      {
        etablissement_id: "e1",
        etablissement_nom: "E1",
        anciennes_taches: 2,
        nouvelles_taches: 3,
      },
      {
        etablissement_id: "e2",
        etablissement_nom: "E2",
        anciennes_taches: 1,
        nouvelles_taches: 4,
      },
    ]
    await act(async () => {
      resolveDeferred({ data: sampleResults, error: null })
      await deferred
    })

    expect(mockToast).toHaveBeenCalled()
    const toastArg = mockToast.mock.calls[mockToast.mock.calls.length - 1][0]
    expect(toastArg.title).toBe("Réinitialisation terminée")
    expect(typeof toastArg.description).toBe("string")
    expect(toastArg.description).toContain("2 prospects")
    expect(toastArg.description).toContain("3 anciennes tâches supprimées")
    expect(toastArg.description).toContain("7 nouvelles tâches créées")

    expect(debugMock.log).toHaveBeenCalled()
    const debugArg = debugMock.log.mock.calls[0][1]
    expect(Array.isArray(debugArg)).toBe(true)
    expect(debugArg.length).toBe(2)
    expect(debugArg[0].etablissement_id).toBe("e1")

    const triggerAfter = screen.getByRole("button", { name: /Réinitialiser les tâches prospects/ })
    expect(triggerAfter).not.toBeDisabled()
  })

  it("handles rpc error response and shows destructive error toast and logs error", async () => {
    mockRpc.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: "erreur rpc" } }))

    const { ResetProspectTasksButton } = await import("./ResetProspectTasksButton")
    render(React.createElement(ResetProspectTasksButton))

    const actionButton = screen.getByRole("button", { name: /^Réinitialiser$/ })

    await act(async () => {
      fireEvent.click(actionButton)
      await Promise.resolve()
    })

    expect(mockToast).toHaveBeenCalled()
    const call = mockToast.mock.calls.find((c) => c[0]?.title === "Erreur")
    expect(call).toBeDefined()
    const errorToast = call ? call[0] : null
    expect(errorToast.variant).toBe("destructive")
    expect(errorToast.description).toContain("Impossible de réinitialiser les tâches prospect")

    expect(debugMock.error).toHaveBeenCalled()
    const debugErrorArg = debugMock.error.mock.calls[0][1]
    expect(debugErrorArg).toEqual({ message: "erreur rpc" })
  })
})