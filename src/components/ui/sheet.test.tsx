import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from './sheet'

describe('sheet.tsx', () => {
  it('exporte tous les composants attendus', () => {
    expect(Sheet).toBeDefined()
    expect(SheetTrigger).toBeDefined()
    expect(SheetClose).toBeDefined()
    expect(SheetContent).toBeDefined()
    expect(SheetDescription).toBeDefined()
    expect(SheetFooter).toBeDefined()
    expect(SheetHeader).toBeDefined()
    expect(SheetOverlay).toBeDefined()
    expect(SheetPortal).toBeDefined()
    expect(SheetTitle).toBeDefined()
  })

  it('ouvre la sheet via le trigger et affiche le contenu, le titre et la description', () => {
    render(
      <Sheet>
        <SheetTrigger>Open panel</SheetTrigger>
        <SheetContent>
          <SheetHeader data-testid="header">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Manage your preferences</SheetDescription>
          </SheetHeader>
          <div>Body content</div>
          <SheetFooter data-testid="footer">
            <button type="button">Save</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )

    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    expect(screen.queryByText('Manage your preferences')).not.toBeInTheDocument()
    expect(screen.queryByText('Body content')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Open panel'))

    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Manage your preferences')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByTestId('header')).toHaveClass(
      'flex',
      'flex-col',
      'space-y-2',
      'text-center',
      'sm:text-left'
    )
    expect(screen.getByTestId('footer')).toHaveClass(
      'flex',
      'flex-col-reverse',
      'sm:flex-row',
      'sm:justify-end',
      'sm:space-x-2'
    )
  })

  it('applique les classes par défaut sur SheetContent avec side=right', () => {
    render(
      <Sheet open>
        <SheetContent data-testid="content">Content</SheetContent>
      </Sheet>
    )

    const content = screen.getByTestId('content')
    expect(content).toHaveClass('fixed', 'z-50', 'gap-4', 'bg-background', 'p-6', 'shadow-overlay')
    expect(content).toHaveClass(
      'inset-y-0',
      'right-0',
      'h-full',
      'w-3/4',
      'border-l',
      'sm:max-w-sm'
    )
    expect(content).toHaveClass(
      'data-[state=closed]:slide-out-to-right',
      'data-[state=open]:slide-in-from-right'
    )
  })

  it('applique les classes de variante side=left', () => {
    render(
      <Sheet open>
        <SheetContent side="left" data-testid="content-left">
          Left content
        </SheetContent>
      </Sheet>
    )

    const content = screen.getByTestId('content-left')
    expect(content).toHaveClass('inset-y-0', 'left-0', 'h-full', 'w-3/4', 'border-r', 'sm:max-w-sm')
    expect(content).toHaveClass(
      'data-[state=closed]:slide-out-to-left',
      'data-[state=open]:slide-in-from-left'
    )
  })

  it('applique les classes de variante side=top', () => {
    render(
      <Sheet open>
        <SheetContent side="top" data-testid="content-top">
          Top content
        </SheetContent>
      </Sheet>
    )

    const content = screen.getByTestId('content-top')
    expect(content).toHaveClass('inset-x-0', 'top-0', 'border-b')
    expect(content).toHaveClass(
      'data-[state=closed]:slide-out-to-top',
      'data-[state=open]:slide-in-from-top'
    )
  })

  it('applique les classes de variante side=bottom', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom" data-testid="content-bottom">
          Bottom content
        </SheetContent>
      </Sheet>
    )

    const content = screen.getByTestId('content-bottom')
    expect(content).toHaveClass('inset-x-0', 'bottom-0', 'border-t')
    expect(content).toHaveClass(
      'data-[state=closed]:slide-out-to-bottom',
      'data-[state=open]:slide-in-from-bottom'
    )
  })

  it('fusionne className personnalisée sur overlay, content, title et description', () => {
    render(
      <Sheet open>
        <SheetOverlay data-testid="overlay-direct" className="overlay-extra" />
        <SheetContent data-testid="content" className="content-extra">
          <SheetTitle data-testid="title" className="title-extra">
            Custom title
          </SheetTitle>
          <SheetDescription data-testid="description" className="description-extra">
            Custom description
          </SheetDescription>
        </SheetContent>
      </Sheet>
    )

    expect(screen.getByTestId('overlay-direct')).toHaveClass(
      'fixed',
      'inset-0',
      'z-50',
      'bg-black/80',
      'overlay-extra'
    )
    expect(screen.getByTestId('content')).toHaveClass('content-extra')
    expect(screen.getByTestId('title')).toHaveClass(
      'text-lg',
      'font-semibold',
      'text-foreground',
      'title-extra'
    )
    expect(screen.getByTestId('description')).toHaveClass(
      'text-sm',
      'text-muted-foreground',
      'description-extra'
    )
  })

  it('ferme la sheet via le bouton close intégré', () => {
    render(
      <Sheet>
        <SheetTrigger>Open dialog</SheetTrigger>
        <SheetContent>
          <div>Closable content</div>
        </SheetContent>
      </Sheet>
    )

    fireEvent.click(screen.getByText('Open dialog'))
    expect(screen.getByText('Closable content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Closable content')).not.toBeInTheDocument()
  })

  it('ferme la sheet via SheetClose personnalisé', () => {
    render(
      <Sheet>
        <SheetTrigger>Launch</SheetTrigger>
        <SheetContent>
          <div>Inline close content</div>
          <SheetClose asChild>
            <button type="button">Dismiss panel</button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    )

    fireEvent.click(screen.getByText('Launch'))
    expect(screen.getByText('Inline close content')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Dismiss panel'))
    expect(screen.queryByText('Inline close content')).not.toBeInTheDocument()
  })

  it('supporte le passage de props HTML sur header et footer', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader data-testid="header" id="header-id" aria-label="sheet header">
            Header area
          </SheetHeader>
          <SheetFooter data-testid="footer" id="footer-id" aria-label="sheet footer">
            Footer area
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )

    const header = screen.getByTestId('header')
    const footer = screen.getByTestId('footer')

    expect(header).toHaveAttribute('id', 'header-id')
    expect(header).toHaveAttribute('aria-label', 'sheet header')
    expect(header).toHaveTextContent('Header area')

    expect(footer).toHaveAttribute('id', 'footer-id')
    expect(footer).toHaveAttribute('aria-label', 'sheet footer')
    expect(footer).toHaveTextContent('Footer area')
  })
})
