"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileExplorer } from "./file-explorer";

interface DirectoryPickerProps {
  root: "library" | "import";
  open: boolean;
  initialPath?: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: { relativePath: string; fullPath: string }) => void;
}

export function DirectoryPicker({ root, open, onOpenChange, onSelect, initialPath = "" }: DirectoryPickerProps) {
  const handleSelect = (selection: { relativePath: string; fullPath: string }) => {
    onSelect(selection);
    onOpenChange(false);
  };

  const descriptionCopy =
    root === "import"
      ? "Choose the staging folder you pull audiobooks from before import."
      : "Pick the library folder Flix Audio keeps indexed for finished titles.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b px-6 py-5">
          <DialogTitle>Browse Folders</DialogTitle>
          <DialogDescription>{descriptionCopy}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <FileExplorer
            root={root}
            initialPath={initialPath}
            onSelect={handleSelect}
          />
        </div>

        <div className="flex justify-end border-t bg-muted/40 px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
