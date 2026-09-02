import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { BIVizType } from '@/hooks/bi/useBIStudio'

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 173 58% 39%))',
  'hsl(var(--chart-3, 197 37% 44%))',
  'hsl(var(--chart-4, 43 74% 66%))',
  'hsl(var(--chart-5, 27 87% 67%))',
  'hsl(var(--chart-6, 340 65% 55%))',
]

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number')
    return Number.isInteger(v)
      ? v.toLocaleString('fr-FR')
      : v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  return String(v)
}

export interface BIVizProps {
  rows: Record<string, unknown>[]
  viz_type: BIVizType
  columns?: string[]
  height?: number
}

export function BIViz({ rows, viz_type, columns, height = 320 }: BIVizProps) {
  const cols = useMemo(() => {
    if (columns?.length) return columns
    return rows[0] ? Object.keys(rows[0]) : []
  }, [rows, columns])

  if (!rows.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Aucune donnée pour cette question.
      </div>
    )
  }

  if (viz_type === 'kpi') {
    const first = rows[0]
    const numericKey = cols.find((c) => typeof first[c] === 'number') ?? cols[0]
    const value = first[numericKey]
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-6">
        <div className="text-4xl font-bold tabular-nums">{formatCell(value)}</div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{numericKey}</div>
        {rows.length > 1 && (
          <div className="text-xs text-muted-foreground">{rows.length} lignes</div>
        )}
      </div>
    )
  }

  if (viz_type === 'line' || viz_type === 'bar' || viz_type === 'stacked_bar') {
    const [xKey, ...yKeys] = cols
    const numericYKeys = yKeys.filter((k) => rows.some((r) => typeof r[k] === 'number'))
    const yKeysToPlot = numericYKeys.length ? numericYKeys : yKeys.slice(0, 3)
    const ChartCmp = viz_type === 'line' ? LineChart : BarChart
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ChartCmp data={rows as never[]} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {yKeysToPlot.map((k, i) =>
            viz_type === 'line' ? (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ) : (
              <Bar
                key={k}
                dataKey={k}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                stackId={viz_type === 'stacked_bar' ? 'a' : undefined}
              />
            )
          )}
        </ChartCmp>
      </ResponsiveContainer>
    )
  }

  if (viz_type === 'pie') {
    const [labelKey, valueKey] = cols
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={rows as never[]}
            dataKey={valueKey}
            nameKey={labelKey}
            outerRadius={height / 3}
            label
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (viz_type === 'funnel') {
    const [labelKey, valueKey] = cols
    const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0))
    return (
      <div className="space-y-1.5 py-2">
        {rows.map((r, i) => {
          const v = Number(r[valueKey]) || 0
          const pct = max > 0 ? (v / max) * 100 : 0
          return (
            <div key={i} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span>{formatCell(r[labelKey])}</span>
                <span className="font-medium tabular-nums">{formatCell(v)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // default: table
  return (
    <ScrollArea className="w-full" style={{ maxHeight: height }}>
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 500).map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell key={c} className="tabular-nums">
                  {formatCell(r[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 500 && (
        <div className="p-2 text-center text-xs text-muted-foreground">
          Affichage limité à 500 lignes ({rows.length} au total).
        </div>
      )}
    </ScrollArea>
  )
}
