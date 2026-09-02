/**
 * Encode/decode location string with optional coordinates.
 * Format: "Adresse formatée [lat,lng]"
 */

export interface ParsedLocation {
  address: string;
  coords: { lat: number; lng: number } | null;
  raw: string;
}

const COORDS_REGEX = /\s*\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]\s*$/;

export function parseLocation(value: string | null | undefined): ParsedLocation {
  const raw = value ?? '';
  if (!raw) return { address: '', coords: null, raw: '' };

  const match = raw.match(COORDS_REGEX);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        address: raw.replace(COORDS_REGEX, '').trim(),
        coords: { lat, lng },
        raw,
      };
    }
  }
  return { address: raw, coords: null, raw };
}

export function encodeLocation(address: string, coords: { lat: number; lng: number } | null): string {
  const trimmed = address.trim();
  if (!trimmed) return '';
  if (!coords) return trimmed;
  return `${trimmed} [${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}]`;
}

/**
 * Display version (without coords suffix), useful for read-only views.
 */
export function getDisplayAddress(value: string | null | undefined): string {
  return parseLocation(value).address;
}
