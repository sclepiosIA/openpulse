import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: 'recommandé' | 'avancé' | 'admin';
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon,
  badge,
  defaultOpen = true,
  collapsible = false,
  children,
  className
}: SettingsSectionProps) {
  const badgeVariants = {
    recommandé: { variant: "default" as const, text: "Recommandé" },
    avancé: { variant: "secondary" as const, text: "Avancé" },
    admin: { variant: "outline" as const, text: "Admin" }
  };

  const content = (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            {icon && <div className="text-primary">{icon}</div>}
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                {badge && (
                  <Badge variant={badgeVariants[badge].variant} className="text-xs">
                    {badgeVariants[badge].text}
                  </Badge>
                )}
              </CardTitle>
              {description && (
                <CardDescription className="mt-1.5 text-sm">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {collapsible && (
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              defaultOpen && "rotate-180"
            )} />
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  if (collapsible) {
    return (
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="w-full">
          {content}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-6">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return content;
}
