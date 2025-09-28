import { ReactNode } from "react";

import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { LibraryProvider } from "@/providers/library-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <LibraryProvider>{children}</LibraryProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
