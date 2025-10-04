"use client";

import { ReactNode } from "react";

import { useUserQuery } from "@/lib/api/hooks";

export default function SettingsLayout({ children }: { children: ReactNode }) {
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

  return <div className="space-y-6">{children}</div>;
}
