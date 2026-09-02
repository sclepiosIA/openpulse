import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Building2, Calendar, Mail, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MobileBottomNavDrawer } from './MobileBottomNavDrawer';
import { useNavigationBadges } from '@/hooks/ui/useNavigationBadges';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badgeKey?: 'emails' | 'pulse' | 'todos' | 'calendar' | 'more';
}

const baseNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Accueil', icon: Home, path: '/' },
  { id: 'etablissements', label: 'Prospects', icon: Building2, path: '/prospects' },
  { id: 'calendrier', label: 'Agenda', icon: Calendar, path: '/calendrier', badgeKey: 'calendar' },
  { id: 'emails', label: 'Emails', icon: Mail, path: '/emails', badgeKey: 'emails' },
  { id: 'more', label: 'Plus', icon: MoreHorizontal, path: '', badgeKey: 'more' },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const badges = useNavigationBadges();
  
  // Mapper les badges dynamiquement aux items de navigation
  const navItems = useMemo(() => {
    return baseNavItems.map(item => {
      let badgeCount = 0;
      if (item.badgeKey === 'emails') badgeCount = badges.emails;
      else if (item.badgeKey === 'calendar') badgeCount = badges.calendar;
      else if (item.badgeKey === 'more') badgeCount = badges.pulse + badges.todos; // Pulse + Todos dans "Plus"
      return { ...item, badge: badgeCount > 0 ? badgeCount : undefined };
    });
  }, [badges]);

  const handleNavClick = (item: NavItem) => {
    if (item.id === 'more') {
      setDrawerOpen(true);
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t bg-background/95 backdrop-blur-lg safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = item.path && (location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path)));
            
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1',
                  'min-w-[60px] h-12 rounded-lg',
                  'transition-colors duration-200',
                  'touch-target-comfortable relative',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge && item.badge > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  'text-[11px] font-medium',
                  isActive && 'font-semibold'
                )}>
                  {item.label}
                </span>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
      
      <MobileBottomNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
