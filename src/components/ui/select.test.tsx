import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./select"

vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}))

// Stable hoisted mocks to satisfy the requirement about stable references
const { ROWS, mockFrom } = vi.hoisted(() => {
  const ROWS = [
    { id: "1", label: "One" },
    { id: "2", label: "Two" },
  ]
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: ROWS }),
    maybeSingle: vi.fn().mockResolvedValue({ data: ROWS }),
  }))
  return { ROWS, mockFrom }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    // provide a minimal builder surface
    select: mockFrom,
    eq: mockFrom,
    gte: mockFrom,
    lte: mockFrom,
    in: mockFrom,
    order: mockFrom,
    limit: mockFrom,
    insert: mockFrom,
    update: mockFrom,
    delete: mockFrom,
  },
}))

// Optional: mock other internal dependencies if imported by code under test
vi.mock("@/hooks/*", () => ({}))
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "t@t.co" },
    isLoading: false,
  }),
}))
vi.mock("@/components/AuthProvider", () => ({
  AuthProvider: ({ children }: any) => children,
}))
vi.mock("react-router", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

describe("Select component (./select)", () => {
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    wrapper = ({ children }) => {
      const client = createQueryClient()
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders and allows selecting an item -> onValueChange is called with the selected value", async () => {
    const onValueChange = vi.fn()
    const TestHarness: React.FC = () => {
      const [val, setVal] = React.useState<string | undefined>(undefined)

      const handleValueChange = (v: string) => {
        setVal(v)
        onValueChange(v)
      }

      return (
        <Select value={val} onValueChange={handleValueChange}>
          <SelectTrigger>
            <SelectValue>{val ?? ""}</SelectValue>
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="1">One</SelectItem>
            <SelectItem value="2">Two</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    render(<TestHarness />, { wrapper })

    // Open the dropdown (Radix uses role "combobox" for the trigger)
    const trigger = screen.getByRole("combobox")
    await act(async () => {
      fireEvent.click(trigger)
    })

    // Click on "Two"
    const itemTwo = screen.getByText("Two")
    await act(async () => {
      fireEvent.click(itemTwo)
    })

    expect(onValueChange).toHaveBeenCalledWith("2")
  })

  it("renders with no value selected initially", () => {
    const TestHarness: React.FC = () => {
      const [val] = React.useState<string | undefined>(undefined)
      return (
        <Select value={val} onValueChange={() => {}}>
          <SelectTrigger>
            <SelectValue>{val ?? ""}</SelectValue>
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="1">One</SelectItem>
            <SelectItem value="2">Two</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    render(<TestHarness />, { wrapper })

    // Trigger should be present
    const trigger = screen.getByRole("combobox")
    expect(trigger).toBeInTheDocument()
  })
})