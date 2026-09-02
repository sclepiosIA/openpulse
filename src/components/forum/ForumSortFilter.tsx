import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";

export type SortOption = "recent" | "popular" | "mostCommented" | "unresolved";

interface ForumSortFilterProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function ForumSortFilter({ value, onChange }: ForumSortFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
      <SelectTrigger className="w-[200px] gap-2">
        <ArrowUpDown className="h-4 w-4" />
        <SelectValue placeholder="Trier par..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="recent">Plus récents</SelectItem>
        <SelectItem value="popular">Plus populaires</SelectItem>
        <SelectItem value="mostCommented">Plus commentés</SelectItem>
        <SelectItem value="unresolved">Non résolus</SelectItem>
      </SelectContent>
    </Select>
  );
}
