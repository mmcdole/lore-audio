"use client";

import React from "react";
import { Save, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ImportSettingsPayload {
  id: string;
  destination_path: string;
  template: string;
  updated_at?: string;
}

export function ImportSettingsForm() {
  const [settings, setSettings] = React.useState<ImportSettingsPayload | null>(null);
  const [destination, setDestination] = React.useState("");
  const [template, setTemplate] = React.useState("{author}/{title}");
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/import-settings");
      if (!res.ok) throw new Error("Failed to load import settings");
      const payload = await res.json();
      const data: ImportSettingsPayload | undefined = payload.data;
      if (data) {
        setSettings(data);
        setDestination(data.destination_path ?? "");
        setTemplate(data.template ?? "{author}/{title}");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/admin/import-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_path: destination,
          template
        })
      });
      if (!res.ok) throw new Error("Failed to update settings");
      setMessage("Settings saved");
      await loadSettings();
    } catch (error) {
      console.error(error);
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Import Defaults</CardTitle>
          <CardDescription>Destination directory and naming template applied during imports.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadSettings} disabled={loading}>
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={saveSettings} disabled={saving || !destination.trim()}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="import-destination">Destination library directory</label>
          <Input
            id="import-destination"
            placeholder="/mnt/media/audiobooks"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Imported audiobooks will be copied into this directory using the template below.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="import-template">Directory template</label>
          <Textarea
            id="import-template"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            rows={3}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Available tokens: {"{author}"}, {"{title}"}, {"{series}"}, {"{series_num}"}, {"{narrator}"}, {"{year}"}
          </p>
        </div>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
        {settings?.updated_at && (
          <p className="text-xs text-muted-foreground">Last saved {new Date(settings.updated_at).toLocaleString()}</p>
        )}
      </CardContent>
    </Card>
  );
}
