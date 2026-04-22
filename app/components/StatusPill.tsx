"use client";

import { theme } from "@/lib/theme";

export type StatusPillTone = "neutral" | "good" | "warn" | "danger";

export type StatusPillProps = {
  label: string;
  tone?: StatusPillTone;
};

export default function StatusPill({ label, tone }: StatusPillProps) {
  const bg =
    tone === "good" ? "#ECFDF5" : tone === "warn" ? "#FFF7ED" : tone === "danger" ? "#FEF2F2" : "#fff";
  const fg =
    tone === "good" ? "#047857" : tone === "warn" ? "#9A3412" : tone === "danger" ? theme.danger : theme.text;

  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: 999,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 900,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}
