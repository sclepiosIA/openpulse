import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { MobileWidgetCarousel } from './MobileWidgetCarousel';

interface Widget {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface CarouselSection {
  id: string;
  title: string;
  icon: LucideIcon;
  widgets: Widget[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

interface MobileDualCarouselProps {
  sections: CarouselSection[];
  className?: string;
}

export function MobileDualCarousel({ sections, className }: MobileDualCarouselProps) {
  if (sections.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {sections.map((section) => (
        <div key={section.id} className="relative">
          {/* Section Header - plus compact */}
          <div className="flex items-center gap-1.5 px-3 mb-1.5">
            <div className="p-1 rounded-md bg-primary/10">
              <section.icon className="h-3 w-3 text-primary" />
            </div>
            <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">
              {section.title}
            </span>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          
          {/* Carousel */}
          <MobileWidgetCarousel
            widgets={section.widgets}
            currentIndex={section.currentIndex}
            onIndexChange={section.onIndexChange}
            compact
          />
        </div>
      ))}
    </div>
  );
}
