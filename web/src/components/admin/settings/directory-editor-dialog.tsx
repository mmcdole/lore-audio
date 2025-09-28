"use client";

import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

import { FileExplorer } from "./file-explorer";
import { fullPathToRelative } from "@/lib/path-utils";

type DirectoryKind = "library" | "import";

interface DirectoryEditorDialogProps {
  root: DirectoryKind;
  mode: "create" | "edit";
  open: boolean;
  initialPath?: string;
  saving: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (path: string) => void;
}

export function DirectoryEditorDialog({
  root,
  mode,
  open,
  initialPath,
  saving,
  error,
  onOpenChange,
  onSubmit
}: DirectoryEditorDialogProps) {
  const [relativePath, setRelativePath] = React.useState<string>("");

  const handleSelect = (selection: { relativePath: string; fullPath: string }) => {
    onSubmit(selection.fullPath);
  };

  // Convert full path to relative path when component opens or initialPath changes
  React.useEffect(() => {
    if (open && initialPath) {
      fullPathToRelative(initialPath, root).then(setRelativePath);
    } else {
      setRelativePath("");
    }
  }, [open, initialPath, root]);

  const heading = mode === "create" ? "Add Directory" : "Edit Directory";
  const description =
    root === "import"
      ? "Choose the staging folder you want available during manual imports."
      : "Choose the library folder Flix Audio should monitor for finished audiobooks.";


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg font-semibold capitalize">{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Click "Select Folder" on any directory to add it to your settings.
          </p>
          <FileExplorer
            root={root}
            initialPath={relativePath}
            onSelect={handleSelect}
          />
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

