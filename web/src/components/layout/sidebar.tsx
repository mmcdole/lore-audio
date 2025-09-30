"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Headset,
  Home,
  Library,
  ListMusic,
  Settings,
  UserCog,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface SidebarLink {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
}

const PRIMARY_LINKS: SidebarLink[] = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Favorites", href: "/favorites", icon: Heart },
  { name: "Library", href: "/library", icon: Library },
];

const SECONDARY_LINKS: SidebarLink[] = [
  { name: "Statistics", href: "/stats", icon: ListMusic },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Admin", href: "/admin", icon: UserCog },
];

export function Sidebar() {
  const pathname = usePathname();

  const renderLink = ({ href, name, icon: Icon, badge }: SidebarLink) => {
    const isActive = pathname === href || pathname?.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 truncate">{name}</span>
        {badge ? (
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="hidden h-full w-64 flex-col border-r border-border/40 bg-gradient-to-b from-background/95 to-background/60 px-4 pb-6 pt-8 lg:flex">
      <div className="mb-8 flex items-center gap-2 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
          <Headset className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Flix Audio</p>
          <h2 className="text-lg font-semibold text-foreground">
            Listening Hub
          </h2>
        </div>
      </div>
      <nav className="flex flex-col gap-6">
        <div className="space-y-1">{PRIMARY_LINKS.map(renderLink)}</div>
        <div className="space-y-1">{SECONDARY_LINKS.map(renderLink)}</div>
      </nav>
    </aside>
  );
}
