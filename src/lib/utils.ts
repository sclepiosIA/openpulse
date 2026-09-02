import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number): string {
  if (value >= 1000000) {
    const millions = value / 1000000
    // Afficher 1 décimale si ce n'est pas un nombre entier
    return millions % 1 === 0 
      ? `${Math.round(millions)}M`
      : `${millions.toFixed(1)}M`
  } else if (value >= 1000) {
    return `${Math.round(value / 1000)}K`
  }
  return value.toString()
}
