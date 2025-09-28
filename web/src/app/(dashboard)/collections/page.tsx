"use client";

import { FolderOpen, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CollectionsPage() {
  return (
    <div className="space-y-8">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Personal Collections</h2>
        <p className="text-muted-foreground">
          Organize your audiobooks into custom collections. Create themed playlists and curated listening experiences.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            Personal collections are currently being developed. This feature will let you create custom groups of audiobooks,
            share collections with others, and organize your library exactly how you want it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              In the meantime, you can browse all available audiobooks in the{" "}
              <a href="/library" className="text-primary underline-offset-4 hover:underline">
                Library
              </a>{" "}
              section.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}