"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ThemeToggle } from "./theme-toggle";
import { LibrarySelector } from "./library-selector";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/70 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <LibrarySelector />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 via-primary/20 to-background text-xs font-semibold">
            FA
          </div>
        </div>
      </div>
    </header>
  );
}
