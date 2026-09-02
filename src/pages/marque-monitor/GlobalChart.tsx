import { TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MonitorPeriod } from '@/hooks/monitoring/useMonitorLogs'

interface ChartPoint {
  label: string
  date: string | number | Date
  frontend?: number
  ai?: number
  api?: number
  email?: number
  security?: number
  feedback?: number
}

interface GlobalChartProps {
  period: MonitorPeriod
  chartData: ChartPoint[]
}

export function GlobalChart({ period, chartData }: GlobalChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Évolution sur {period === '24h' ? '24 heures' : period === '7d' ? '7 jours' : '30 jours'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis allowDecimals={false} className="text-xs" />
              <RechartsTooltip
                labelFormatter={(_label, payload) => {
                  if (!payload?.[0]?.payload?.date) return _label
                  const d = new Date(payload[0].payload.date)
                  return period === '24h'
                    ? format(d, 'EEEE dd MMMM HH:mm', { locale: fr })
                    : format(d, 'EEEE dd MMMM', { locale: fr })
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="frontend" name="Frontend" stroke="hsl(263, 70%, 50%)" fill="hsl(263, 70%, 50%)" fillOpacity={0.1} />
              <Area type="monotone" dataKey="ai" name="IA" stroke="hsl(292, 84%, 61%)" fill="hsl(292, 84%, 61%)" fillOpacity={0.1} />
              <Area type="monotone" dataKey="api" name="API" stroke="hsl(152, 69%, 40%)" fill="hsl(152, 69%, 40%)" fillOpacity={0.1} />
              <Area type="monotone" dataKey="email" name="Email" stroke="hsl(199, 89%, 48%)" fill="hsl(199, 89%, 48%)" fillOpacity={0.1} />
              <Area type="monotone" dataKey="security" name="Sécurité" stroke="hsl(38, 92%, 50%)" fill="hsl(38, 92%, 50%)" fillOpacity={0.1} />
              <Area type="monotone" dataKey="feedback" name="Feedback" stroke="hsl(347, 77%, 50%)" fill="hsl(347, 77%, 50%)" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
