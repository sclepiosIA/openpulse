import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SortMenuPartenaires, type SortConfig } from '../SortMenuPartenaires'

describe('SortMenuPartenaires', () => {
  const defaultConfig: SortConfig = { field: 'nom', direction: 'asc' }
  const onSortChange = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('renders sort trigger button', () => {
    render(<SortMenuPartenaires sortConfig={defaultConfig} onSortChange={onSortChange} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('opens popover with sort options', async () => {
    render(<SortMenuPartenaires sortConfig={defaultConfig} onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText('Date création')).toBeInTheDocument()
    expect(screen.getByText('Ville')).toBeInTheDocument()
    expect(screen.getByText('Engagement')).toBeInTheDocument()
  })

  it('calls onSortChange with new field', async () => {
    render(<SortMenuPartenaires sortConfig={defaultConfig} onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(await screen.findByText('Ville'))
    expect(onSortChange).toHaveBeenCalledWith({ field: 'ville', direction: 'asc' })
  })

  it('toggles direction when clicking same field', async () => {
    render(<SortMenuPartenaires sortConfig={defaultConfig} onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button'))
    // "Nom" peut apparaître dans le trigger ET dans la popover — on clique sur celui dans la popover
    const nomButtons = await screen.findAllByText('Nom')
    fireEvent.click(nomButtons[nomButtons.length - 1])
    expect(onSortChange).toHaveBeenCalledWith({ field: 'nom', direction: 'desc' })
  })
})
