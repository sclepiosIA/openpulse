import { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RestrictedDataBadge } from "./restricted-data-badge"

const { mockBadge, mockTooltipProvider, mockTooltip, mockTooltipTrigger, mockTooltipContent } = vi.hoisted(() => {
  return {
    mockBadge: vi.fn(({ children, ...props }: { children: ReactNode }) => (
      <div data-testid="badge" {...props}>
        {children}
      </div>
    )),
    mockTooltipProvider: vi.fn(({ children }: { children: ReactNode }) => (
      <div data-testid="tooltip-provider">{children}</div>
    )),
    mockTooltip: vi.fn(({ children }: { children: ReactNode }) => (
      <div data-testid="tooltip">{children}</div>
    )),
    mockTooltipTrigger: vi.fn(({ children }: { children: ReactNode }) => (
      <button data-testid="tooltip-trigger">{children}</button>
    )),
    mockTooltipContent: vi.fn(({ children }: { children: ReactNode }) => (
      <div data-testid="tooltip-content">{children}</div>
    )),
  }
})

vi.mock("@/components/ui/badge", () => ({
  Badge: mockBadge,
}))

vi.mock("lucide-react", () => ({
  AlertCircle: (props: { className?: string }) => <svg data-testid="alert-circle" {...props} />,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: mockTooltipProvider,
  Tooltip: mockTooltip,
  TooltipTrigger: mockTooltipTrigger,
  TooltipContent: mockTooltipContent,
}))

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe("RestrictedDataBadge", () => {
  it("renders the badge with default text and icon", () => {
    renderWithQuery(<RestrictedDataBadge />)

    const badge = screen.getByTestId("badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent("Données restreintes")

    const icon = screen.getByTestId("alert-circle")
    expect(icon).toBeInTheDocument()
  })

  it("applies the provided className to the badge", () => {
    renderWithQuery(<RestrictedDataBadge className="custom-class" />)

    const badge = screen.getByTestId("badge")
    expect(badge.className).toContain("custom-class")
    expect(badge.className).toContain("text-xs")
    expect(badge.className).toContain("gap-1")
  })

  it("renders tooltip structure and content", async () => {
    const user = userEvent.setup()
    renderWithQuery(<RestrictedDataBadge />)

    const trigger = screen.getByTestId("tooltip-trigger")
    expect(trigger).toBeInTheDocument()

    await user.hover(trigger)

    const tooltipContent = screen.getByTestId("tooltip-content")
    expect(tooltipContent).toBeInTheDocument()
    expect(tooltipContent).toHaveTextContent("Lecture limitée par les permissions de sécurité")
  })
})