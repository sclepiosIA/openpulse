export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getWorkloadColor(count: number): string {
  if (count <= 5) return 'hsl(var(--success))';
  if (count <= 15) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

export function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'Prospects':
      return 'hsl(var(--chart-1))';
    case 'Déploiement':
      return 'hsl(var(--chart-3))';
    case 'Production':
      return 'hsl(var(--chart-2))';
    default:
      return 'hsl(var(--muted))';
  }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

export function formatPercent(num: number): string {
  return `${Math.round(num)}%`;
}
