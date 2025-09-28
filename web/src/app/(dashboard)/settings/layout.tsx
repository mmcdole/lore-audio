"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { useUserQuery } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { name: "General", href: "/settings" },
  { name: "Libraries", href: "/settings/libraries" },
  { name: "Library Directories", href: "/settings/library-directories" },
  { name: "Import", href: "/settings/import" },
  { name: "Import Directories", href: "/settings/import-directories" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: user, isLoading } = useUserQuery();
  const isAdmin = Boolean(user?.is_admin);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading settings…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 rounded-2xl border border-border/40 bg-card/60 p-6 text-sm text-muted-foreground">
        You need administrator access to view application settings.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <aside className="lg:w-56">
        <nav className="space-y-2 rounded-2xl border border-border/40 bg-card/50 p-4">
          <p className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
            Settings
          </p>
          <div className="flex flex-col gap-1">
            {SETTINGS_NAV.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
      <section className="flex-1 space-y-6">{children}</section>
    </div>
  );
}
