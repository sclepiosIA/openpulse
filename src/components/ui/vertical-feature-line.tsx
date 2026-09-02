import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VerticalFeatureLineProps {
  children: React.ReactNode;
  className?: string;
  showTopDot?: boolean;
  dotColor?: string;
  lineGradient?: string;
  glowIntensity?: "none" | "subtle" | "medium" | "strong";
}

/**
 * Premium vertical feature line component inspired by OpenPulse home page
 * Creates a thick blue vertical line with optional glow effect and top dot
 */
export function VerticalFeatureLine({
  children,
  className,
  showTopDot = true,
  dotColor = "bg-primary",
  lineGradient = "from-primary via-primary/60 to-transparent",
  glowIntensity = "medium",
}: VerticalFeatureLineProps) {
  const glowClasses = {
    none: "",
    subtle: "shadow-[0_0_8px_hsl(var(--primary)/0.2)]",
    medium: "shadow-[0_0_15px_hsl(var(--primary)/0.3)]",
    strong: "shadow-[0_0_25px_hsl(var(--primary)/0.4)]",
  };

  return (
    <div className={cn("relative", className)}>
      {/* Main vertical line with glow */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-full",
          `bg-gradient-to-b ${lineGradient}`,
          glowClasses[glowIntensity]
        )}
      />

      {/* Top dot with pulse animation */}
      {showTopDot && (
        <motion.div
          className="absolute left-0 -top-1 -translate-x-[calc(50%-2px)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <div className={cn(
            "w-3 h-3 rounded-full ring-2 ring-background",
            dotColor
          )}>
            <span className="absolute inset-0 rounded-full bg-primary/50 animate-ping" />
          </div>
        </motion.div>
      )}

      {/* Content with left padding */}
      <div className="pl-6">{children}</div>
    </div>
  );
}

interface TimelineDotProps {
  active?: boolean;
  hasUnread?: boolean;
  color?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Dot indicator for timeline items
 */
export function TimelineDot({
  active = false,
  hasUnread = false,
  color = "bg-muted",
  size = "md",
}: TimelineDotProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "rounded-full border-2 border-background transition-all duration-200",
          sizeClasses[size],
          active && "bg-primary ring-2 ring-primary/30",
          hasUnread && !active && "bg-primary",
          !active && !hasUnread && color
        )}
      />
      {hasUnread && (
        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-50" />
      )}
    </div>
  );
}

interface TimelineBranchProps {
  className?: string;
}

/**
 * Horizontal branch connecting timeline to content
 */
export function TimelineBranch({ className }: TimelineBranchProps) {
  return (
    <div
      className={cn(
        "absolute left-0 top-1/2 w-4 h-0.5 bg-primary/30 rounded",
        className
      )}
    />
  );
}
