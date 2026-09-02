import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "@/lib/utils";

interface ActionGroupProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function ActionGroup({
  title,
  description,
  children,
  className,
  orientation = 'horizontal'
}: ActionGroupProps) {
  if (!title && !description) {
    return (
      <div className={cn(
        "flex gap-3",
        orientation === 'vertical' ? "flex-col" : "flex-row flex-wrap",
        className
      )}>
        {children}
      </div>
    );
  }

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader className="pb-3">
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className={cn(
          "flex gap-3",
          orientation === 'vertical' ? "flex-col" : "flex-row flex-wrap"
        )}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
