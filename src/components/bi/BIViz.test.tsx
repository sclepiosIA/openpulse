import { cleanup, render, screen, within } from '@testing-library/react'
import { BIViz } from './BIViz'

vi.mock('@/hooks/bi/useBIStudio', () => ({}))

vi.mock('@/components/ui/table', async () => {
  const React = await import('react')
  type Node = import('react').ReactNode
  type Style = import('react').CSSProperties
  type Props = { children?: Node; className?: string; style?: Style }

  const make =
    (tag: string) =>
    ({ children, className, style }: Props) =>
      React.createElement(tag, { className, style }, children)

  return {
    Table: make('table'),
    TableHeader: make('thead'),
    TableBody: make('tbody'),
    TableFooter: make('tfoot'),
    TableRow: make('tr'),
    TableHead: make('th'),
    TableCell: make('td'),
    TableCaption: make('caption'),
  }
})

vi.mock('@/components/ui/scroll-area', async () => {
  const React = await import('react')
  type Node = import('react').ReactNode
  type Style = import('react').CSSProperties

  return {
    ScrollArea: ({
      children,
      className,
      style,
    }: {
      children?: Node
      className?: string
      style?: Style
    }) => React.createElement('div', { 'data-testid': 'scroll-area', className, style }, children),
    ScrollBar: () => React.createElement('div', { 'data-testid': 'scroll-bar' }),
  }
})

vi.mock('recharts', async () => {
  const React = await import('react')
  type Node = import('react').ReactNode
  type ChartMargin = { top?: number; right?: number; left?: number; bottom?: number }
  type ChartProps = { children?: Node; data?: unknown[]; margin?: ChartMargin }

  const chart =
    (testId: string) =>
    ({ children, data, margin }: ChartProps) =>
      React.createElement(
        'div',
        {
          'data-testid': testId,
          'data-count': Array.isArray(data) ? String(data.length) : '0',
          'data-margin-top': margin?.top === undefined ? '' : String(margin.top),
        },
        children
      )

  return {
    ResponsiveContainer: ({
      children,
      width,
      height,
    }: {
      children?: Node
      width?: string | number
      height?: number
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'responsive-container',
          'data-width': width === undefined ? '' : String(width),
          'data-height': height === undefined ? '' : String(height),
        },
        children
      ),
    LineChart: chart('line-chart'),
    BarChart: chart('bar-chart'),
    PieChart: ({ children }: { children?: Node }) =>
      React.createElement('div', { 'data-testid': 'pie-chart' }, children),
    Line: ({
      dataKey,
      stroke,
      strokeWidth,
      dot,
      type,
    }: {
      dataKey?: string
      stroke?: string
      strokeWidth?: number
      dot?: boolean
      type?: string
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'line-series',
          'data-key': dataKey,
          'data-stroke': stroke,
          'data-stroke-width': strokeWidth === undefined ? '' : String(strokeWidth),
          'data-dot': dot === undefined ? '' : String(dot),
          'data-type': type,
        },
        dataKey
      ),
    Bar: ({ dataKey, fill, stackId }: { dataKey?: string; fill?: string; stackId?: string }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'bar-series',
          'data-key': dataKey,
          'data-fill': fill,
          'data-stack-id': stackId ?? '',
        },
        dataKey
      ),
    Pie: ({
      children,
      data,
      dataKey,
      nameKey,
      outerRadius,
      label,
    }: {
      children?: Node
      data?: unknown[]
      dataKey?: string
      nameKey?: string
      outerRadius?: number
      label?: boolean
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'pie',
          'data-count': Array.isArray(data) ? String(data.length) : '0',
          'data-key': dataKey,
          'data-name-key': nameKey,
          'data-radius': outerRadius === undefined ? '' : String(outerRadius),
          'data-label': label === undefined ? '' : String(label),
        },
        children
      ),
    Cell: ({ fill }: { fill?: string }) =>
      React.createElement('div', { 'data-testid': 'pie-cell', 'data-fill': fill }),
    XAxis: ({ dataKey }: { dataKey?: string }) =>
      React.createElement('div', { 'data-testid': 'x-axis', 'data-key': dataKey }),
    YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
    CartesianGrid: ({ strokeDasharray }: { strokeDasharray?: string }) =>
      React.createElement('div', { 'data-testid': 'cartesian-grid', 'data-dash': strokeDasharray }),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const normalizeFrenchNumber = (value: string) => value.replace(/[\s\u00a0\u202f]/g, '')

describe('BIViz', () => {
  it('affiche un état vide explicite quand aucune ligne n’est fournie', () => {
    render(<BIViz rows={[]} viz_type="table" />)

    expect(screen.getByText('Aucune donnée pour cette question.').textContent).toBe(
      'Aucune donnée pour cette question.'
    )
  })

  it('affiche une KPI avec la première colonne numérique, son libellé et le nombre de lignes', () => {
    render(
      <BIViz
        rows={[
          { label: 'CA', revenue: 12345 },
          { label: 'Marge', revenue: 678 },
        ]}
        viz_type="kpi"
        columns={['label', 'revenue']}
      />
    )

    expect(
      screen.getByText((content) => normalizeFrenchNumber(content) === '12345').textContent
    ).toBeTruthy()
    expect(screen.getByText('revenue').textContent).toBe('revenue')
    expect(screen.getByText('2 lignes').textContent).toBe('2 lignes')
  })

  it('rend le tableau par défaut avec ordre des colonnes et formatage français des cellules', () => {
    render(
      <BIViz
        rows={[
          { name: 'Alpha', active: true, score: 1234, ratio: 12.345, missing: null },
          { name: 'Beta', active: false, score: 8, ratio: 1, missing: undefined },
        ]}
        viz_type="table"
        columns={['name', 'active', 'score', 'ratio', 'missing']}
        height={180}
      />
    )

    const scrollArea = screen.getByTestId('scroll-area')
    expect(scrollArea.style.maxHeight).toBe('180px')

    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
    ).toEqual(['name', 'active', 'score', 'ratio', 'missing'])

    expect(within(table).getByText('Alpha').textContent).toBe('Alpha')
    expect(within(table).getByText('Beta').textContent).toBe('Beta')
    expect(within(table).getByText('Oui').textContent).toBe('Oui')
    expect(within(table).getByText('Non').textContent).toBe('Non')
    expect(
      within(table).getByText((content) => normalizeFrenchNumber(content) === '1234').textContent
    ).toBeTruthy()
    expect(within(table).getByText('12,35').textContent).toBe('12,35')
    expect(within(table).getAllByText('—')).toHaveLength(2)
  })

  it('limite le tableau à 500 lignes et annonce le total réel', () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({ id: index + 1 }))

    render(<BIViz rows={rows} viz_type="table" columns={['id']} />)

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(501)
    expect(screen.getByText('Affichage limité à 500 lignes (501 au total).').textContent).toBe(
      'Affichage limité à 500 lignes (501 au total).'
    )
    expect(screen.queryByText('501')).toBeNull()
  })

  it('configure un graphique ligne avec la clé X et uniquement les séries Y numériques', () => {
    render(
      <BIViz
        rows={[
          { month: 'Jan', sales: 10, note: 'ouverture', profit: 2.5 },
          { month: 'Fév', sales: 15, note: 'croissance', profit: 4 },
        ]}
        viz_type="line"
        columns={['month', 'sales', 'note', 'profit']}
        height={240}
      />
    )

    expect(screen.getByTestId('responsive-container').getAttribute('data-width')).toBe('100%')
    expect(screen.getByTestId('responsive-container').getAttribute('data-height')).toBe('240')
    expect(screen.getByTestId('line-chart').getAttribute('data-count')).toBe('2')
    expect(screen.getByTestId('line-chart').getAttribute('data-margin-top')).toBe('10')
    expect(screen.getByTestId('x-axis').getAttribute('data-key')).toBe('month')

    const series = screen.getAllByTestId('line-series')
    expect(series.map((element) => element.getAttribute('data-key'))).toEqual(['sales', 'profit'])
    expect(series.map((element) => element.getAttribute('data-type'))).toEqual([
      'monotone',
      'monotone',
    ])
    expect(series.map((element) => element.getAttribute('data-dot'))).toEqual(['false', 'false'])
  })

  it('configure un graphique barres empilées avec stackId pour chaque série', () => {
    render(
      <BIViz
        rows={[
          { segment: 'PME', new_customers: 12, returning_customers: 30 },
          { segment: 'ETI', new_customers: 7, returning_customers: 18 },
        ]}
        viz_type="stacked_bar"
        columns={['segment', 'new_customers', 'returning_customers']}
        height={260}
      />
    )

    expect(screen.getByTestId('bar-chart').getAttribute('data-count')).toBe('2')
    expect(screen.getByTestId('x-axis').getAttribute('data-key')).toBe('segment')

    const bars = screen.getAllByTestId('bar-series')
    expect(bars.map((element) => element.getAttribute('data-key'))).toEqual([
      'new_customers',
      'returning_customers',
    ])
    expect(bars.map((element) => element.getAttribute('data-stack-id'))).toEqual(['a', 'a'])
  })

  it('configure un graphique camembert avec clés label/valeur, rayon calculé et une cellule par ligne', () => {
    render(
      <BIViz
        rows={[
          { category: 'Produit A', value: 30 },
          { category: 'Produit B', value: 20 },
          { category: 'Produit C', value: 10 },
        ]}
        viz_type="pie"
        columns={['category', 'value']}
        height={300}
      />
    )

    const pie = screen.getByTestId('pie')
    expect(screen.getByTestId('responsive-container').getAttribute('data-height')).toBe('300')
    expect(pie.getAttribute('data-count')).toBe('3')
    expect(pie.getAttribute('data-key')).toBe('value')
    expect(pie.getAttribute('data-name-key')).toBe('category')
    expect(pie.getAttribute('data-radius')).toBe('100')
    expect(pie.getAttribute('data-label')).toBe('true')
    expect(screen.getAllByTestId('pie-cell')).toHaveLength(3)
    expect(screen.getAllByTestId('pie-cell')[0]?.getAttribute('data-fill')).toBe(
      'hsl(var(--primary))'
    )
  })

  it('rend un funnel avec libellés, valeurs formatées et largeurs proportionnelles au maximum', () => {
    const { container } = render(
      <BIViz
        rows={[
          { step: 'Prospects', count: 100 },
          { step: 'Clients', count: 50 },
          { step: 'Perdus', count: 0 },
        ]}
        viz_type="funnel"
        columns={['step', 'count']}
      />
    )

    expect(screen.getByText('Prospects').textContent).toBe('Prospects')
    expect(screen.getByText('Clients').textContent).toBe('Clients')
    expect(screen.getByText('Perdus').textContent).toBe('Perdus')
    expect(screen.getByText('100').textContent).toBe('100')
    expect(screen.getByText('50').textContent).toBe('50')
    expect(screen.getByText('0').textContent).toBe('0')

    const widths = Array.from(container.querySelectorAll('.bg-primary')).map((element) =>
      element instanceof HTMLElement ? element.style.width : ''
    )
    expect(widths).toEqual(['100%', '50%', '0%'])
  })
})
