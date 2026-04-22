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
};

export default function ScoreInput({
  valueA,
  valueB,
  onChangeA,
  onChangeB,
  disabled,
  onFocus,
  onBlur,
}: ScoreInputProps) {
  const inputStyle = {
    width: "100%",
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: "10px 10px",
    fontWeight: 900,
  } as const;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 46px 1fr", gap: 8, alignItems: "center" }}>
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
