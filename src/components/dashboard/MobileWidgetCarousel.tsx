import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Widget {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface MobileWidgetCarouselProps {
  widgets: Widget[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
  compact?: boolean;
}

export function MobileWidgetCarousel({
  widgets,
  currentIndex = 0,
  onIndexChange,
  className,
  compact = false
}: MobileWidgetCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    containScroll: 'trimSnaps',
    skipSnaps: false,
  });
  
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const index = emblaApi.selectedScrollSnap();
    setSelectedIndex(index);
    onIndexChange?.(index);
  }, [emblaApi, onIndexChange]);

  useEffect(() => {
    if (!emblaApi) return;
    
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Sync external index changes
  useEffect(() => {
    if (currentIndex !== selectedIndex && emblaApi) {
      scrollTo(currentIndex);
    }
  }, [currentIndex, selectedIndex, scrollTo, emblaApi]);

  if (widgets.length === 0) return null;

  return (
    <div className={cn('relative', className)}>
      {/* Navigation tabs - compact pill style */}
      <div className="flex items-center justify-center gap-1 mb-1.5 px-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1 px-1 bg-muted/30 rounded-full">
          {widgets.map((widget, index) => {
            const Icon = widget.icon;
            const isActive = index === selectedIndex;
            
            return (
              <motion.button
                key={widget.id}
                onClick={() => scrollTo(index)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                animate={{
                  scale: isActive ? 1 : 0.95,
                }}
                transition={{ duration: 0.15 }}
              >
                {Icon && <Icon className="h-3 w-3" />}
                <span className={cn(
                  "truncate",
                  compact ? "max-w-[45px]" : "max-w-[60px]"
                )}>{widget.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              className="flex-[0_0_100%] min-w-0 px-2"
            >
              <motion.div
                initial={false}
                animate={{ 
                  opacity: index === selectedIndex ? 1 : 0.4, 
                  scale: index === selectedIndex ? 1 : 0.96 
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                  compact && "compact"
                )}
              >
                {widget.content}
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress dots - minimal style */}
      <div className="flex items-center justify-center gap-1 mt-1.5">
        {widgets.map((widget, index) => (
          <motion.button
            key={`dot-${widget.id}`}
            onClick={() => scrollTo(index)}
            className={cn(
              "rounded-full transition-all",
              index === selectedIndex
                ? "bg-primary"
                : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
            )}
            animate={{
              width: index === selectedIndex ? 16 : 6,
              height: 6,
            }}
            transition={{ duration: 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}
