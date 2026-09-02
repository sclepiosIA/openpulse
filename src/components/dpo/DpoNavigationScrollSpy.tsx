import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Shield,
  Server,
  Lock,
  ScrollText,
  UserCog,
  Phone,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  id: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: 'engagements', label: 'Nos engagements', icon: Shield },
  { id: 'hebergement', label: 'Hébergement & Infrastructure', icon: Server },
  { id: 'securite', label: 'Mesures de sécurité', icon: Lock },
  { id: 'traitements', label: 'Registre des traitements', icon: ScrollText },
  { id: 'droits', label: 'Droits des patients', icon: UserCog },
  { id: 'contact', label: 'Contact DPO & FAQ', icon: Phone },
]

interface DpoNavigationScrollSpyProps {
  onDesktopVisibilityChange?: (visible: boolean) => void
}

export function DpoNavigationScrollSpy({ onDesktopVisibilityChange }: DpoNavigationScrollSpyProps) {
  const [activeSection, setActiveSection] = useState('engagements')
  const [open, setOpen] = useState(false)
  const [desktopVisible, setDesktopVisible] = useState(true)

  useEffect(() => {
    onDesktopVisibilityChange?.(desktopVisible)
  }, [desktopVisible, onDesktopVisibilityChange])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: '-10% 0px -30% 0px', threshold: 0.1 }
    )

    navItems.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 100
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' })
    }
    setOpen(false)
  }

  const activeIndex = navItems.findIndex((item) => item.id === activeSection)

  const renderNavItems = (isMobile = false) => (
    <div className="flex flex-col gap-1 relative">
      <div
        className="absolute left-0 w-1 h-10 bg-card rounded-full transition-all duration-300 ease-out"
        style={{ top: `${activeIndex * (isMobile ? 48 : 44) + 4}px` }}
      />
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => scrollToSection(id)}
          className={cn(
            'group flex items-center gap-3 rounded-xl transition-all duration-200 text-left relative',
            isMobile ? 'px-4 py-3' : 'px-3 py-2.5',
            activeSection === id
              ? 'bg-card/15 text-white font-semibold shadow-lg shadow-white/5'
              : 'text-white/60 hover:bg-card/8 hover:text-white/90'
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all duration-200',
              activeSection === id
                ? 'bg-card/20 text-white'
                : 'text-white/50 group-hover:text-white/80'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              'text-[15px] leading-snug transition-all duration-200',
              activeSection === id ? 'font-semibold' : 'font-medium'
            )}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDesktopVisible(!desktopVisible)}
          className={cn(
            'fixed z-50 top-4 h-11 w-11 rounded-full bg-marque-blue text-white shadow-lg shadow-marque-blue/25 hover:bg-marque-blue/90 hover:shadow-xl hover:scale-105 transition-all duration-300',
            desktopVisible ? 'left-[17rem]' : 'left-4'
          )}
          aria-label="Fermer"
        >
          {desktopVisible ? <X className="h-4 w-4" /> : <Menu className="h-5 w-5" />}
        </Button>

        <nav
          className={cn(
            'fixed left-0 top-0 h-screen w-64 bg-marque-grille shadow-2xl shadow-marque-blue/40 transition-all duration-400 ease-in-out z-40 flex flex-col',
            desktopVisible
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-full pointer-events-none'
          )}
        >
          <div className="px-5 pt-6 pb-4 border-b border-white/10">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.2em]">RGPD</p>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-3">{renderNavItems()}</div>
          <div className="px-5 py-4 border-t border-white/10">
            <p className="text-white/30 text-[11px] text-center">Protection des données</p>
          </div>
        </nav>
      </div>

      {/* Mobile */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full bg-marque-blue text-white shadow-lg shadow-marque-blue/30 hover:bg-marque-blue/90 hover:scale-105 transition-all duration-200"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-marque-grille border-none p-0">
            <div className="flex flex-col h-full">
              <div className="px-6 py-5 border-b border-white/10">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.2em]">
                  RGPD
                </p>
              </div>
              <nav className="flex-1 overflow-y-auto py-3 px-3">{renderNavItems(true)}</nav>
              <div className="px-5 py-4 border-t border-white/10">
                <p className="text-white/30 text-[11px] text-center">Protection des données</p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
