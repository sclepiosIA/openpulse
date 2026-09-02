import { Suspense, ComponentProps } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'

const ClauseRichEditorInner = lazy(() =>
  import('./ClauseRichEditor').then((m) => ({ default: m.ClauseRichEditor }))
)

type Props = ComponentProps<typeof ClauseRichEditorInner>

export function ClauseRichEditor(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[120px] flex items-center justify-center text-xs text-muted-foreground border rounded-md">
          Chargement de l'éditeur…
        </div>
      }
    >
      <ClauseRichEditorInner {...props} />
    </Suspense>
  )
}
