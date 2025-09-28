"use client";

import { ImportDirectorySettings } from "@/components/admin/settings/import-directories-settings";

export default function SettingsImportDirectoriesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Import Directories
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure the staging directories Flix Audio watches for new uploads.
        </p>
      </header>
      <ImportDirectorySettings />
    </div>
  );
}
