"use client";

import { ImportSettingsForm } from "@/components/admin/settings/import-settings-form";

export default function SettingsImportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Import Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Adjust default destinations and templates used when importing
          audiobooks.
        </p>
      </header>
      <ImportSettingsForm />
    </div>
  );
}
