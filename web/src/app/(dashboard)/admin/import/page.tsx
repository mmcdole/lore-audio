"use client";

import { ImportOperations } from "@/components/admin/import-operations";

export default function AdminImportOperationsPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Import Operations</h2>
        <p className="text-muted-foreground">
          Browse staging directories and import selected audiobooks into managed libraries.
        </p>
      </section>

      <ImportOperations />
    </div>
  );
}
