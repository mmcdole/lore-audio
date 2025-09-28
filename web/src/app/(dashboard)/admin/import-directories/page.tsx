"use client";

import { ImportDirectorySettings } from "@/components/admin/settings/import-directories-settings";

export default function AdminImportDirectoriesPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Import Directories</h2>
        <p className="text-muted-foreground">
          Configure staging directories admins browse when preparing new imports.
        </p>
      </section>

      <ImportDirectorySettings />
    </div>
  );
}
