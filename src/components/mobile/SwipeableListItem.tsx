import React from 'react';
import { useSwipeActions, SwipeAction } from '@/hooks/ui/useSwipeActions';
import { cn } from '@/lib/utils';

interface SwipeableListItemProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
}

const actionColorClasses = {
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

export function SwipeableListItem({
  children,
  leftActions,
  rightActions,
  className,
}: SwipeableListItemProps) {
  const { translateX, isSwiping, handlers, hasLeftActions, hasRightActions } = useSwipeActions({
    leftActions,
    rightActions,
  });

  return (
    <div className="relative overflow-hidden">
      {/* Actions gauche (révélées par swipe droite) */}
      {hasLeftActions && (
        <div className="absolute left-0 top-0 bottom-0 flex">
          {leftActions?.map((action) => (
            <button
              key={action.id}
              onClick={action.onAction}
              className={cn(
                'flex items-center justify-center px-4 min-w-[80px]',
                'transition-all duration-200',
                actionColorClasses[action.color],
                'touch-target-comfortable'
              )}
              aria-label={action.label}
            >
              {action.icon && <span className="text-2xl">{action.icon}</span>}
              {!action.icon && <span className="text-sm font-medium">{action.label}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Actions droite (révélées par swipe gauche) */}
      {hasRightActions && (
        <div className="absolute right-0 top-0 bottom-0 flex">
          {rightActions?.map((action) => (
            <button
              key={action.id}
              onClick={action.onAction}
              className={cn(
                'flex items-center justify-center px-4 min-w-[80px]',
                'transition-all duration-200',
                actionColorClasses[action.color],
                'touch-target-comfortable'
              )}
              aria-label={action.label}
            >
              {action.icon && <span className="text-2xl">{action.icon}</span>}
              {!action.icon && <span className="text-sm font-medium">{action.label}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Contenu swipeable */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? 'none' : 'transform 250ms ease-out',
        }}
        className={cn('relative bg-background', className)}
      >
        {children}
      </div>
    </div>
  );
}
