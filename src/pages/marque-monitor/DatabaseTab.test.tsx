import React from 'react'
import { render, screen, within } from '@testing-library/react'

const { MockAlertTriangle, MockDatabase, MockHardDrive } = vi.hoisted(() => ({
  MockAlertTriangle: (props: JSX.IntrinsicElements['svg']) => <svg data-icon="AlertTriangle" {...props} />,
  MockDatabase: (props: JSX.IntrinsicElements['svg']) => <svg data-icon="Database" {...props} />,
  MockHardDrive: (props: JSX.IntrinsicElements['svg']) => <svg data-icon="HardDrive" {...props} />,
}))

vi.mock('lucide-react', () => ({
  AlertTriangle: MockAlertTriangle,
  Database: MockDatabase,
  HardDrive: MockHardDrive,
}))

vi.mock('@/components/ui/card', () => {
  const Card = (props: JSX.IntrinsicElements['div']) => <div {...props} />
  const CardContent = (props: JSX.IntrinsicElements['div']) => <div {...props} />
  const CardDescription = (props: JSX.IntrinsicElements['p']) => <p {...props} />
  const CardHeader = (props: JSX.IntrinsicElements['div']) => <div {...props} />
  const CardTitle = (props: JSX.IntrinsicElements['h3']) => <h3 {...props} />
  return { Card, CardContent, CardDescription, CardHeader, CardTitle }
})

vi.mock('@/components/ui/table', () => {
  const Table = (props: JSX.IntrinsicElements['table']) => <table {...props} />
  const TableBody = (props: JSX.IntrinsicElements['tbody']) => <tbody {...props} />
  const TableCell = (props: JSX.IntrinsicElements['td']) => <td {...props} />
  const TableHead = (props: JSX.IntrinsicElements['th']) => <th {...props} />
  const TableHeader = (props: JSX.IntrinsicElements['thead']) => <thead {...props} />
  const TableRow = (props: JSX.IntrinsicElements['tr']) => <tr {...props} />
  return { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
})

vi.mock('@/components/ui/badge', () => {
  type SpanProps = JSX.IntrinsicElements['span'] & { variant?: string }
  const Badge = ({ children, ...rest }: SpanProps) => <span {...rest}>{children}</span>
  return { Badge }
})

vi.mock('@/lib/utils', () => {
  const cn = (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(' ')
  return { cn }
})

import { DatabaseTab } from './DatabaseTab'

describe('DatabaseTab', () => {
  it('affiche un spinner pendant le chargement', () => {
    const { container } = render(<DatabaseTab dbHealth={undefined} dbHealthLoading={true} />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it("affiche un message d'erreur si les stats DB ne sont pas disponibles", () => {
    render(<DatabaseTab dbHealth={undefined} dbHealthLoading={false} />)
    expect(
      screen.getByText('Impossible de charger les statistiques DB. Vérifiez les permissions admin.')
    ).toBeInTheDocument()
  })

  it('affiche les cartes de résumé, le tableau high seq scan et le top des tables avec les bonnes valeurs et classes', () => {
    const dbHealth = {
      total_db_size: '123 MB',
      table_count: 42,
      high_seq_scan_tables: [
        { table_name: 'events', seq_scan: 12, idx_scan: 3, rows: 45 },
      ],
      tables: [
        {
          table_name: 't1',
          total_size_pretty: '10 MB',
          data_size_pretty: '6 MB',
          index_size_pretty: '4 MB',
          n_live_tup: 123,
          idx_scan_pct: 85,
          dead_tup_pct: 5,
        },
        {
          table_name: 't2',
          total_size_pretty: '20 MB',
          data_size_pretty: '12 MB',
          index_size_pretty: '8 MB',
          idx_scan_pct: 60,
          dead_tup_pct: 20,
        },
      ],
    }
    render(<DatabaseTab dbHealth={dbHealth} dbHealthLoading={false} />)

    // Résumé
    expect(screen.getByText('Taille totale')).toBeInTheDocument()
    expect(screen.getByText('123 MB')).toBeInTheDocument()
    expect(screen.getByText('Tables')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Tables à fort seq_scan')).toBeInTheDocument()

    // Carte high seq scan
    expect(screen.getByText('Tables avec ratio seq_scan élevé')).toBeInTheDocument()
    expect(
      screen.getByText('Tables où les scans séquentiels dominent largement les scans par index')
    ).toBeInTheDocument()
    expect(screen.getByText('events')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()

    // Top 30 tables par taille
    expect(screen.getByText('Top 30 tables par taille')).toBeInTheDocument()
    const rowT1Cell = screen.getByText('t1')
    const rowT1 = rowT1Cell.closest('tr') as HTMLTableRowElement
    expect(rowT1).toBeTruthy()
    expect(within(rowT1).getByText('10 MB')).toBeInTheDocument()
    expect(within(rowT1).getByText('6 MB')).toBeInTheDocument()
    expect(within(rowT1).getByText('4 MB')).toBeInTheDocument()
    expect(within(rowT1).getByText('123')).toBeInTheDocument()
    const idx85 = within(rowT1).getByText('85%')
    expect(idx85.className).toContain('text-emerald-600')
    expect(idx85.className).toContain('border-emerald-200')
    const dead5 = within(rowT1).getByText('5%')
    expect(dead5.className).toContain('text-muted-foreground')

    const rowT2Cell = screen.getByText('t2')
    const rowT2 = rowT2Cell.closest('tr') as HTMLTableRowElement
    expect(rowT2).toBeTruthy()
    expect(within(rowT2).getByText('20 MB')).toBeInTheDocument()
    expect(within(rowT2).getByText('12 MB')).toBeInTheDocument()
    expect(within(rowT2).getByText('8 MB')).toBeInTheDocument()
    expect(within(rowT2).getByText('—')).toBeInTheDocument()
    const idx60 = within(rowT2).getByText('60%')
    expect(idx60.className).toContain('text-amber-600')
    expect(idx60.className).toContain('border-amber-200')
    const dead20 = within(rowT2).getByText('20%')
    expect(dead20.className).toContain('text-amber-600')
    expect(dead20.className).toContain('border-amber-200')
  })

  it("n'affiche pas la carte des tables high seq scan quand la liste est vide", () => {
    const dbHealth = {
      total_db_size: '1 MB',
      table_count: 0,
      high_seq_scan_tables: [] as Array<unknown>,
      tables: [] as Array<unknown>,
    }
    render(<DatabaseTab dbHealth={dbHealth} dbHealthLoading={false} />)
    expect(screen.getByText('Top 30 tables par taille')).toBeInTheDocument()
    expect(screen.queryByText('Tables avec ratio seq_scan élevé')).not.toBeInTheDocument()
  })
})