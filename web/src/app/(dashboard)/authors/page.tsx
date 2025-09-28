"use client";

import { User, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthorsPage() {
  return (
    <div className="space-y-8">
      <section className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Authors & Narrators</h2>
        <p className="text-muted-foreground">
          Discover audiobooks by your favorite authors and narrators. Find new voices and explore their complete works.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            Author and narrator browsing is currently being developed. This feature will let you explore audiobooks
            organized by creators, discover new authors, and follow your favorite narrators across different works.
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