import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BriefcaseBusiness, CalendarCheck, ChevronDown, Handshake, LayoutDashboard, MessageCircle, Route } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';


import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { useUnsavedChangesGuard } from '@/components/unsaved-changes-guard';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contacts', label: 'Contacts', icon: Handshake },
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
];

const touchpointItems = [
  { to: '/follow-ups', label: 'Follow-ups', icon: CalendarCheck },
  { to: '/interactions', label: 'Interactions', icon: MessageCircle },
];

export default function Layout() {
  const guard = useUnsavedChangesGuard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const activeTouchpointItem = touchpointItems.find(({ to }: { to: string }) => location.pathname.startsWith(to));
  const touchpointsActive = Boolean(activeTouchpointItem);
  const touchpointsTriggerLabel = 'Touchpoints';
  const visibleTouchpointItems = touchpointItems;


  const handleNavigate = (to: string) => {
    setMobileMenuOpen(false);
    guard?.requestNavigation(to);
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-card text-card-foreground shadow-sm">
        <div className="mx-auto flex box-border w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">Personal career system</p>
            <button type="button" className="block w-fit max-w-full text-left text-xl font-semibold tracking-tight text-foreground transition-colors duration-200 hover:text-primary" onClick={() => handleNavigate('/')}>
              <span className="block truncate">Career Development Hub</span>
            </button>
          </div>
          <nav className="hidden shrink-0 flex-nowrap gap-2 md:flex" aria-label="Primary navigation">
            {navItems.map(({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); handleNavigate(to); }}
                className={({ isActive }: { isActive: boolean }) =>
                  `inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant={touchpointsActive ? 'default' : 'ghost'} className="gap-2 px-3" aria-label="Touchpoints menu">
                  <Route className="h-4 w-4" />
                  <span>{touchpointsTriggerLabel}</span>
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
                {visibleTouchpointItems.map(({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) => {
                  const isActive = location.pathname.startsWith(to);
                  return (
                    <DropdownMenuItem
                      key={to}
                      onSelect={() => handleNavigate(to)}
                      className={`flex h-8 gap-2 rounded-md px-2.5 py-1.5 text-sm focus:bg-accent focus:text-accent-foreground [&_svg]:shrink-0 ${
                        isActive
                          ? 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground [&_svg]:text-primary-foreground'
                          : ''
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? '!text-primary-foreground' : ''}`} />
                      <span className="leading-none">{label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <Button type="button" variant="outline" size="icon" className="relative shrink-0 overflow-hidden md:hidden" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open: boolean) => !open)}>
            <span className="relative block h-5 w-5" aria-hidden="true">
              <span className={`absolute left-0 top-1/2 block h-0.5 w-5 rounded-full bg-foreground transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-y-0 rotate-45' : '-translate-y-2 rotate-0'}`} />
              <span className={`absolute left-0 top-1/2 block h-0.5 w-5 rounded-full bg-foreground transition-opacity duration-200 ease-out ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
              <span className={`absolute left-0 top-1/2 block h-0.5 w-5 rounded-full bg-foreground transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-y-0 -rotate-45' : 'translate-y-2 rotate-0'}`} />
            </span>
          </Button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.nav
              key="mobile-navigation"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.26, ease: 'easeOut' as const }}
              className="absolute right-0 top-full z-30 h-[calc(100vh-100%)] min-w-56 border-l border-t bg-card p-3 text-card-foreground shadow-lg md:hidden"
              aria-label="Mobile navigation"
            >
              <div className="flex w-full flex-col gap-2">
                {[...navItems, ...touchpointItems].map(({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={(event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); handleNavigate(to); }}
                    className={({ isActive }: { isActive: boolean }) =>
                      `inline-flex w-full min-w-48 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-card-foreground hover:bg-accent hover:text-accent-foreground'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="mx-auto box-border w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
