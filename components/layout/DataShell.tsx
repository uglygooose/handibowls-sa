"use client";

import type { ReactNode } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { cn } from "@/lib/utils";

type Props = {
  list: ReactNode;
  detail: ReactNode;
  defaultListSize?: number;
  minListSize?: number;
  autoSaveId?: string;
  className?: string;
};

// Admin/desktop two-pane shell. List on the left, detail on the right.
// Panel sizes persist via localStorage when autoSaveId is set.
export function DataShell({
  list,
  detail,
  defaultListSize = 34,
  minListSize = 24,
  autoSaveId,
  className,
}: Props) {
  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId={autoSaveId}
      className={cn("h-full w-full", className)}
      data-slot="data-shell"
    >
      <Panel
        defaultSize={defaultListSize}
        minSize={minListSize}
        className="bg-surface"
      >
        <div className="h-full overflow-y-auto">{list}</div>
      </Panel>
      <PanelResizeHandle
        aria-label="Resize panels"
        className="relative w-px bg-border transition-colors data-[resize-handle-state=hover]:bg-primary-500 data-[resize-handle-state=drag]:bg-primary-500"
      />
      <Panel minSize={40} className="bg-surface">
        <div className="h-full overflow-y-auto">{detail}</div>
      </Panel>
    </PanelGroup>
  );
}
