import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const React = require('react')
  const Icon = (props: any) => React.createElement('svg', { ...props })
  return {
    Search: Icon,
    User: Icon,
  }
})

vi.mock('@/components/ui/input', () => {
  const React = require('react')
  const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => React.createElement('input', { ...props, ref })
  )
  Input.displayName = 'Input'
  return { Input }
})

vi.mock('@/components/ui/card', () => {
  const React = require('react')
  const Card = ({ children, ...rest }: any) => React.createElement('div', { ...rest }, children)
  const CardContent = ({ children, ...rest }: any) =>
    React.createElement('div', { ...rest }, children)
  return { Card, CardContent }
})

vi.mock('@/lib/utils', () => {
  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')
  return { cn }
})

vi.mock('@/components/ui/select', () => {
  const React = require('react')
  const SelectContext = React.createContext<{ value: string; onValueChange?: (v: string) => void }>(
    { value: '', onValueChange: undefined }
  )

  function Select({
    value,
    onValueChange,
    children,
    ...rest
  }: {
    value: string
    onValueChange: (v: string) => void
    children: React.ReactNode
  }) {
    return React.createElement(
      'div',
      { 'data-ui': 'Select', ...rest },
      React.createElement(
        SelectContext.Provider,
        { value: { value, onValueChange } },
        children
      )
    )
  }

  function SelectTrigger({ children, ...rest }: any) {
    return React.createElement('button', { type: 'button', ...rest }, children)
  }

  function SelectContent({ children, ...rest }: any) {
    return React.createElement('div', { role: 'listbox', ...rest }, children)
  }

  function SelectItem({ value, children, ...rest }: any) {
    const ctx = React.useContext(SelectContext)
    return React.createElement(
      'div',
      {
        role: 'option',
        'data-value': value,
        onClick: () => ctx?.onValueChange?.(value),
        ...rest,
      },
      children
    )
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    const ctx = React.useContext(SelectContext)
    return React.createElement('span', null, ctx?.value || placeholder || '')
  }

  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
})

const { UNIQUE_USERS, TRUNCATED_LABEL } = vi.hoisted(() => {
  const longLabel = 'Utilisateur De Test Avec Un Nom Vraiment Très Très Long'
  const truncated = longLabel.slice(0, 22) + '...'
  return {
    UNIQUE_USERS: [
      { id: 'u1', label: 'Alice Dupont' },
      { id: 'u2', label: longLabel },
    ],
    TRUNCATED_LABEL: truncated,
  }
})

import { MonitorFilters } from './MonitorFilters'

describe('MonitorFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input and triggers onSearchChange', () => {
    const onSearchChange = vi.fn()
    const onPeriodChange = vi.fn()
    const onSeverityChange = vi.fn()
    const onUserFilterChange = vi.fn()
    const onSourceFilterChange = vi.fn()

    render(
      <MonitorFilters
        searchTerm=""
        onSearchChange={onSearchChange}
        period="24h"
        onPeriodChange={onPeriodChange}
        severityFilter="all"
        onSeverityChange={onSeverityChange}
        userFilter="all"
        onUserFilterChange={onUserFilterChange}
        sourceFilter="all"
        onSourceFilterChange={onSourceFilterChange}
        activeTab="global"
        uniqueUsers={UNIQUE_USERS}
        isMobile={false}
      />
    )

    const input = screen.getByPlaceholderText('Rechercher message, type, email...') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.value).toBe('')

    fireEvent.change(input, { target: { value: 'erreur 500' } })
    expect(onSearchChange).toHaveBeenCalledWith('erreur 500')
  })

  it('calls onValueChange handlers for period, severity, user and source selects', () => {
    const onSearchChange = vi.fn()
    const onPeriodChange = vi.fn()
    const onSeverityChange = vi.fn()
    const onUserFilterChange = vi.fn()
    const onSourceFilterChange = vi.fn()

    render(
      <MonitorFilters
        searchTerm="init"
        onSearchChange={onSearchChange}
        period="24h"
        onPeriodChange={onPeriodChange}
        severityFilter="all"
        onSeverityChange={onSeverityChange}
        userFilter="all"
        onUserFilterChange={onUserFilterChange}
        sourceFilter="all"
        onSourceFilterChange={onSourceFilterChange}
        activeTab="global"
        uniqueUsers={UNIQUE_USERS}
        isMobile={false}
      />
    )

    // Period: select "7 jours" => value "7d"
    const periodOption = screen.getByRole('option', { name: '7 jours' })
    fireEvent.click(periodOption)
    expect(onPeriodChange).toHaveBeenCalledWith('7d')

    // Severity: select "Erreur" => value "error"
    const severityOption = screen.getByRole('option', { name: 'Erreur' })
    fireEvent.click(severityOption)
    expect(onSeverityChange).toHaveBeenCalledWith('error')

    // User: verify truncated label is rendered and can be selected
    expect(screen.getByText(TRUNCATED_LABEL)).toBeInTheDocument()

    const userOption1 = screen.getByRole('option', { name: 'Alice Dupont' })
    fireEvent.click(userOption1)
    expect(onUserFilterChange).toHaveBeenCalledWith('u1')

    const userOption2 = screen.getByText(TRUNCATED_LABEL)
    fireEvent.click(userOption2)
    expect(onUserFilterChange).toHaveBeenCalledWith('u2')

    // Source filter visible on 'global' tab: select "API" => value "api"
    expect(screen.getByRole('option', { name: 'Toutes sources' })).toBeInTheDocument()
    const sourceApi = screen.getByRole('option', { name: 'API' })
    fireEvent.click(sourceApi)
    expect(onSourceFilterChange).toHaveBeenCalledWith('api')
  })

  it('hides source filter when activeTab is not "global"', () => {
    const onSearchChange = vi.fn()
    const onPeriodChange = vi.fn()
    const onSeverityChange = vi.fn()
    const onUserFilterChange = vi.fn()
    const onSourceFilterChange = vi.fn()

    render(
      <MonitorFilters
        searchTerm=""
        onSearchChange={onSearchChange}
        period="24h"
        onPeriodChange={onPeriodChange}
        severityFilter="all"
        onSeverityChange={onSeverityChange}
        userFilter="all"
        onUserFilterChange={onUserFilterChange}
        sourceFilter="all"
        onSourceFilterChange={onSourceFilterChange}
        activeTab="user"
        uniqueUsers={UNIQUE_USERS}
        isMobile={true}
      />
    )

    expect(screen.queryByRole('option', { name: 'Toutes sources' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'API' })).toBeNull()
  })
})