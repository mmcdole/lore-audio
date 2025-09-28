import Link from "next/link";
import { FolderOpen, HardDrive, Link as LinkIcon, Settings as SettingsIcon, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Admin Control Center</h2>
        <p className="text-muted-foreground">
          Configure how your library is organized and perform admin-only operations to keep it up to date.
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Configuration</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Library Directories
              </CardTitle>
              <CardDescription>Manage the directories that are scanned in place.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/library-directories">Manage Library Directories</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Import Directories
              </CardTitle>
              <CardDescription>Configure staging directories for manual imports.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/import-directories">Manage Import Directories</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Import Settings
              </CardTitle>
              <CardDescription>Adjust destination directories and naming templates for imports.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/import-settings">Adjust Import Defaults</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Operations</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Library Operations
              </CardTitle>
              <CardDescription>Scan managed libraries and review recent results.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/library">Open Library Tools</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Import Operations
              </CardTitle>
              <CardDescription>Browse staging directories and import selected audiobooks.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/import">Import from Folders</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Metadata Matching
              </CardTitle>
              <CardDescription>Link audiobooks to external metadata sources.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/metadata">Manage Metadata</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Quick stats and system health information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Total Audiobooks</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Active Users</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Storage Used</p>
              <p className="text-2xl font-bold">-- GB</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
