"use client";

import type { ReactNode } from "react";
import { theme } from "@/lib/theme";
import StatusPill, { type StatusPillTone } from "./StatusPill";

export type SectionCardProps = {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  tone?: StatusPillTone;
  subtitle?: string;
  children: ReactNode;
};

export default function SectionCard({
  title,
  count,
  open,
  onToggle,
  tone,
  subtitle,
  children,
}: SectionCardProps) {
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden", background: "#fff" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          background: "#fff",
          color: theme.text,
          padding: "12px 12px",
          fontWeight: 900,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
        title="Show/hide section"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ whiteSpace: "nowrap" }}>{title}</div>
          {typeof count === "number" ? (
            <div style={{ color: theme.muted, fontSize: 12, fontWeight: 900 }}>({count})</div>
          ) : null}
          {tone ? (
            <StatusPill
              label={tone === "warn" ? "In progress" : tone === "good" ? "OK" : tone === "danger" ? "Attention" : "-"}
              tone={tone}
            />
          ) : null}
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{open ? "▾" : "▸"}</div>
      </button>

      {subtitle ? (
        <div style={{ padding: "0 12px 10px", fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>{subtitle}</div>
      ) : null}

      {open ? <div style={{ borderTop: `1px solid ${theme.border}`, padding: 12 }}>{children}</div> : null}
    </div>
  );
}
