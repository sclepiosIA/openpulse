import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Routes } from 'react-router-dom'
import { MobileRoutes } from './MobileRoutes'

const { labels, mailPromise, resolveMail } = vi.hoisted(() => {
  let resolver: () => void = () => {}
  const mailPromise = new Promise<void>((res) => {
    resolver = res
  })
  return {
    labels: {
      loader: 'FullPageLoader',
      mail: 'Mail Mobile App',
      todos: 'Todos Mobile App',
      pulse: 'Pulse Mobile App',
      calendar: 'Calendar Mobile App',
      documents: 'Documents Mobile App',
      booking: 'Booking Mobile App',
      jarvis: 'Jarvis Mobile App',
      install: 'Apps Install Mobile',
      jarvisError: 'Jarvis exploded',
    },
    mailPromise,
    resolveMail: resolver,
  }
})

vi.mock('@/components/ui/full-page-loader', () => {
  return {
    FullPageLoader: () => <div data-testid="full-loader">{labels.loader}</div>,
  }
})

vi.mock('@/components/ErrorBoundary', () => {
  class MockErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
      super(props)
      this.state = { error: null }
    }
    static getDerivedStateFromError(error: Error) {
      return { error }
    }
    componentDidCatch() {}
    render() {
      if (this.state.error) {
        return <div role="alert">Error: {this.state.error.message}</div>
      }
      return this.props.children
    }
  }
  return {
    ErrorBoundary: MockErrorBoundary,
  }
})

vi.mock('../lazyPages', () => {
  let mailDone = false
  mailPromise.then(() => {
    mailDone = true
  })

  const MobileMailApp = () => {
    if (!mailDone) {
      throw mailPromise
    }
    return <div>{labels.mail}</div>
  }
  const MobileTodosApp = () => <div>{labels.todos}</div>
  const MobilePulseApp = () => <div>{labels.pulse}</div>
  const MobileCalendarApp = () => <div>{labels.calendar}</div>
  const MobileDocumentsApp = () => <div>{labels.documents}</div>
  const MobileBookingApp = () => <div>{labels.booking}</div>
  const MobileJarvisApp = () => {
    throw new Error(labels.jarvisError)
  }
  const MobileAppsInstall = () => <div>{labels.install}</div>

  return {
    MobileMailApp,
    MobileTodosApp,
    MobilePulseApp,
    MobileCalendarApp,
    MobileDocumentsApp,
    MobileBookingApp,
    MobileJarvisApp,
    MobileAppsInstall,
  }
})

describe('MobileRoutes', () => {
  it('affiche le loader pendant le chargement et rend le composant MobileMailApp après', async () => {
    render(
      <MemoryRouter initialEntries={['/m/mail']}>
        <Routes>{MobileRoutes()}</Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('full-loader')).toHaveTextContent(labels.loader)

    await act(async () => {
      resolveMail()
      await Promise.resolve()
    })

    const content = await screen.findByText(labels.mail)
    expect(content).toBeInTheDocument()
    expect(screen.queryByTestId('full-loader')).toBeNull()
  })

  it('rend directement le composant MobileDocumentsApp sans loader si pas de suspension', async () => {
    render(
      <MemoryRouter initialEntries={['/m/documents']}>
        <Routes>{MobileRoutes()}</Routes>
      </MemoryRouter>
    )

    expect(screen.getByText(labels.documents)).toBeInTheDocument()
    expect(screen.queryByTestId('full-loader')).toBeNull()
  })

  it('capture les erreurs via ErrorBoundary pour MobileJarvisApp', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/m/jarvis']}>
        <Routes>{MobileRoutes()}</Routes>
      </MemoryRouter>
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(`Error: ${labels.jarvisError}`)

    errSpy.mockRestore()
  })
})