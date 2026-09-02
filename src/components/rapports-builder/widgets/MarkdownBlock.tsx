import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WidgetConfig } from '@/types/report';

interface Props { widget: WidgetConfig; }

export function MarkdownBlock({ widget }: Props) {
  return (
    <Card className="h-full flex flex-col">
      {widget.title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium truncate">{widget.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex-1 overflow-auto prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-sm">{widget.markdown || 'Bloc texte vide. Cliquez pour éditer.'}</div>
      </CardContent>
    </Card>
  );
}
