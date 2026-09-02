/* @vitest-environment jsdom */

import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TutorielSidebar } from './TutorielSidebar'

const { MODULES, CATEGORIES } = vi.hoisted(() => ({
  MODULES: [
    {
      id: 'mod-1',
      title: 'Introduction',
      sections: [
        { id: 'sec-1', title: 'Bienvenue' },
        { id: 'sec-2', title: 'Installation' },
      ],
    },
    {
      id: 'mod-2',
      title: 'Approfondir',
      sections: [
        { id: 'sec-3', title: 'Concepts' },
      ],
    },
  ],
  CATEGORIES: [
    {
      id: 'cat-1',
      label: 'Démarrage',
      modules: ['mod-1', 'missing-module'],
    },
    {
      id: 'cat-2',
      label: 'Avancé',
      modules: ['mod-2'],
    },
    {
      id: 'cat-empty',
      label: 'Vide',
      modules: ['unknown-a', 'unknown-b'],
    },
  ],
}))

vi.mock('lucide-react', () => ({
  ChevronRight: ({ className }: { className?: string }) =>
    React.createElement('svg', { 'data-testid': 'chevron-icon', className }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/types/tutoriel', () => ({
  TUTORIEL_CATEGORIES: CATEGORIES,
}))

vi.mock('@/lib/tutoriel-content', () => ({
  getModuleById: (id: string) => MODULES.find((module) => module.id === id) ?? null,
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode; defaultOpen?: boolean }) =>
    React.createElement('div', null, children),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) =>
    React.createElement(React.Fragment, null, children),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'collapsible-content' }, children),
}))

function renderSidebar(props?: React.ComponentProps<typeof TutorielSidebar>) {
  return render(
    <MemoryRouter>
      <TutorielSidebar {...props} />
    </MemoryRouter>
  )
}

describe('TutorielSidebar', () => {
  it('affiche les catégories avec uniquement les modules résolus', () => {
    renderSidebar()

    expect(screen.getByText('Démarrage')).toBeInTheDocument()
    expect(screen.getByText('Avancé')).toBeInTheDocument()
    expect(screen.queryByText('Vide')).not.toBeInTheDocument()

    const introLink = screen.getByRole('link', { name: /introduction/i })
    const advancedLink = screen.getByRole('link', { name: /approfondir/i })

    expect(introLink).toHaveAttribute('href', '/tutoriels/mod-1')
    expect(advancedLink).toHaveAttribute('href', '/tutoriels/mod-2')
    expect(screen.queryByText('missing-module')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bienvenue' })).not.toBeInTheDocument()
  })

  it('ouvre le module actif et affiche ses sections avec la section courante mise en avant', () => {
    renderSidebar({ currentModuleId: 'mod-1', currentSectionId: 'sec-2' })

    const introLink = screen.getByRole('link', { name: /introduction/i })
    const advancedLink = screen.getByRole('link', { name: /approfondir/i })

    expect(introLink.className).toContain('bg-primary/10')
    expect(introLink.className).toContain('text-primary')
    expect(introLink.className).toContain('font-medium')

    expect(advancedLink.className).toContain('hover:bg-accent')
    expect(advancedLink.className).toContain('text-foreground')

    const sectionWelcome = screen.getByRole('link', { name: 'Bienvenue' })
    const sectionInstall = screen.getByRole('link', { name: 'Installation' })

    expect(sectionWelcome).toHaveAttribute('href', '/tutoriels/mod-1#sec-1')
    expect(sectionInstall).toHaveAttribute('href', '/tutoriels/mod-1#sec-2')

    expect(sectionInstall.className).toContain('bg-primary/5')
    expect(sectionInstall.className).toContain('text-primary')
    expect(sectionWelcome.className).toContain('text-muted-foreground')
    expect(sectionWelcome.className).toContain('hover:text-foreground')

    expect(screen.queryByRole('link', { name: 'Concepts' })).not.toBeInTheDocument()

    const introItem = introLink.closest('li')
    const advancedItem = advancedLink.closest('li')

    expect(introItem).not.toBeNull()
    expect(advancedItem).not.toBeNull()

    const introChevron = within(introItem as HTMLElement).getByTestId('chevron-icon')
    const advancedChevron = within(advancedItem as HTMLElement).getByTestId('chevron-icon')

    expect(introChevron.getAttribute('class')).toContain('rotate-90')
    expect(advancedChevron.getAttribute('class')).not.toContain('rotate-90')
  })

  it('n’affiche aucune section quand aucun module courant ne correspond', () => {
    renderSidebar({ currentModuleId: 'unknown-module', currentSectionId: 'sec-1' })

    expect(screen.queryByRole('link', { name: 'Bienvenue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Installation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Concepts' })).not.toBeInTheDocument()

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)

    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Démarrage')).toBeInTheDocument()
    expect(within(nav).getByText('Avancé')).toBeInTheDocument()

    const chevrons = screen.getAllByTestId('chevron-icon')
    expect(chevrons).toHaveLength(2)
    expect(chevrons[0].getAttribute('class')).not.toContain('rotate-90')
    expect(chevrons[1].getAttribute('class')).not.toContain('rotate-90')
  })
})