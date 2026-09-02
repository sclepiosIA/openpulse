import { useEffect, useState, useRef } from 'react';
import { useDebounce } from '@/hooks/shared/useDebounce';

export interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  address?: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
  };
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
let lastRequestAt = 0;

export function useAddressSearch(query: string, enabled: boolean = true) {
  const debounced = useDebounce(query, 400);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !debounced || debounced.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // Respect Nominatim 1 req/s policy
    const now = Date.now();
    const wait = Math.max(0, 1000 - (now - lastRequestAt));

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const timer = setTimeout(async () => {
      lastRequestAt = Date.now();
      try {
        const url = new URL(NOMINATIM_URL);
        url.searchParams.set('format', 'json');
        url.searchParams.set('q', debounced);
        url.searchParams.set('limit', '5');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('accept-language', 'fr');

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data: AddressSuggestion[] = await res.json();
        setSuggestions(data);
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e.name !== 'AbortError') {
          console.warn('[useAddressSearch] error:', e.message);
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, wait);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [debounced, enabled]);

  return { suggestions, loading };
}
