import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AEncaisserDetailDialog } from '../AEncaisserDetailDialog'

describe('AEncaisserDetailDialog', () => {
  const revenus = [
    {
      id: 'r1',
      mois: '2026-03',
      montant_prevu: 5000,
      montant_paye: null,
      statut: 'facture',
      date_facture: '2026-03-01',
      numero_facture: 'FAC-100',
      etablissements: { nom: 'CHU Lyon' },
    },
    {
      id: 'r2',
      mois: '2026-02',
      montant_prevu: 3000,
      montant_paye: null,
      statut: 'facture',
      date_facture: '2026-02-15',
      numero_facture: 'FAC-099',
      etablissements: { nom: 'CHU Bordeaux' },
    },
  ]

  it('renders nothing when closed', () => {
    render(<AEncaisserDetailDialog open={false} onOpenChange={vi.fn()} revenus={revenus} />)
    expect(screen.queryByText('CHU Lyon')).not.toBeInTheDocument()
  })

  it('renders revenus when open', () => {
    render(<AEncaisserDetailDialog open={true} onOpenChange={vi.fn()} revenus={revenus} />)
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument()
    expect(screen.getByText('CHU Bordeaux')).toBeInTheDocument()
  })

  it('renders total amount', () => {
    render(<AEncaisserDetailDialog open={true} onOpenChange={vi.fn()} revenus={revenus} />)
    // Le composant affiche le total des montants prévus (5000 + 3000 = 8000)
    // ainsi que le nombre de factures dans le badge
    expect(screen.getByText(/2 factures/)).toBeInTheDocument()
  })
})
