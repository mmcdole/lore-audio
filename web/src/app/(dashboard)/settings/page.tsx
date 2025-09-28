export default function SettingsOverviewPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Application Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure how Flix Audio organizes libraries, directories, and import
          destinations.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border/30 bg-card/70 p-6">
          <h2 className="text-lg font-medium text-foreground">Libraries</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Review the libraries you have created and manage their directories.
          </p>
        </div>
        <div className="rounded-2xl border border-border/30 bg-card/70 p-6">
          <h2 className="text-lg font-medium text-foreground">Import</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure staging folders and default destinations used during
            manual imports.
          </p>
        </div>
      </div>
    </div>
  );
}
