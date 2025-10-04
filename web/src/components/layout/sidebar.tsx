"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Home,
  Library,
  ListMusic,
  Settings,
  ArrowLeft,
  BookOpen,
  Download,
  Link as LinkIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LibrarySelector } from "./library-selector";

interface SidebarLink {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
}

const PRIMARY_LINKS: SidebarLink[] = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Favorites", href: "/favorites", icon: Heart },
  { name: "Browse", href: "/library", icon: Library },
];

const SECONDARY_LINKS: SidebarLink[] = [
  { name: "Statistics", href: "/stats", icon: ListMusic },
  { name: "Settings", href: "/settings", icon: Settings },
];

const SETTINGS_LINKS: SidebarLink[] = [
  { name: "Libraries", href: "/settings/libraries", icon: BookOpen },
  { name: "Import", href: "/settings/import", icon: Download },
  { name: "Metadata", href: "/settings/metadata", icon: LinkIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const isSettingsPage = pathname?.startsWith("/settings");

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
      <div className="mb-8 px-1">
        <h1 className="text-4xl font-black tracking-[0.5em] text-primary uppercase">
          LORE
        </h1>
      </div>

      {isSettingsPage ? (
        /* Settings Navigation */
        <nav className="flex flex-col gap-6 px-1">
          <Link
            href="/home"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Link>
          <div className="space-y-1">
            <p className="px-3 text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Settings
            </p>
            {SETTINGS_LINKS.map(renderLink)}
          </div>
        </nav>
      ) : (
        /* Main Navigation */
        <>
          <div className="mb-6">
            <LibrarySelector />
          </div>
          <nav className="flex flex-col gap-6 px-1">
            <div className="space-y-1">{PRIMARY_LINKS.map(renderLink)}</div>
            <div className="space-y-1">{SECONDARY_LINKS.map(renderLink)}</div>
          </nav>
        </>
      )}
    </aside>
  );
}
