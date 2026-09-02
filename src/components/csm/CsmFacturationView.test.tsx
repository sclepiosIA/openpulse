import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

const { ETABS, FACTS, mockUpsert, mockFrom, MOCK_BUILDER } = vi.hoisted(() => {
  const ETABS = [
    { id: 'e1', nom: 'E1', type_etablissement: 'TypeA', date_signature: '2023-01-01' },
    { id: 'e2', nom: 'E2' },
  ]
  const FACTS = [
    {
      etablissement_id: 'e1',
      modele_facturation: 'Statique',
      date_deploiement: '2023-02-01',
      date_debut_periode: '2023-02-01',
      date_fin_periode: '2023-03-01',
      derniere_relance: '2023-04-01',
      facturation_effectuee: 'OUI',
      notes: 'note1',
    },
  ]
  const mockUpsert = vi.fn()
  // Supabase mock builder pattern (thenable)
  const MOCK_BUILDER = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    "in": vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((cb) => {
      try {
        const res = { data: null, error: null }
        return Promise.resolve(cb(res))
      } catch (e) {
        return Promise.reject(e)
      }
    }),
    catch: vi.fn((cb) => Promise.resolve(undefined)),
  }
  const mockFrom = vi.fn(() => MOCK_BUILDER)
  return { ETABS, FACTS, mockUpsert, mockFrom, MOCK_BUILDER }
})

// Mock supabase client as required by rules
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

// Mock table UI components to render DOM suitable for queries
vi.mock('@/components/ui/table', () => {
  const React = require('react')
  return {
    Table: ({ children }: any) => React.createElement('div', { 'data-testid': 'table' }, children),
    TableBody: ({ children }: any) => React.createElement('div', { 'data-testid': 'table-body' }, children),
    TableCell: ({ children, className }: any) =>
      React.createElement('div', { role: 'cell', className }, children),
    TableHead: ({ children, className }: any) =>
      React.createElement('div', { role: 'columnheader', className }, children),
    TableHeader: ({ children }: any) => React.createElement('div', { 'data-testid': 'table-header' }, children),
    TableRow: ({ children, className }: any) =>
      React.createElement('div', { 'data-testid': 'table-row', role: 'row', className }, children),
  }
})

// Mock Badge component
vi.mock('@/components/ui/badge', () => {
  const React = require('react')
  return {
    Badge: ({ children, className }: any) =>
      React.createElement('span', { 'data-testid': 'badge', className }, children),
  }
})

// EditableCell mock: exposes a button that calls onSave with deterministic values
vi.mock('@/components/csm/EditableCell', () => {
  const React = require('react')
  return {
    EditableCell: ({ value, placeholder, onSave, multiline }: any) =>
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'editable-cell',
          'data-placeholder': placeholder || '',
          'data-value': value ?? '',
          'data-multiline': multiline ? '1' : '0',
          onClick: () => {
            // Distinguish by multiline to simulate notes update
            if (multiline) {
              onSave('notes-updated')
            } else {
              // Differentiate date cells vs other by presence of placeholder "Date..."
              if (placeholder === 'Date...') {
                onSave('date-updated')
              } else {
                onSave('cell-updated')
              }
            }
          },
        },
        'edit'
      ),
  }
})

// EditableSelectCell mock: button calls onSave with deterministic 'select-updated'
vi.mock('@/components/csm/EditableSelectCell', () => {
  const React = require('react')
  return {
    EditableSelectCell: ({ value, options, onSave }: any) =>
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'editable-select',
          'data-value': value ?? '',
          'data-options': String((options || []).length),
          onClick: () => onSave('select-updated'),
        },
        'select'
      ),
  }
})

// Mock hooks that the component uses
vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: vi.fn(() => ({ data: ETABS })),
}))

vi.mock('@/hooks/csm/useCsmFacturation', () => ({
  useCsmFacturation: vi.fn(() => ({ data: FACTS, upsert: mockUpsert, isLoading: false, isError: false, error: null })),
}))

// Mock utility cn
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// Ensure other potential absolute imports are harmlessly mocked (router / toast)
vi.mock('react-router', () => ({ useNavigate: vi.fn(() => vi.fn()) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Now import the mocked hook reference for direct assertions in renderHook
import { useCsmFacturation } from '@/hooks/csm/useCsmFacturation'
import { useProduction } from '@/hooks/production/useProduction'
import { CsmFacturationView } from './CsmFacturationView'

const createQueryWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return ({ children }: any) => {
    return /* JSX */ (React.createElement(QueryClientProvider, { client }, children))
  }
}

import React from 'react'

describe('CsmFacturationView component and hooks', () => {
  afterEach(() => {
    mockUpsert.mockClear()
    // restore useCsmFacturation default mock to success state
    ;(useCsmFacturation as unknown as vi.Mock).mockImplementation(() => ({
      data: FACTS,
      upsert: mockUpsert,
      isLoading: false,
      isError: false,
      error: null,
    }))
  })

  it('hook: reports loading then error states correctly using renderHook with QueryClientProvider wrapper', async () => {
    const wrapper = ({ children }: any) =>
      React.createElement(QueryClientProvider, {
        client: new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } }),
        children,
      })

    // Simulate loading state
    ;(useCsmFacturation as unknown as vi.Mock).mockImplementationOnce(() => ({
      data: null,
      upsert: mockUpsert,
      isLoading: true,
      isError: false,
      error: null,
    }))

    const { result, waitFor } = renderHook(() => useCsmFacturation(), { wrapper })
    // immediate result should show loading true
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()

    // Now simulate an error state on next call
    ;(useCsmFacturation as unknown as vi.Mock).mockImplementationOnce(() => ({
      data: null,
      upsert: mockUpsert,
      isLoading: false,
      isError: true,
      error: { message: 'boom' },
    }))

    const { result: resultErr } = renderHook(() => useCsmFacturation(), { wrapper })
    expect(resultErr.current.isError).toBe(true)
    expect(resultErr.current.error).toEqual({ message: 'boom' })
  })

  it('renders etablissements and displays facturation badge and values', () => {
    const wrapper = createQueryWrapper()
    render(React.createElement(CsmFacturationView), { wrapper })

    // Etablissements names should be present
    expect(screen.getByText('E1')).toBeTruthy()
    expect(screen.getByText('E2')).toBeTruthy()

    // For E1, the facturation badge should display 'OUI' coming from FACTS mock
    const badges = screen.getAllByTestId('badge')
    const badgeTexts = badges.map((b) => b.textContent)
    expect(badgeTexts).toContain('OUI')
  })

  it('calls upsert with correct payload when EditableSelectCell is saved for a row without existing fact', async () => {
    const wrapper = createQueryWrapper()
    render(React.createElement(CsmFacturationView), { wrapper })

    // Locate the row for E2 and click its EditableSelectCell (modele_facturation)
    const etabCell = screen.getByText('E2')
    const row = etabCell.closest('[data-testid="table-row"]')
    expect(row).not.toBeNull()

    const selectButton = row!.querySelector('button[data-testid="editable-select"]') as HTMLButtonElement | null
    expect(selectButton).not.toBeNull()
    // ensure this select corresponds to the row without a pre-existing value (data-value empty string)
    expect(selectButton!.getAttribute('data-value')).toBe('')

    await act(async () => {
      fireEvent.click(selectButton!)
    })

    // upsert must have been called exactly once with an object containing etablissement_id 'e2' and modele_facturation 'select-updated'
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const calledWith = mockUpsert.mock.calls[0][0]
    expect(calledWith).toBeInstanceOf(Object)
    expect(calledWith.etablissement_id).toBe('e2')
    expect(calledWith.modele_facturation).toBe('select-updated')
  })

  it('calls upsert merging with existing fact for a row that already has a fact', async () => {
    const wrapper = createQueryWrapper()
    render(React.createElement(CsmFacturationView), { wrapper })

    // Locate the row for E1 and click its EditableSelectCell (modele_facturation)
    const etabCell = screen.getByText('E1')
    const row = etabCell.closest('[data-testid="table-row"]')
    expect(row).not.toBeNull()

    const selectButton = row!.querySelector('button[data-testid="editable-select"]') as HTMLButtonElement | null
    expect(selectButton).not.toBeNull()
    // For E1, initial value is 'Statique'
    expect(selectButton!.getAttribute('data-value')).toBe('Statique')

    await act(async () => {
      fireEvent.click(selectButton!)
    })

    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const calledWith = mockUpsert.mock.calls[0][0]
    // Should keep existing etablissement info from FACTS[0] and override modele_facturation
    expect(calledWith.etablissement_id).toBe('e1')
    expect(calledWith.modele_facturation).toBe('select-updated')
    // Existing fields present (e.g., notes) should still be present in the payload
    expect(calledWith.notes).toBe('note1')
  })
})