import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface TabConfig {
  value: string
  label: string
  badge?: number | string
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
}

interface ResponsiveTabsProps {
  tabs: TabConfig[]
  value: string
  onValueChange: (value: string) => void
  /** Sync with URL query param */
  urlParam?: string
  /** Additional className for the container */
  className?: string
  /** Breakpoint for switching to Select (default: sm) */
  breakpoint?: "sm" | "md" | "lg"
}

export function ResponsiveTabs({
  tabs,
  value,
  onValueChange,
  urlParam,
  className,
  breakpoint = "sm"
}: ResponsiveTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isMobile, setIsMobile] = useState(false)

  // Check screen size
  useEffect(() => {
    const checkMobile = () => {
      const breakpoints = { sm: 640, md: 768, lg: 1024 }
      setIsMobile(window.innerWidth < breakpoints[breakpoint])
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [breakpoint])

  // Sync with URL if urlParam is provided
  useEffect(() => {
    if (urlParam) {
      const urlValue = searchParams.get(urlParam)
      if (urlValue && urlValue !== value && tabs.some(t => t.value === urlValue)) {
        onValueChange(urlValue)
      }
    }
  }, [searchParams, urlParam, value, onValueChange, tabs])

  const handleChange = (newValue: string) => {
    onValueChange(newValue)
    
    // Update URL if urlParam is provided
    if (urlParam) {
      const newParams = new URLSearchParams(searchParams)
      if (newValue === tabs[0]?.value) {
        newParams.delete(urlParam) // Remove default value from URL
      } else {
        newParams.set(urlParam, newValue)
      }
      setSearchParams(newParams, { replace: true })
    }
  }

  const selectedTab = tabs.find(t => t.value === value)

  // Mobile: Select dropdown
  if (isMobile) {
    return (
      <div className={cn("w-full", className)}>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span>{selectedTab?.label}</span>
                {selectedTab?.badge !== undefined && (
                  <Badge variant={selectedTab.badgeVariant || "secondary"} className="h-4 px-1 text-[10px]">
                    {selectedTab.badge}
                  </Badge>
                )}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                <div className="flex items-center gap-2">
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <Badge variant={tab.badgeVariant || "secondary"} className="h-4 px-1 text-[10px]">
                      {tab.badge}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // Desktop: TabsList
  return (
    <Tabs value={value} onValueChange={handleChange} className={cn("w-auto", className)}>
      <TabsList className="h-7 p-0.5 bg-muted/50">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="h-6 px-2.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <Badge 
                variant={tab.badgeVariant || "secondary"} 
                className="ml-1.5 h-4 min-w-4 px-1 text-[10px] justify-center"
              >
                {tab.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
