import * as React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/shared/useMediaQuery"

interface TabItem {
  value: string
  label: string
  icon?: React.ReactNode
}

interface ResponsiveTabsProps {
  tabs: TabItem[]
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

/**
 * ResponsiveTabs - Affiche des tabs sur desktop et un select sur mobile
 */
export function ResponsiveTabs({ 
  tabs, 
  value, 
  onValueChange, 
  children,
  className 
}: ResponsiveTabsProps) {
  const isMobile = useMediaQuery("(max-width: 640px)")

  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {tabs.find(t => t.value === value)?.label || "Sélectionner"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                <span className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {children}
      </div>
    )
  }

  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            <span className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}

export { TabsContent }
