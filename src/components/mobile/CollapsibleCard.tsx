import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollapsibleCardProps {
  title: string;
  preview?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function CollapsibleCard({
  title,
  preview,
  children,
  defaultOpen = false,
  icon,
  badge,
  className,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn('overflow-hidden', className)}>
        <CollapsibleTrigger className="w-full touch-target-comfortable">
          <CardHeader className="flex flex-row items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {icon && <div className="text-primary">{icon}</div>}
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {badge}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {!isOpen && preview && (
          <CardContent className="px-4 pb-4 pt-0">
            {preview}
          </CardContent>
        )}

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
