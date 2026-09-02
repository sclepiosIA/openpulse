import React from 'react'
import { render, screen } from '@testing-library/react'
import { LogTablePanel } from './LogTablePanel'

const { LOGS, EMPTY_LOGS, FIRST_LOG, mockOnLoadMore, mockOnSelect } = vi.hoisted(() => {
  const baseLogs = [
    { id: 'l1', createdAt: '2025-05-01T00:00:00Z', level: 'info', message: 'Hello' },
    { id: 'l2', createdAt: '2025-05-01T00:01:00Z', level: 'warn', message: 'World' },
  ]
  return {
    LOGS: baseLogs,
    EMPTY_LOGS: [] as unknown[],
    FIRST_LOG: baseLogs[0],
    mockOnLoadMore: vi.fn(),
    mockOnSelect: vi.fn(),
  }
})

type TestLogTableProps = {
  logs: Array<Record<string, unknown>>
  isLoading: boolean
  totalCount: number
  hasMore: boolean
  onLoadMore: () => void
  onSelect: (log: Record<string, unknown>) => void
  isMobile: boolean
}

function TestLogTable({
  logs,
  isLoading,
  totalCount,
  hasMore,
  onLoadMore,
  onSelect,
  isMobile,
}: TestLogTableProps) {
  return (
    <div
      data-testid="logtable"
      data-loading={isLoading ? 'true' : 'false'}
      data-totalcount={String(totalCount)}
      data-hasmore={hasMore ? 'true' : 'false'}
      data-ismobile={isMobile ? 'true' : 'false'}
    >
      <span data-testid="log-count">{logs.length}</span>
      <button onClick={onLoadMore}>load-more</button>
      {logs[0] ? <button onClick={() => onSelect(logs[0])}>select-first</button> : null}
    </div>
  )
}

describe('LogTablePanel', () => {
  beforeEach(() => {
    mockOnLoadMore.mockReset()
    mockOnSelect.mockReset()
  })

  it('rend le résumé et transmet les props en état de chargement', () => {
    render(
      <LogTablePanel
        summary={<div data-testid="summary">Résumé A</div>}
        logs={EMPTY_LOGS as unknown as Array<Record<string, unknown>>}
        isLoading={true}
        totalCount={0}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onSelect={mockOnSelect}
        isMobile={true}
        LogTable={TestLogTable}
      />
    )

    expect(screen.getByTestId('summary').textContent).toContain('Résumé A')
    const el = screen.getByTestId('logtable')
    expect(el.getAttribute('data-loading')).toBe('true')
    expect(el.getAttribute('data-totalcount')).toBe('0')
    expect(el.getAttribute('data-hasmore')).toBe('false')
    expect(el.getAttribute('data-ismobile')).toBe('true')
    expect(screen.getByTestId('log-count').textContent).toBe('0')
  })

  it('transmet les props succès et câble les callbacks', () => {
    render(
      <LogTablePanel
        summary={<div data-testid="summary">Résumé B</div>}
        logs={LOGS as unknown as Array<Record<string, unknown>>}
        isLoading={false}
        totalCount={5}
        hasMore={true}
        onLoadMore={mockOnLoadMore}
        onSelect={mockOnSelect}
        isMobile={false}
        LogTable={TestLogTable}
      />
    )

    const el = screen.getByTestId('logtable')
    expect(el.getAttribute('data-loading')).toBe('false')
    expect(el.getAttribute('data-totalcount')).toBe('5')
    expect(el.getAttribute('data-hasmore')).toBe('true')
    expect(el.getAttribute('data-ismobile')).toBe('false')
    expect(screen.getByTestId('log-count').textContent).toBe('2')

    screen.getByText('load-more').click()
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1)

    screen.getByText('select-first').click()
    expect(mockOnSelect).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).toHaveBeenCalledWith(FIRST_LOG)
  })

  it("rend un résumé d'erreur et reste stable", () => {
    render(
      <LogTablePanel
        summary={<div data-testid="summary">Erreur: Impossible de charger</div>}
        logs={EMPTY_LOGS as unknown as Array<Record<string, unknown>>}
        isLoading={false}
        totalCount={0}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onSelect={mockOnSelect}
        isMobile={false}
        LogTable={TestLogTable}
      />
    )

    expect(screen.getByTestId('summary').textContent).toContain('Erreur: Impossible de charger')
    const el = screen.getByTestId('logtable')
    expect(el.getAttribute('data-loading')).toBe('false')
    expect(screen.getByTestId('log-count').textContent).toBe('0')
  })
})