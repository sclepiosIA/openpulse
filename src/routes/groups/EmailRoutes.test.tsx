import type { ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes } from 'react-router-dom'

const { lazyControls, routeGuardSpy } = vi.hoisted(() => {
  let resolveEmails = () => {}
  const emailsPromise = new Promise<void>((resolve) => {
    resolveEmails = resolve
  })

  return {
    lazyControls: {
      shouldSuspendEmails: false,
      shouldErrorEmails: false,
      emailsPromise,
      resolveEmails,
    },
    routeGuardSpy: vi.fn<(strictAdminOnly: boolean | undefined) => void>(),
  }
})

vi.mock('@/components/ui/full-page-loader', () => ({
  FullPageLoader: () => <div>Chargement des emails</div>,
}))

vi.mock('@/components/ErrorBoundary', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react')
  const { Component } = ReactModule

  class MockErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    state = { hasError: false }

    static getDerivedStateFromError(_error: unknown) {
      return { hasError: true }
    }

    render() {
      if (this.state.hasError) {
        return <div>Route error</div>
      }

      return this.props.children
    }
  }

  return {
    ErrorBoundary: MockErrorBoundary,
  }
})

vi.mock('@/components/security/RouteGuard', () => ({
  RouteGuard: ({
    strictAdminOnly,
    children,
  }: {
    strictAdminOnly?: boolean
    children: ReactNode
  }) => {
    routeGuardSpy(strictAdminOnly)
    return <>{children}</>
  },
}))

vi.mock('../lazyPages', () => ({
  Emails: () => {
    if (lazyControls.shouldErrorEmails) {
      throw new Error('emails route failed')
    }

    if (lazyControls.shouldSuspendEmails) {
      throw lazyControls.emailsPromise
    }

    return <div>Emails page</div>
  },
  EmailTemplates: () => <div>Email templates page</div>,
  EmailAnalytics: () => <div>Email analytics page</div>,
  EmailClassificationAnalytics: () => <div>Email classification analytics page</div>,
  GestionEmailDomains: () => <div>Gestion email domains page</div>,
}))

import { EmailRoutes } from './EmailRoutes'

function renderEmailRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>{EmailRoutes()}</Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  routeGuardSpy.mockClear()
  lazyControls.shouldSuspendEmails = false
  lazyControls.shouldErrorEmails = false
})

describe('EmailRoutes', () => {
  it.each([
    ['/emails', 'Emails page'],
    ['/email-templates', 'Email templates page'],
    ['/email-analytics', 'Email analytics page'],
    ['/email-classification-analytics', 'Email classification analytics page'],
    ['/gestion-email-domains', 'Gestion email domains page'],
  ])('renders the expected email page for %s', (path, expectedText) => {
    renderEmailRoute(path)

    expect(screen.getByText(expectedText).textContent).toBe(expectedText)
  })

  it('wraps gestion email domains route in a strict admin RouteGuard', () => {
    renderEmailRoute('/gestion-email-domains')

    expect(screen.getByText('Gestion email domains page').textContent).toBe('Gestion email domains page')
    expect(routeGuardSpy).toHaveBeenCalledTimes(1)
    expect(routeGuardSpy).toHaveBeenCalledWith(true)
  })

  it('does not render the strict admin RouteGuard for non-admin email routes', () => {
    renderEmailRoute('/email-analytics')

    expect(screen.getByText('Email analytics page').textContent).toBe('Email analytics page')
    expect(routeGuardSpy).not.toHaveBeenCalled()
  })

  it('shows the full page loader while a suspended email page is loading, then renders the page', async () => {
    lazyControls.shouldSuspendEmails = true

    renderEmailRoute('/emails')

    expect(screen.getByText('Chargement des emails').textContent).toBe('Chargement des emails')

    await act(async () => {
      lazyControls.shouldSuspendEmails = false
      lazyControls.resolveEmails()
      await lazyControls.emailsPromise
    })

    await waitFor(() => {
      expect(screen.getByText('Emails page').textContent).toBe('Emails page')
    })
  })

  it('renders the error boundary fallback when an email route throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    lazyControls.shouldErrorEmails = true

    try {
      renderEmailRoute('/emails')

      expect(screen.getByText('Route error').textContent).toBe('Route error')
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})