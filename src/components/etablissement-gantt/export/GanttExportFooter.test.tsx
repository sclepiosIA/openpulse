const { COMPANY_OK, COMPANY_LOADING, COMPANY_ERROR, mockUseCompanyInfo } = vi.hoisted(() => {
  const COMPANY_OK = {
    data: { name: 'Acme Corp', email: 'contact@acme.example', phone: '+33199001234' },
    isLoading: false,
    isError: false,
    error: null,
  }
  const COMPANY_LOADING = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  }
  const COMPANY_ERROR = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  }
  const mockUseCompanyInfo = vi.fn(() => COMPANY_LOADING)
  return { COMPANY_OK, COMPANY_LOADING, COMPANY_ERROR, mockUseCompanyInfo }
})

vi.mock('@/hooks/shared/useAppConfig', () => ({
  useCompanyInfo: () => mockUseCompanyInfo(),
}))

import React from 'react'
import { render, screen, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { generateGanttExportFooterHTML, GanttExportFooter } from './GanttExportFooter'
import { useCompanyInfo } from '@/hooks/shared/useAppConfig'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 0, gcTime: 0 },
    mutations: { retry: 0 },
  },
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('generateGanttExportFooterHTML', () => {
  it('renders defaults when no company info provided and no pagination', () => {
    const html = generateGanttExportFooterHTML({}, undefined)
    const year = String(new Date().getFullYear())

    expect(html).toContain('OpenPulse')
    expect(html).toContain(`Tous droits réservés © ${year}`)
    expect(html).not.toContain('Page')
  })

  it('includes provided company info and pagination when given', () => {
    const html = generateGanttExportFooterHTML(
      { pageNumber: 2, totalPages: 5 },
      { name: 'Acme Ltd', email: 'hello@acme.test', phone: '+449876543210' }
    )

    expect(html).toContain('Acme Ltd')
    expect(html).toContain('hello@acme.test')
    expect(html).toContain('+449876543210')
    expect(html).toContain('Page 2 / 5')
  })
})

describe('GanttExportFooter component + useCompanyInfo integration', () => {
  it('shows default company name while useCompanyInfo is loading and displays pagination', () => {
    mockUseCompanyInfo.mockReturnValue(COMPANY_LOADING)

    const { result } = renderHook(() => useCompanyInfo(), { wrapper: Wrapper })
    expect(result.current.isLoading).toBe(true)
    // render component
    render(
      <GanttExportFooter pageNumber={1} totalPages={3} />,
      { wrapper: Wrapper }
    )

    // defaults used when loading
    expect(screen.getByText('OpenPulse')).toBeTruthy()
    // pagination should be shown because both pageNumber and totalPages are truthy
    expect(screen.getByText('Page 1 / 3')).toBeTruthy()
  })

  it('renders real company info when hook returns data', () => {
    mockUseCompanyInfo.mockReturnValue(COMPANY_OK)

    const { result } = renderHook(() => useCompanyInfo(), { wrapper: Wrapper })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual(COMPANY_OK.data)

    render(<GanttExportFooter pageNumber={4} totalPages={10} />, { wrapper: Wrapper })

    // Assert the actual company values are rendered
    expect(screen.getByText('Acme Corp')).toBeTruthy()
    expect(screen.getByText('contact@acme.example')).toBeTruthy()
    expect(screen.getByText('+33199001234')).toBeTruthy()
    expect(screen.getByText('Page 4 / 10')).toBeTruthy()
  })

  it('exposes error via hook and component falls back to defaults when data is null', () => {
    mockUseCompanyInfo.mockReturnValue(COMPANY_ERROR)

    const { result } = renderHook(() => useCompanyInfo(), { wrapper: Wrapper })
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: 'x' })

    render(<GanttExportFooter />, { wrapper: Wrapper })

    // When data is null the component should use the fallback name
    expect(screen.getByText('OpenPulse')).toBeTruthy()
    // No pagination provided => should not render any "Page" text
    expect(screen.queryByText(/Page/)).toBeNull()
  })
})