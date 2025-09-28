"use client";

import { LibraryOperations } from "@/components/admin/library-operations";

export default function AdminLibraryOperationsPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Library Operations</h2>
        <p className="text-muted-foreground">
          Scan managed library directories for new audiobooks using the configured settings.
        </p>
      </section>

      <LibraryOperations />
    </div>
  );
}
