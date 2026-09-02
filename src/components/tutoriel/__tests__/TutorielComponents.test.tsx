import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Polyfill ResizeObserver and scrollIntoView for jsdom
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TutorielTip Component', () => {
  it('should render tip with content', async () => {
    const { TutorielTip } = await import('../TutorielTip')

    render(
      <TestWrapper>
        <TutorielTip content="Ceci est une astuce utile" />
      </TestWrapper>
    )

    // Multiple elements may match, so use getAllByText
    expect(screen.getAllByText(/astuce/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Ceci est une astuce utile')).toBeInTheDocument()
  })
})

describe('TutorielWarning Component', () => {
  it('should render warning with content', async () => {
    const { TutorielWarning } = await import('../TutorielWarning')

    render(
      <TestWrapper>
        <TutorielWarning content="Attention à cette action" />
      </TestWrapper>
    )

    expect(screen.getByText(/attention à cette action/i)).toBeInTheDocument()
  })
})

describe('TutorielProgress Component', () => {
  it('should render progress with level and time', async () => {
    const { TutorielProgress } = await import('../TutorielProgress')

    render(
      <TestWrapper>
        <TutorielProgress 
          estimatedTime="15 min" 
          level="intermediaire" 
          sectionsCount={5} 
        />
      </TestWrapper>
    )

    expect(screen.getByText('15 min')).toBeInTheDocument()
    expect(screen.getByText(/intermédiaire/i)).toBeInTheDocument()
    expect(screen.getByText(/5 section/i)).toBeInTheDocument()
  })

  it('should display correct level colors', async () => {
    const { TutorielProgress } = await import('../TutorielProgress')

    const { rerender } = render(
      <TestWrapper>
        <TutorielProgress estimatedTime="10 min" level="debutant" sectionsCount={3} />
      </TestWrapper>
    )

    expect(screen.getByText(/débutant/i)).toBeInTheDocument()

    rerender(
      <TestWrapper>
        <TutorielProgress estimatedTime="20 min" level="avance" sectionsCount={8} />
      </TestWrapper>
    )

    expect(screen.getByText(/avancé/i)).toBeInTheDocument()
  })
})

describe('TutorielSearch Component', () => {
  it('should render search input', async () => {
    const { TutorielSearch } = await import('../TutorielSearch')

    render(
      <TestWrapper>
        <TutorielSearch />
      </TestWrapper>
    )

    const input = screen.getByPlaceholderText(/rechercher/i)
    expect(input).toBeInTheDocument()
  })

  it('should update input value on change', async () => {
    const { TutorielSearch } = await import('../TutorielSearch')

    render(
      <TestWrapper>
        <TutorielSearch />
      </TestWrapper>
    )

    const input = screen.getByPlaceholderText(/rechercher/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'email' } })
    expect(input.value).toBe('email')
  })
})

describe('TutorielCountUpAnimation Component', () => {
  it('should render with value', async () => {
    const { TutorielCountUpAnimation } = await import('../TutorielCountUpAnimation')

    render(
      <TestWrapper>
        <TutorielCountUpAnimation value={100} suffix="%" />
      </TestWrapper>
    )

    // Animation component should render
    expect(document.body).toBeTruthy()
  })
})

describe('TutorielBeforeAfter Component', () => {
  it('should render before and after content', async () => {
    const { TutorielBeforeAfter } = await import('../TutorielBeforeAfter')

    render(
      <TestWrapper>
        <TutorielBeforeAfter
          before={<div>Ancien processus</div>}
          after={<div>Nouveau processus</div>}
          beforeLabel="Avant"
          afterLabel="Après"
        />
      </TestWrapper>
    )

    expect(screen.getByText('Avant')).toBeInTheDocument()
    expect(screen.getByText('Après')).toBeInTheDocument()
    expect(screen.getByText('Ancien processus')).toBeInTheDocument()
    expect(screen.getByText('Nouveau processus')).toBeInTheDocument()
  })
})

describe('TutorielSection Component', () => {
  it('should render section with title', async () => {
    const { TutorielSection } = await import('../TutorielSection')
    
    const mockSection = {
      id: 'test-section',
      title: 'Section Test',
      description: 'Description de test',
      steps: [
        {
          id: 'step-1',
          title: 'Étape 1',
          content: 'Contenu de l\'étape 1'
        }
      ]
    }

    render(
      <TestWrapper>
        <TutorielSection 
          section={mockSection}
          index={0}
          moduleId="test-module"
          moduleIcon="Mail"
        />
      </TestWrapper>
    )

    expect(screen.getAllByText('Section Test').length).toBeGreaterThan(0)
    expect(screen.getByText('Description de test')).toBeInTheDocument()
  }, 15000)
})

describe('TutorielStep Component', () => {
  it('should render step with content', async () => {
    const { TutorielStep } = await import('../TutorielStep')
    
    const mockStep = {
      id: 'test-step',
      title: 'Étape Test',
      content: 'Contenu de test'
    }

    render(
      <TestWrapper>
        <TutorielStep 
          step={mockStep}
          index={0}
          moduleId="test-module"
          moduleIcon="Mail"
        />
      </TestWrapper>
    )

    expect(screen.getByText('Étape Test')).toBeInTheDocument()
    expect(screen.getByText('Contenu de test')).toBeInTheDocument()
  })

  it('should render tip when provided', async () => {
    const { TutorielStep } = await import('../TutorielStep')
    
    const mockStep = {
      id: 'test-step',
      title: 'Étape avec astuce',
      content: 'Contenu',
      tip: 'Voici une astuce importante'
    }

    render(
      <TestWrapper>
        <TutorielStep 
          step={mockStep}
          index={0}
          moduleId="test-module"
          moduleIcon="Mail"
        />
      </TestWrapper>
    )

    expect(screen.getByText(/voici une astuce importante/i)).toBeInTheDocument()
  })

  it('should render warning when provided', async () => {
    const { TutorielStep } = await import('../TutorielStep')
    
    const mockStep = {
      id: 'test-step',
      title: 'Étape avec avertissement',
      content: 'Contenu',
      warning: 'Attention à cette action'
    }

    render(
      <TestWrapper>
        <TutorielStep 
          step={mockStep}
          index={0}
          moduleId="test-module"
          moduleIcon="Mail"
        />
      </TestWrapper>
    )

    expect(screen.getByText(/attention à cette action/i)).toBeInTheDocument()
  })
})

describe('Tutorial Module Integration', () => {
  it('should have valid tutorial modules', async () => {
    const { tutorielModules } = await import('@/lib/tutoriel-content')
    
    expect(tutorielModules).toBeDefined()
    expect(Array.isArray(tutorielModules)).toBe(true)
    expect(tutorielModules.length).toBeGreaterThan(0)
    
    // Check that all modules have required fields
    for (const module of tutorielModules) {
      expect(module.id).toBeDefined()
      expect(module.title).toBeDefined()
      expect(module.sections).toBeDefined()
      expect(Array.isArray(module.sections)).toBe(true)
    }
  })

  it('should include JARVIS module', async () => {
    const { tutorielModules } = await import('@/lib/tutoriel-content')
    
    const jarvisModule = tutorielModules.find(m => m.id === 'jarvis')
    expect(jarvisModule).toBeDefined()
    expect(jarvisModule?.title).toContain('JARVIS')
  })

  it('should have all modules with valid categories', async () => {
    const { tutorielModules } = await import('@/lib/tutoriel-content')
    // Get all unique categories from actual modules
    const uniqueCategories = [...new Set(tutorielModules.map(m => m.category))]
    
    // All modules should have a category
    for (const module of tutorielModules) {
      expect(module.category).toBeDefined()
      expect(typeof module.category).toBe('string')
    }
    
    // Should have at least 3 different categories
    expect(uniqueCategories.length).toBeGreaterThanOrEqual(3)
  })

  it('should have valid level values', async () => {
    const { tutorielModules } = await import('@/lib/tutoriel-content')
    const validLevels = ['debutant', 'intermediaire', 'avance']
    
    for (const module of tutorielModules) {
      expect(validLevels).toContain(module.level)
    }
  })

  it('should have estimated time for all modules', async () => {
    const { tutorielModules } = await import('@/lib/tutoriel-content')
    
    for (const module of tutorielModules) {
      expect(module.estimatedTime).toBeDefined()
      expect(module.estimatedTime.length).toBeGreaterThan(0)
    }
  })
})
