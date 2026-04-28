import Papa from "papaparse";

export type CsvParseRow<T> = {
  index: number;
  raw: Record<string, string>;
  parsed: T | null;
  errors: string[];
};

export type RowValidator<T> = (
  raw: Record<string, string>,
) => { ok: true; data: T } | { ok: false; errors: string[] };

// Single CSV-parsing pipeline reused by both the new-club wizard's "initial
// players" step and the bulk player-invite modal. Header normalization +
// per-row validation + maxRows truncation are shared; the row-level shape
// validation (which Zod schema, which fields are required) varies per
// caller and is supplied as a `validate` callback.
//
// Headers are case-insensitive (`First_Name` and `first_name` both work);
// empty lines are skipped at the parser level. The `raw` field is preserved
// in the output so the caller can render the original strings beside any
// validation errors.
export function parsePlayerCsv<T>(
  text: string,
  validate: RowValidator<T>,
  maxRows = 100,
): CsvParseRow<T>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return result.data.slice(0, maxRows).map((raw, i) => {
    const check = validate(raw);
    return check.ok
      ? { index: i, raw, parsed: check.data, errors: [] }
      : { index: i, raw, parsed: null, errors: check.errors };
  });
}
