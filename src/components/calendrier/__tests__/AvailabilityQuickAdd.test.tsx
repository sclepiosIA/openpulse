import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createAvailability = vi.fn().mockResolvedValue({ id: 'a1' })

vi.mock('@/hooks/bookings/useAvailabilities', () => ({
  useAvailabilities: () => ({
    createAvailability,
    isCreating: false,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}))

import { AvailabilityQuickAdd } from '../AvailabilityQuickAdd'

const renderCmp = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AvailabilityQuickAdd defaultDate={new Date('2026-06-15T00:00:00')} />
    </QueryClientProvider>
  )
}

describe('AvailabilityQuickAdd', () => {
  beforeEach(() => createAvailability.mockClear())

  it('renders the trigger button collapsed by default', () => {
    renderCmp()
    expect(screen.getByRole('button', { name: /indispo/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens dialog with form fields when trigger clicked', async () => {
    const user = userEvent.setup()
    renderCmp()
    await user.click(screen.getByRole('button', { name: /indispo/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Ajouter une indisponibilité')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Rendez-vous médical/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ajouter$/ })).toBeInTheDocument()
  })

  it('submits title + times → createAvailability called with correct shape', async () => {
    const user = userEvent.setup()
    renderCmp()
    await user.click(screen.getByRole('button', { name: /indispo/i }))
    await screen.findByRole('dialog')

    const titleInput = screen.getByPlaceholderText(/Rendez-vous médical/i)
    await user.type(titleInput, 'Congés')

    await user.click(screen.getByRole('button', { name: /^Ajouter$/ }))

    expect(createAvailability).toHaveBeenCalledTimes(1)
    const arg = createAvailability.mock.calls[0][0]
    expect(arg).toMatchObject({
      title: 'Congés',
      type: 'unavailable',
    })
    expect(typeof arg.start_time).toBe('string')
    expect(typeof arg.end_time).toBe('string')
    expect(new Date(arg.end_time).getTime()).toBeGreaterThan(new Date(arg.start_time).getTime())
  })
})
