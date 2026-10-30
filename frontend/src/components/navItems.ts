import { ChartNoAxesColumn, CirclePlus, House, LibraryBig, type LucideIcon } from "lucide-react";

type NavItem = {
  to: string;
  /** Short label for the phone's bottom bar. */
  label: string;
  /** Longer label for the laptop sidebar. */
  sidebarLabel: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", sidebarLabel: "Home", icon: House },
  { to: "/books", label: "Books", sidebarLabel: "My books", icon: LibraryBig },
  { to: "/books/new", label: "Add", sidebarLabel: "Add book", icon: CirclePlus },
  { to: "/stats", label: "Stats", sidebarLabel: "Stats", icon: ChartNoAxesColumn },
];
