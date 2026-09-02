import * as React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Checkbox } from "./checkbox"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } }
})

vi.mock("@radix-ui/react-checkbox", () => {
  const React = require("react")
  return {
    __esModule: true,
    Root: React.forwardRef((props: any, ref: any) =>
      React.createElement(
        "div",
        { "data-testid": "checkbox-root", ref, ...props },
        props?.children
      )
    ),
    Indicator: React.forwardRef((props: any, ref: any) =>
      React.createElement(
        "span",
        { "data-testid": "checkbox-indicator", ref, ...props },
        props?.children
      )
    ),
  }
})

vi.mock("lucide-react", () => {
  const React = require("react")
  return {
    Check: (props: any) => React.createElement("span", { "data-testid": "check-icon", ...props }, "✓"),
  }
})

vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}))

describe("Checkbox component", () => {
  const Wrapper: React.FC = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it("renders root, indicator and check icon", () => {
    const { getByTestId } = render(<Checkbox />, { wrapper: Wrapper })
    expect(getByTestId("checkbox-root")).toBeInTheDocument()
    expect(getByTestId("checkbox-indicator")).toBeInTheDocument()
    expect(getByTestId("check-icon")).toBeInTheDocument()
  })

  it("forwards ref to the root element", () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<Checkbox ref={ref} />, { wrapper: Wrapper })
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it("applies extra className to the root element", () => {
    const { getByTestId } = render(<Checkbox className="foo" />, { wrapper: Wrapper })
    const root = getByTestId("checkbox-root")
    expect(root).toHaveClass("foo")
  })
})