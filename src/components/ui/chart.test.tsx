import React from "react"
import { render, screen, renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@testing-library/jest-dom"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "ResponsiveContainer" }, children),
  Tooltip: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "Tooltip" }, children),
  Legend: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "Legend" }, children),
}))

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
}))

import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from "./chart"

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const qc = createClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("chart.tsx", () => {
  it("wraps hooks with QueryClientProvider using renderHook", () => {
    const qc = createClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => React.useState(1), { wrapper })
    expect(result.current[0]).toBe(1)
    act(() => {
      result.current[1](2)
    })
    expect(result.current[0]).toBe(2)
  })

  it("renders style tag with CSS variables when color config is provided", () => {
    const config: ChartConfig = {
      value: { color: "#123456" },
    }
    const { container } = renderWithClient(
      <ChartContainer id="chart1" config={config}>
        <div>child</div>
      </ChartContainer>
    )

    const styleTag = container.querySelector("style")
    expect(styleTag).not.toBeNull()
    expect(styleTag?.innerHTML).toContain("--color-value: #123456;")
    expect(screen.getByTestId("ResponsiveContainer")).toBeInTheDocument()
  })

  it("renders theme-based CSS variables for both light and dark", () => {
    const config: ChartConfig = {
      series: { theme: { light: "#000000", dark: "#ffffff" } },
    }
    const { container } = renderWithClient(
      <ChartContainer id="chart-theme" config={config}>
        <div>child</div>
      </ChartContainer>
    )

    const styleTag = container.querySelector("style")
    expect(styleTag).not.toBeNull()
    const css = styleTag?.innerHTML ?? ""
    expect(css).toContain("[data-chart=chart-chart-theme]")
    expect(css).toContain("--color-series: #000000;")
    expect(css).toContain("--color-series: #ffffff;")
  })

  it("does not render a style tag when there is no color/theme config", () => {
    const config = {} as ChartConfig
    const { container } = renderWithClient(
      <ChartContainer id="chart2" config={config}>
        <div>child</div>
      </ChartContainer>
    )

    const styleTag = container.querySelector("style")
    expect(styleTag).toBeNull()
  })

  it("renders tooltip content with configured label and value when active", () => {
    const config: ChartConfig = {
      Value: { label: "The Value" },
    }

    renderWithClient(
      <ChartContainer id="chart3" config={config}>
        <ChartTooltipContent
          active
          payload={[
            {
              name: "Value",
              dataKey: "value",
              value: 42,
              color: "#111",
              payload: {},
            } as unknown as any, // runtime payload structure from recharts
          ]}
        />
      </ChartContainer>
    )

    expect(screen.getByText("The Value")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("does not render tooltip content when not active", () => {
    const config: ChartConfig = {
      Value: { label: "The Value" },
    }

    renderWithClient(
      <ChartContainer id="chart4" config={config}>
        <ChartTooltipContent
          active={false}
          payload={[
            {
              name: "Value",
              dataKey: "value",
              value: 42,
              color: "#111",
              payload: {},
            } as unknown as any,
          ]}
        />
      </ChartContainer>
    )

    expect(screen.queryByText("The Value")).not.toBeInTheDocument()
  })

  it("renders legend content using configuration labels", () => {
    const config: ChartConfig = {
      A: { label: "Series A" },
      B: { label: "Series B" },
    }

    renderWithClient(
      <ChartContainer id="chart-legend" config={config}>
        <ChartLegendContent
          payload={[
            { value: "A", dataKey: "A", color: "#f00" },
            { value: "B", dataKey: "B", color: "#0f0" },
          ] as unknown as any}
        />
      </ChartContainer>
    )

    expect(screen.getByText("Series A")).toBeInTheDocument()
    expect(screen.getByText("Series B")).toBeInTheDocument()
  })
})