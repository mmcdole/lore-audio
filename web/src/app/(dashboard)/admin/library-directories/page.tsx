"use client";

import { LibraryDirectorySettings } from "@/components/admin/settings/library-directories-settings";

export default function AdminLibraryDirectoriesPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Library Directories</h2>
        <p className="text-muted-foreground">
          Choose the directories where finished audiobooks live; they’re scanned in place to keep the catalog current.
        </p>
      </section>

      <LibraryDirectorySettings />
    </div>
  );
}
