import { Link, usePage } from '@inertiajs/react';
import { Bell, Home, ListFilter, Plus, Settings, Wrench } from 'lucide-react';

type MobileNativeNavProps = {
  fabHref?: string;
  fabLabel?: string;
  showFab?: boolean;
};

export default function MobileNativeNav({
  fabHref = '/tickets/create',
  fabLabel = 'Nouveau ticket',
  showFab = true,
}: MobileNativeNavProps) {
  const page = usePage();
  const currentPath = (page.url ?? '/').split('?')[0] || '/';
  const currentUrl = page.url ?? '/';
  const isAgent = !!(page.props as any).auth?.user?.agent;
  const unreadCount = Number((page.props as any).notifications?.unread_count ?? 0);

  const isActive = (path: string) => {
    if (path === '/dashboard') return currentPath === '/dashboard';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const navItemClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-all duration-200 active:scale-95 ${
      active ? 'bg-muted/60 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/40'
    }`;

  return (
    <>
      {showFab && (
        <ButtonFab href={fabHref} label={fabLabel} />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2">
          <Link href="/dashboard" className={navItemClass(isActive('/dashboard'))}>
            <Home className="h-4 w-4" />
            Accueil
          </Link>
          <Link href="/tickets" className={navItemClass(isActive('/tickets'))}>
            <ListFilter className="h-4 w-4" />
            Tickets
          </Link>
          <Link href={isAgent ? '/commandes' : '/tickets/create'} className={navItemClass(isActive(isAgent ? '/commandes' : '/tickets/create'))}>
            {isAgent ? <Wrench className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isAgent ? 'Commandes' : 'Créer'}
          </Link>
          <Link href="/dashboard?severity=notification" className={navItemClass(currentUrl.includes('severity=notification'))}>
            <span className="relative inline-flex">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            Notifications
          </Link>
          <Link href="/settings/profile" className={navItemClass(isActive('/settings'))}>
            <Settings className="h-4 w-4" />
            Réglages
          </Link>
        </div>
      </nav>
    </>
  );
}

function ButtonFab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="fixed bottom-20 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg transition-transform duration-200 active:scale-95 lg:hidden"
    >
      <Plus className="h-4 w-4" />
      {label}
    </Link>
  );
}
