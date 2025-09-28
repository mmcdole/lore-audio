"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminLibrariesQuery, useUserQuery } from "@/lib/api/hooks";

export default function SettingsLibrariesPage() {
  const { data: user } = useUserQuery();
  const isAdmin = Boolean(user?.is_admin);
  const { data: libraries = [], isPending } = useAdminLibrariesQuery({
    enabled: isAdmin,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Library Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Libraries group directories and make them available to listeners. Use
          this page to review basic information.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isAdmin ? (
          <Card className="col-span-full border-dashed border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle>Administrator access required</CardTitle>
              <CardDescription>
                Only administrators can view library configuration settings.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : isPending ? (
          <SkeletonCards count={3} />
        ) : libraries.length > 0 ? (
          libraries.map((library) => (
            <Card key={library.id} className="flex h-full flex-col">
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {library.display_name}
                  <Badge variant="outline" className="uppercase tracking-wide">
                    {library.type}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {library.description ?? "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Book count</span>
                  <span className="text-foreground">
                    {library.book_count ?? 0}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Directories
                  </p>
                  <ul className="space-y-1 text-xs">
                    {library.directories && library.directories.length > 0 ? (
                      library.directories.map((directory) => (
                        <li
                          key={directory.id}
                          className="truncate text-foreground"
                        >
                          {directory.name} –{" "}
                          <span className="text-muted-foreground">
                            {directory.path}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">
                        No directories assigned.
                      </li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full border-dashed border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle>No libraries yet</CardTitle>
              <CardDescription>
                Create a library via the API or the command line to start
                grouping directories.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-border/30 bg-card/60 p-6"
        >
          <div className="mb-4 h-5 w-2/3 rounded bg-white/10" />
          <div className="mb-2 h-3 w-1/2 rounded bg-white/5" />
          <div className="h-3 w-4/5 rounded bg-white/5" />
        </div>
      ))}
    </>
  );
}
