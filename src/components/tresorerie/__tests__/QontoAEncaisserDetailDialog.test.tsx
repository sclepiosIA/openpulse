import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QontoAEncaisserDetailDialog } from '../QontoAEncaisserDetailDialog'

describe('QontoAEncaisserDetailDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <QontoAEncaisserDetailDialog
        open={false}
        onOpenChange={vi.fn()}
        invoices={[]}
        totalAEncaisser={0}
      />
    )
    expect(screen.queryByText(/À encaisser/)).not.toBeInTheDocument()
  })

  it('renders dialog when open with empty invoices', () => {
    render(
      <QontoAEncaisserDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        invoices={[]}
        totalAEncaisser={15000}
      />
    )
    // Le titre du dialog contient "Factures Qonto à encaisser" mais peut être éclaté entre icone et texte
    // On vérifie via le message "Aucune facture à encaisser dans Qonto" affiché quand invoices=[]
    expect(screen.getByText(/Aucune facture à encaisser/)).toBeInTheDocument()
  })
})
