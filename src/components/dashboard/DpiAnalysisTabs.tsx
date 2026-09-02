import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface DpiData {
  count: number
  percentage: number
  totalPassages: number
  totalValue: number
}

interface DpiAnalysisTabsProps {
  byDPI: Record<string, DpiData>
  bySpecificDPI: Record<string, DpiData>
  onDpiTypeClick: (type: string) => void
  onSpecificDpiClick: (dpi: string) => void
  chartConfig: Record<string, { label: string; color: string }>
  getSpecificDpiColor: (dpi: string, index: number) => string
}

export function DpiAnalysisTabs({
  byDPI,
  bySpecificDPI,
  onDpiTypeClick,
  onSpecificDpiClick,
  chartConfig,
  getSpecificDpiColor
}: DpiAnalysisTabsProps) {
  const dpiChartData = Object.entries(byDPI).map(([type, data]) => ({
    type,
    value: data.count,
    fill: chartConfig[type as keyof typeof chartConfig]?.color || "hsl(var(--chart-4))"
  }))

  const specificDpiChartData = Object.entries(bySpecificDPI).map(([dpi, data], index) => ({
    dpi,
    value: data.count,
    fill: getSpecificDpiColor(dpi, index)
  }))

  return (
    <Tabs defaultValue="type" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="type">Par Type (Lourd/Web)</TabsTrigger>
        <TabsTrigger value="specific">Par DPI Spécifique</TabsTrigger>
      </TabsList>

      <TabsContent value="type" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique */}
          <div className="flex items-center justify-center">
            {dpiChartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dpiChartData}
                      dataKey="value"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {dpiChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.fill}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => onDpiTypeClick(entry.type)}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <Skeleton className="h-[250px] w-full" />
            )}
          </div>

          {/* Légende cliquable */}
          <div className="space-y-3">
            {Object.entries(byDPI).map(([type, data]) => (
              <div
                key={type}
                onClick={() => onDpiTypeClick(type)}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: chartConfig[type]?.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{type}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {data.totalPassages.toLocaleString('fr-FR')} passages
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{data.count}</Badge>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatNumber(data.totalValue)}€
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="specific" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique */}
          <div className="flex items-center justify-center">
            {specificDpiChartData.length > 0 ? (
              <ChartContainer config={{}} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={specificDpiChartData}
                      dataKey="value"
                      nameKey="dpi"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {specificDpiChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.fill}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => onSpecificDpiClick(entry.dpi)}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <Skeleton className="h-[250px] w-full" />
            )}
          </div>

          {/* Légende cliquable avec scroll */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {Object.entries(bySpecificDPI)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([dpi, data], index) => (
                <div
                  key={dpi}
                  onClick={() => onSpecificDpiClick(dpi)}
                  className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getSpecificDpiColor(dpi, index) }}
                    />
                    <div className="text-sm font-medium truncate">{dpi}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">{data.count}</Badge>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatNumber(data.totalValue)}€
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
