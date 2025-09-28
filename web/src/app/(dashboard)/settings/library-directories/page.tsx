"use client";

import { LibraryDirectorySettings } from "@/components/admin/settings/library-directories-settings";

export default function SettingsLibraryDirectoriesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Library Directories
        </h1>
        <p className="text-sm text-muted-foreground">
          Enable or disable the directories that each library scans in place.
        </p>
      </header>

      <LibraryDirectorySettings />
    </div>
  );
}
