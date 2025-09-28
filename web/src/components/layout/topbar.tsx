"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Bell, Plus, Search as SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserQuery } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./theme-toggle";
import { LibrarySelector } from "./library-selector";

const routeTitles: Record<string, string> = {
  "/home": "Welcome Back",
  "/library": "Your Library",
  "/series": "Series Collection",
  "/authors": "Authors & Narrators",
  "/collections": "Personal Collections",
  "/search": "Search",
  "/player": "Now Playing",
  "/profile": "Profile",
  "/stats": "Listening Analytics",
  "/admin": "Admin Dashboard",
  "/admin/metadata": "Metadata Matching",
  "/admin/library": "Library Management",
  "/admin/import": "Import Audiobooks",
  "/settings": "Settings",
  "/settings/libraries": "Library Settings",
  "/settings/library-directories": "Library Directories",
  "/settings/import": "Import Settings",
  "/settings/import-directories": "Import Directories",
};

export function Topbar() {
  const pathname = usePathname();
  const { data: user } = useUserQuery();
  const title = useMemo(() => {
    if (!pathname) return "Dashboard";
    const entry = Object.entries(routeTitles).find(
      ([route]) => pathname === route || pathname.startsWith(`${route}/`)
    );
    return entry?.[1] ?? "Dashboard";
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border/40 bg-background/70 px-4 pb-6 pt-6 backdrop-blur-xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <LibrarySelector />
        </div>
        <div className="flex items-center gap-2">
          {user?.is_admin && (
            <Button asChild variant="glass">
              <Link href="/admin/imports" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Import Audiobooks
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 via-primary/20 to-background text-sm font-semibold">
            FA
          </div>
        </div>
      </div>
      <div className="relative w-full max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search library..."
          className={cn("pl-9 h-9", "bg-card/90 shadow-card")}
        />
      </div>
    </header>
  );
}
