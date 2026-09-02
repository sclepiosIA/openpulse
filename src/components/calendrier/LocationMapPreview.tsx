import { Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { Skeleton } from '@/components/ui/skeleton'

const MapInner = lazy(() => import('./LocationMapInner'))

interface LocationMapPreviewProps {
  lat: number
  lng: number
  label?: string
}

export function LocationMapPreview({ lat, lng, label }: LocationMapPreviewProps) {
  return (
    <div className="relative w-full h-[200px] rounded-md overflow-hidden border border-border">
      <Suspense fallback={<Skeleton className="w-full h-full" />}>
        <MapInner lat={lat} lng={lng} label={label} />
      </Suspense>
    </div>
  )
}
