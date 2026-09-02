import { Suspense, ComponentProps } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'

const RichTextEditorInner = lazy(() =>
  import('./RichTextEditor').then((m) => ({ default: m.RichTextEditor }))
)

type Props = ComponentProps<typeof RichTextEditorInner>

export function RichTextEditor(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[120px] flex items-center justify-center text-xs text-muted-foreground border rounded-md">
          Chargement de l'éditeur…
        </div>
      }
    >
      <RichTextEditorInner {...props} />
    </Suspense>
  )
}
