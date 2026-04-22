"use client";

import { theme } from "@/lib/theme";

export type ScoreInputProps = {
  valueA: string;
  valueB: string;
  onChangeA: (next: string) => void;
  onChangeB: (next: string) => void;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Width of the centre "-" separator column in pixels. Default 46. */
  separatorWidth?: number;
  /** When true, use `minmax(0, 1fr)` columns and apply `minWidth: 0` to inputs so the pair can shrink inside a tight flex/grid parent. */
  flexibleColumns?: boolean;
};

export default function ScoreInput({
  valueA,
  valueB,
  onChangeA,
  onChangeB,
  disabled,
  onFocus,
  onBlur,
  separatorWidth,
  flexibleColumns,
}: ScoreInputProps) {
  const sep = typeof separatorWidth === "number" ? separatorWidth : 46;
  const colDef = flexibleColumns ? "minmax(0,1fr)" : "1fr";

  const inputStyle = {
    width: "100%",
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: "10px 10px",
    fontWeight: 900,
    ...(flexibleColumns ? { minWidth: 0 } : null),
  } as const;

  return (
    <div style={{ display: "grid", gridTemplateColumns: `${colDef} ${sep}px ${colDef}`, gap: 8, alignItems: "center" }}>
      <input
        inputMode="numeric"
        value={valueA}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => onChangeA(e.target.value)}
        placeholder="A"
        disabled={!!disabled}
        style={inputStyle}
      />
      <div style={{ textAlign: "center", fontWeight: 900, color: theme.muted }}>-</div>
      <input
        inputMode="numeric"
        value={valueB}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => onChangeB(e.target.value)}
        placeholder="B"
        disabled={!!disabled}
        style={inputStyle}
      />
    </div>
  );
}
