/**
 * JarvisTransitions - Système de transitions fluides v12.5
 * 
 * Page transitions, message animations, skeleton premium, haptic-like feedback
 */

import { memo, ReactNode, forwardRef } from 'react';
import { motion, AnimatePresence, Variants, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// Animation Variants
// ============================================================================

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const slideRightVariants: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const bounceVariants: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 }
  },
  exit: { opacity: 0, scale: 0.9 },
};

// Stagger container for lists
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// ============================================================================
// Transition Components
// ============================================================================

interface TransitionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

/**
 * FadeTransition - Simple opacity fade
 */
export const FadeTransition = memo(function FadeTransition({
  children,
  className,
  delay = 0,
  duration = 0.3,
}: TransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeVariants}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

/**
 * SlideUpTransition - Slide up with fade
 */
export const SlideUpTransition = memo(function SlideUpTransition({
  children,
  className,
  delay = 0,
  duration = 0.3,
}: TransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={slideUpVariants}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

/**
 * ScaleTransition - Scale with fade
 */
export const ScaleTransition = memo(function ScaleTransition({
  children,
  className,
  delay = 0,
  duration = 0.2,
}: TransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={scaleVariants}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

/**
 * BounceTransition - Spring bounce effect
 */
export const BounceTransition = memo(function BounceTransition({
  children,
  className,
  delay = 0,
}: TransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={bounceVariants}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Page Transition Wrapper
// ============================================================================

interface PageTransitionProps extends TransitionProps {
  mode?: 'fade' | 'slide' | 'scale';
}

export const PageTransition = memo(function PageTransition({
  children,
  className,
  mode = 'fade',
  delay = 0,
}: PageTransitionProps) {
  const variants = {
    fade: fadeVariants,
    slide: slideUpVariants,
    scale: scaleVariants,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants[mode]}
        transition={{ duration: 0.25, delay }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================================================
// List Stagger Animation
// ============================================================================

interface StaggerListProps {
  children: ReactNode;
  className?: string;
}

export const StaggerList = memo(function StaggerList({
  children,
  className,
}: StaggerListProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={staggerContainerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
});

export const StaggerItem = memo(function StaggerItem({
  children,
  className,
}: StaggerListProps) {
  return (
    <motion.div
      variants={staggerItemVariants}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Premium Skeleton with Shimmer
// ============================================================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const JarvisSkeleton = memo(function JarvisSkeleton({
  className,
  variant = 'text',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClasses = cn(
    "relative overflow-hidden bg-muted/50",
    "before:absolute before:inset-0",
    "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
    "before:animate-[shimmer_2s_infinite]",
    {
      'rounded-full': variant === 'circular',
      'rounded-lg': variant === 'rounded',
      'rounded-md': variant === 'rectangular',
      'rounded h-4': variant === 'text',
    },
    className
  );

  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={`jarvis-transitions-line-${i}`}
            className={baseClasses}
            style={{
              width: i === lines - 1 ? '60%' : width || '100%',
              height: height || undefined,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={baseClasses}
      style={{ width, height }}
    />
  );
});

// ============================================================================
// Haptic-like Button Wrapper
// ============================================================================

interface HapticButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
  intensity?: 'light' | 'medium' | 'heavy';
}

export const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  function HapticButton({ children, intensity = 'medium', className, ...props }, ref) {
    const scaleValues = {
      light: { tap: 0.98, hover: 1.01 },
      medium: { tap: 0.96, hover: 1.02 },
      heavy: { tap: 0.94, hover: 1.03 },
    };

    const { tap, hover } = scaleValues[intensity];

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: hover }}
        whileTap={{ scale: tap }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={className}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

// ============================================================================
// Presence Animation Wrapper
// ============================================================================

interface PresenceWrapperProps {
  children: ReactNode;
  isVisible: boolean;
  className?: string;
  mode?: 'fade' | 'slide' | 'scale';
}

export const PresenceWrapper = memo(function PresenceWrapper({
  children,
  isVisible,
  className,
  mode = 'fade',
}: PresenceWrapperProps) {
  const variants = {
    fade: fadeVariants,
    slide: slideUpVariants,
    scale: scaleVariants,
  };

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={variants[mode]}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Keyframe for shimmer (add to tailwind.config.ts if needed)
// ============================================================================
// keyframes: {
//   shimmer: {
//     '0%': { transform: 'translateX(-100%)' },
//     '100%': { transform: 'translateX(100%)' },
//   },
// },
// animation: {
//   shimmer: 'shimmer 2s infinite',
// },
