import { Button } from '@/components/ui/button';
import { Navigation, MapPin, Car } from 'lucide-react';

interface LocationNavButtonsProps {
  lat: number;
  lng: number;
  label?: string;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

export function LocationNavButtons({ lat, lng, label }: LocationNavButtonsProps) {
  const ios = isIOS();
  const encodedLabel = label ? encodeURIComponent(label) : '';

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${encodedLabel ? `&destination_place_id=${encodedLabel}` : ''}`;
  const applePlansUrl = `https://maps.apple.com/?daddr=${lat},${lng}${encodedLabel ? `&q=${encodedLabel}` : ''}`;
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div className="flex flex-wrap gap-2">
      {ios && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => open(applePlansUrl)}
        >
          <MapPin className="h-3.5 w-3.5" />
          Plans
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => open(googleMapsUrl)}
      >
        <Navigation className="h-3.5 w-3.5" />
        Google Maps
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => open(wazeUrl)}
      >
        <Car className="h-3.5 w-3.5" />
        Waze
      </Button>
    </div>
  );
}
