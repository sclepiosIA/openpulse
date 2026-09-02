import { Suspense, ComponentProps } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'

const ContractSectionEditorInner = lazy(() =>
  import('./ContractSectionEditor').then((m) => ({ default: m.ContractSectionEditor }))
)

type Props = ComponentProps<typeof ContractSectionEditorInner>

export function ContractSectionEditor(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[200px] flex items-center justify-center text-xs text-muted-foreground border rounded-md">
          Chargement de l'éditeur…
        </div>
      }
    >
      <ContractSectionEditorInner {...props} />
    </Suspense>
  )
}
