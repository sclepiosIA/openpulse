import { TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

interface SortableTableHeadProps {
  children: React.ReactNode;
  field: string;
  sortConfig: SortConfig;
  onSort: (field: string) => void;
  className?: string;
  align?: "left" | "center" | "right";
}

export function SortableTableHead({
  children,
  field,
  sortConfig,
  onSort,
  className,
  align = "left"
}: SortableTableHeadProps) {
  const isActive = sortConfig.field === field;
  const isAsc = isActive && sortConfig.direction === "asc";
  const isDesc = isActive && sortConfig.direction === "desc";

  const handleClick = () => {
    onSort(field);
  };

  const SortIcon = isAsc ? ArrowUp : isDesc ? ArrowDown : ArrowUpDown;

  return (
    <TableHead
      className={cn(
        "whitespace-nowrap",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={cn(
          "h-8 px-2 -ml-2 font-medium",
          "hover:bg-muted/50",
          isActive && "text-foreground",
          align === "right" && "ml-auto -mr-2"
        )}
      >
        {children}
        <SortIcon
          className={cn(
            "ml-2 h-3.5 w-3.5 transition-colors",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        />
      </Button>
    </TableHead>
  );
}

import { useState } from "react";

export function useSortConfig(defaultField: string = "", defaultDirection: SortDirection = null) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: defaultField,
    direction: defaultDirection
  });

  const handleSort = (field: string) => {
    setSortConfig((prev) => {
      if (prev.field !== field) {
        return { field, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { field, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { field: "", direction: null };
      }
      return { field, direction: "asc" };
    });
  };

  return { sortConfig, handleSort };
}
