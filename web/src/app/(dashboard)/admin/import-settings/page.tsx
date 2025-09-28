"use client";

import { ImportSettingsForm } from "@/components/admin/settings/import-settings-form";

export default function AdminImportSettingsPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Import Settings</h2>
        <p className="text-muted-foreground">
          Define how imported files are copied into your managed libraries, including destination directories and naming templates.
        </p>
      </section>

      <ImportSettingsForm />
    </div>
  );
}
