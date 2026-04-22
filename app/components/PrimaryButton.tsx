"use client";

import { theme } from "@/lib/theme";

export type PrimaryButtonVariant = "solid" | "outline" | "danger";

export type PrimaryButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: PrimaryButtonVariant;
  title?: string;
  /** When true, the button text is replaced with a working indicator. */
  busy?: boolean;
};

export default function PrimaryButton({
  label,
  onClick,
  disabled,
  variant,
  title,
  busy,
}: PrimaryButtonProps) {
  const isSolid = variant === "solid";
  const isDanger = variant === "danger";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled}
      title={title}
      style={{
        width: "100%",
        border: isSolid ? "none" : `1px solid ${theme.border}`,
        background: disabled ? "#9CA3AF" : isDanger ? "#fff" : isSolid ? theme.maroon : "#fff",
        color: disabled ? "#fff" : isDanger ? theme.danger : isSolid ? "#fff" : theme.text,
        padding: "10px 12px",
        borderRadius: 12,
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {busy ? "Working..." : label}
    </button>
  );
}
