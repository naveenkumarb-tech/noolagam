import { Book } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";

import { useCurrentUser } from "../features/auth/useCurrentUser";
import { Avatar } from "./Avatar";
import { NAV_ITEMS } from "./navItems";

function Sidebar() {
  const { data: user } = useCurrentUser();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[240px] flex-none flex-col gap-6 border-r border-border bg-surface px-4 py-6 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <div
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-white"
        >
          <Book size={20} />
        </div>
        <span className="text-lg font-extrabold">Noolagam</span>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, sidebarLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] no-underline ${
                isActive
                  ? "bg-reading-bg font-bold text-reading hover:text-reading"
                  : "font-semibold text-text-tertiary hover:bg-background hover:text-text-tertiary"
              }`
            }
          >
            <Icon aria-hidden="true" size={20} />
            {sidebarLabel}
          </NavLink>
        ))}
      </nav>

      <Link
        to="/profile"
        className="mt-auto flex min-w-0 items-center gap-3 rounded-[10px] px-2 py-1.5 text-text no-underline hover:bg-background hover:text-text"
      >
        <Avatar name={user?.name} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold">{user?.name}</span>
          <span className="text-[13px] text-text-secondary">View profile</span>
        </span>
      </Link>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex h-[72px] flex-col items-center justify-center gap-1 text-xs no-underline ${
              isActive
                ? "font-bold text-primary hover:text-primary"
                : "font-semibold text-text-secondary hover:text-text-secondary"
            }`
          }
        >
          <Icon aria-hidden="true" size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

type AppLayoutProps = {
  /** Screens opened from a list have a back button instead of the phone's bottom bar. */
  hideBottomNav?: boolean;
};

export function AppLayout({ hideBottomNav = false }: AppLayoutProps) {
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <main
          className={`mx-auto max-w-[1040px] px-5 pt-6 lg:px-6 lg:py-8 ${
            hideBottomNav ? "pb-[calc(24px+env(safe-area-inset-bottom))]" : "pb-[calc(96px+env(safe-area-inset-bottom))]"
          }`}
        >
          <Outlet />
        </main>
      </div>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
