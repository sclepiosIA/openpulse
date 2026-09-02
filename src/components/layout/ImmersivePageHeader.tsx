import { ReactNode } from 'react'
import { LucideIcon, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { IconCircle } from '@/components/ui/icon-circle'
import { useShouldAnimate } from '@/hooks/ui/useShouldAnimate'

interface ImmersivePageHeaderProps {
  /** Main title of the page */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Icon component from lucide-react */
  icon: LucideIcon
  /** Optional stats to display inline */
  stats?: { label: string; value: string | number; highlight?: boolean }[]
  /** Placeholder for search field */
  searchPlaceholder?: string
  /** Callback when search field is clicked (opens global search dialog) */
  onSearchClick?: () => void
  /** Controlled inline search value (when provided, an actual <input> filters the list) */
  searchValue?: string
  /** Setter for controlled inline search value */
  onSearchChange?: (value: string) => void
  /** Optional action buttons to display on the right */
  actions?: ReactNode
  /** Content to render below the header (e.g., tabs, filters) */
  children?: ReactNode
  /** Additional className for the container */
  className?: string
  /** Whether to show animated waves (default: true) */
  showWaves?: boolean
  /** Variant: 'default' or 'compact' */
  variant?: 'default' | 'compact'
}

// Floating orbs configuration
const floatingOrbs = [
  { size: 100, x: '85%', y: '10%', delay: 0, color: 'hsl(197 64% 60% / 0.15)' },
  { size: 80, x: '5%', y: '60%', delay: 0.5, color: 'hsl(210 70% 65% / 0.12)' },
  { size: 60, x: '75%', y: '70%', delay: 1, color: 'hsl(197 64% 70% / 0.1)' },
]

export function ImmersivePageHeader({
  title,
  subtitle,
  icon: Icon,
  stats,
  searchPlaceholder = 'Rechercher...',
  onSearchClick,
  searchValue,
  onSearchChange,
  actions,
  children,
  className,
  showWaves = true,
  variant = 'default',
}: ImmersivePageHeaderProps) {
  const isCompact = variant === 'compact'
  const shouldAnimate = useShouldAnimate()

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'bg-marque-grille',
        isCompact ? 'py-3 sm:py-4' : 'py-4 sm:py-5',
        className
      )}
    >
      {/* Floating orbs - conditionally animated */}
      {floatingOrbs.map((orb, index) =>
        shouldAnimate ? (
          <motion.div
            key={`orb-${orb.x}-${orb.y}`}
            className="absolute rounded-full blur-2xl pointer-events-none"
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              backgroundColor: orb.color,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -10, 0],
            }}
            transition={{
              opacity: { duration: 0.6, delay: orb.delay },
              scale: { duration: 0.6, delay: orb.delay },
              y: {
                duration: 6 + index,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: orb.delay,
              },
            }}
          />
        ) : (
          <div
            key={`orb-${orb.x}-${orb.y}`}
            className="absolute rounded-full blur-2xl pointer-events-none"
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              backgroundColor: orb.color,
            }}
          />
        )
      )}

      {/* Content container */}
      <div className="relative z-10 px-3 sm:px-4 lg:px-6">
        {/* Main header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Left side: Icon + Title/Subtitle + Stats */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <IconCircle
              icon={Icon}
              variant="gradient"
              color="primary"
              size="lg"
              className="shadow-lg shadow-black/20 border border-white/10 hidden sm:flex"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate tracking-tight">
                  {title}
                </h1>
                {stats && stats.length > 0 && (
                  <div className="hidden md:flex items-center gap-3">
                    {stats.map((stat, index) => (
                      <div key={`stat-${stat.label}`} className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            stat.highlight ? 'text-white' : 'text-white/80'
                          )}
                        >
                          {stat.value}
                        </span>
                        <span className="text-xs text-white/60">{stat.label}</span>
                        {index < stats.length - 1 && <span className="text-white/30 ml-1">•</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {subtitle && (
                <p className="text-xs sm:text-sm text-white/60 truncate mt-0.5 hidden lg:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side: Search + Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
            {/* Glassmorphism Search Field */}
            {onSearchChange ? (
              <div className="hidden sm:flex items-center gap-2 px-3 h-9 bg-card/10 backdrop-blur-sm border border-white/20 rounded-lg text-white min-w-[180px] lg:min-w-[220px] focus-within:bg-card/20 transition-all">
                <Search className="h-4 w-4 flex-shrink-0 text-white/70" />
                <input
                  type="text"
                  value={searchValue ?? ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none"
                />
              </div>
            ) : (
              onSearchClick && (
                <button
                  onClick={onSearchClick}
                  className="hidden sm:flex items-center gap-2 px-3 h-9 bg-card/10 backdrop-blur-sm border border-white/20 rounded-lg text-white/70 hover:bg-card/20 hover:text-white transition-all min-w-[180px] lg:min-w-[220px]"
                >
                  <Search className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm truncate flex-1 text-left">{searchPlaceholder}</span>
                  <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-white/20 bg-card/5 px-1.5 font-mono text-[10px] text-white/50">
                    ⌘K
                  </kbd>
                </button>
              )
            )}

            {/* Action buttons */}
            {actions}
          </div>
        </div>

        {/* Optional children (tabs, filters, etc.) */}
        {children && <div className="mt-3 sm:mt-4">{children}</div>}
      </div>

      {/* Animated waves at bottom */}
      {showWaves && (
        <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden pointer-events-none">
          {shouldAnimate ? (
            <>
              <motion.svg
                className="absolute bottom-0 w-full h-full"
                viewBox="0 0 1440 40"
                preserveAspectRatio="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.path
                  d="M0,20 C240,35 480,5 720,20 C960,35 1200,5 1440,20 L1440,40 L0,40 Z"
                  fill="hsl(197 64% 97%)"
                  initial={{
                    d: 'M0,20 C240,35 480,5 720,20 C960,35 1200,5 1440,20 L1440,40 L0,40 Z',
                  }}
                  animate={{
                    d: [
                      'M0,20 C240,35 480,5 720,20 C960,35 1200,5 1440,20 L1440,40 L0,40 Z',
                      'M0,25 C240,10 480,35 720,25 C960,10 1200,35 1440,25 L1440,40 L0,40 Z',
                      'M0,20 C240,35 480,5 720,20 C960,35 1200,5 1440,20 L1440,40 L0,40 Z',
                    ],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </motion.svg>
              <motion.svg
                className="absolute bottom-0 w-full h-full"
                viewBox="0 0 1440 40"
                preserveAspectRatio="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <motion.path
                  d="M0,25 C360,10 720,40 1080,25 C1260,15 1350,30 1440,25 L1440,40 L0,40 Z"
                  fill="hsl(210 70% 95%)"
                  initial={{
                    d: 'M0,25 C360,10 720,40 1080,25 C1260,15 1350,30 1440,25 L1440,40 L0,40 Z',
                  }}
                  animate={{
                    d: [
                      'M0,25 C360,10 720,40 1080,25 C1260,15 1350,30 1440,25 L1440,40 L0,40 Z',
                      'M0,30 C360,40 720,15 1080,30 C1260,40 1350,20 1440,30 L1440,40 L0,40 Z',
                      'M0,25 C360,10 720,40 1080,25 C1260,15 1350,30 1440,25 L1440,40 L0,40 Z',
                    ],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.5,
                  }}
                />
              </motion.svg>
            </>
          ) : (
            <>
              <svg
                className="absolute bottom-0 w-full h-full"
                viewBox="0 0 1440 40"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,20 C240,35 480,5 720,20 C960,35 1200,5 1440,20 L1440,40 L0,40 Z"
                  fill="hsl(197 64% 97%)"
                />
              </svg>
              <svg
                className="absolute bottom-0 w-full h-full opacity-50"
                viewBox="0 0 1440 40"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,25 C360,10 720,40 1080,25 C1260,15 1350,30 1440,25 L1440,40 L0,40 Z"
                  fill="hsl(210 70% 95%)"
                />
              </svg>
            </>
          )}
        </div>
      )}
    </div>
  )
}
