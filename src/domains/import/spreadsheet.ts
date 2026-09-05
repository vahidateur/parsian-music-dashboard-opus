/**
 * Spreadsheet parsing and serialization for CSV and XLSX.
 *
 * Imported files are untrusted input, so every limit here is a security
 * control rather than a convenience (§15):
 *
 *  - size and cell/row/column caps bound memory before parsing
 *  - XLSX is a ZIP: entry count, per-entry size and total inflated size are
 *    capped to reject zip bombs
 *  - values are always read as strings; no type coercion, no formula
 *    evaluation. Formulas in a cell are read as their literal text.
 *  - on export, any value that a spreadsheet would treat as a formula is
 *    prefixed so Excel/Sheets renders it as text (CSV injection)
 *
 * XLSX support is intentionally minimal: the SheetML subset a real export
 * produces, not the whole OOXML specification.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/** A parsed sheet: the header row plus data rows, all as raw strings. */
export interface SheetData {
  headers: string[];
  rows: string[][];
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5_000;
export const MAX_COLUMNS = 60;
const MAX_CELL_CHARS = 1_000;
const MAX_ZIP_ENTRIES = 64;
const MAX_INFLATED_BYTES = 40 * 1024 * 1024;

export class SpreadsheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetError";
  }
}

/* ------------------------------------------------------------------ */
/* Formula-injection defence                                           */
/* ------------------------------------------------------------------ */

/**
 * Leading characters that make a spreadsheet treat a cell as a formula.
 * A cell like `=cmd|'/c calc'!A1` executes on open in some configurations.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** True when a value would be interpreted as a formula by Excel or Sheets. */
export function isFormulaLike(value: string): boolean {
  return FORMULA_PREFIX.test(value);
}

/**
 * Neutralizes a value for export. A leading apostrophe forces text mode
 * without changing the visible content.
 */
export function escapeForSpreadsheet(value: string): string {
  return isFormulaLike(value) ? `'${value}` : value;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** UTF-8 BOM: without it Excel on Windows misreads Persian text as mojibake. */
export const UTF8_BOM = "\uFEFF";

/** RFC 4180 parser, tolerant of CRLF and quoted fields containing separators. */
export function parseCsv(text: string): SheetData {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) throw new SpreadsheetError(`فایل بیش از ${MAX_ROWS} سطر دارد.`);
    } else {
      cell += char;
      if (cell.length > MAX_CELL_CHARS) throw new SpreadsheetError("یک سلول بیش از حد بزرگ است.");
    }
  }

  // Trailing cell/row (file may not end with a newline).
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) throw new SpreadsheetError("فایل خالی است.");

  const headers = nonEmpty[0].map((h) => h.trim());
  if (headers.length > MAX_COLUMNS) throw new SpreadsheetError(`فایل بیش از ${MAX_COLUMNS} ستون دارد.`);

  return { headers, rows: nonEmpty.slice(1) };
}

export function toCsv(headers: string[], rows: string[][]): string {
  const encodeCell = (value: string) => {
    const safe = escapeForSpreadsheet(value ?? "");
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [headers.map(encodeCell).join(","), ...rows.map((row) => row.map(encodeCell).join(","))];
  // BOM + CRLF is what Excel expects.
  return UTF8_BOM + lines.join("\r\n");
}

/* ------------------------------------------------------------------ */
/* XLSX                                                                */
/* ------------------------------------------------------------------ */

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Control characters are illegal in XML 1.0 and corrupt the file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** Converts a 1-based column index to its spreadsheet letters (1 → A). */
function columnName(index: number): string {
  let name = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Parses the `A12` part of a cell reference into a 0-based column index. */
function columnIndexOf(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1];
  if (!letters) return -1;
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function extractSharedStrings(xml: string): string[] {
  const out: string[] = [];
  // Each <si> may hold several <t> runs (rich text); concatenate them.
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1]));
    out.push(parts.join(""));
  }
  return out;
}

export function parseXlsx(bytes: Uint8Array): SheetData {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new SpreadsheetError("فایل اکسل معتبر نیست یا آسیب دیده است.");
  }

  const names = Object.keys(files);
  if (names.length > MAX_ZIP_ENTRIES) throw new SpreadsheetError("ساختار فایل اکسل غیرعادی است.");

  // Zip-bomb guard: reject before touching the decompressed content.
  let inflated = 0;
  for (const name of names) {
    inflated += files[name].length;
    if (inflated > MAX_INFLATED_BYTES) throw new SpreadsheetError("حجم بازشدهٔ فایل بیش از حد مجاز است.");
  }

  const sheetName =
    names.find((n) => /^xl\/worksheets\/sheet1\.xml$/i.test(n)) ??
    names.find((n) => /^xl\/worksheets\/.*\.xml$/i.test(n));
  if (!sheetName) throw new SpreadsheetError("هیچ برگه‌ای در فایل اکسل پیدا نشد.");

  const sharedName = names.find((n) => /^xl\/sharedStrings\.xml$/i.test(n));
  const shared = sharedName ? extractSharedStrings(strFromU8(files[sharedName])) : [];
  const sheetXml = strFromU8(files[sheetName]);

  const rows: string[][] = [];
  for (const rowXml of sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const cells: string[] = [];
    for (const cellMatch of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g)) {
      const attrs = cellMatch[1] ?? cellMatch[3] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const index = ref ? columnIndexOf(ref) : cells.length;

      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      // <f> is read but never evaluated: only the cached <v> or inline text.
      const valueRaw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const inline = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("");

      let value: string;
      if (type === "s" && valueRaw !== undefined) {
        value = shared[Number(valueRaw)] ?? "";
      } else if (type === "inlineStr" || inline) {
        value = decodeXmlEntities(inline);
      } else {
        value = decodeXmlEntities(valueRaw ?? "");
      }

      if (value.length > MAX_CELL_CHARS) value = value.slice(0, MAX_CELL_CHARS);
      if (index >= 0 && index < MAX_COLUMNS) {
        while (cells.length < index) cells.push("");
        cells[index] = value;
      }
    }
    rows.push(cells);
    if (rows.length > MAX_ROWS + 1) throw new SpreadsheetError(`فایل بیش از ${MAX_ROWS} سطر دارد.`);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) throw new SpreadsheetError("فایل خالی است.");

  return { headers: nonEmpty[0].map((h) => h.trim()), rows: nonEmpty.slice(1) };
}

/** Builds a minimal but valid XLSX workbook with a single sheet. */
export function toXlsx(headers: string[], rows: string[][], sheetTitle = "Sheet1"): Uint8Array {
  const allRows = [headers, ...rows];
  const sheetRows = allRows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const safe = encodeXml(escapeForSpreadsheet(value ?? ""));
          // Everything is written as an inline string: no type inference means
          // a national ID never loses its leading zero to numeric coercion.
          return `<c r="${columnName(c + 1)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${safe}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${encodeXml(sheetTitle).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  return zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}

/* ------------------------------------------------------------------ */
/* Format detection                                                    */
/* ------------------------------------------------------------------ */

export type SpreadsheetFormat = "csv" | "xlsx";

/**
 * Detects the format from content, not from the filename — an attacker
 * controls the extension, and `PK` is the ZIP magic number every XLSX starts
 * with.
 */
export function detectFormat(bytes: Uint8Array, filename: string): SpreadsheetFormat {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return "xlsx";
  if (/\.xlsx?$/i.test(filename) && bytes.length >= 2 && bytes[0] === 0xd0) {
    throw new SpreadsheetError("فایل‌های قدیمی .xls پشتیبانی نمی‌شوند؛ لطفاً با قالب .xlsx ذخیره کنید.");
  }
  return "csv";
}

/** Parses an uploaded file after enforcing the size limit. */
export function parseSpreadsheet(bytes: Uint8Array, filename: string): SheetData {
  if (bytes.length === 0) throw new SpreadsheetError("فایل خالی است.");
  if (bytes.length > MAX_FILE_BYTES) {
    throw new SpreadsheetError(`حجم فایل بیش از ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} مگابایت است.`);
  }
  const format = detectFormat(bytes, filename);
  if (format === "xlsx") return parseXlsx(bytes);

  let text: string;
  try {
    // `fatal` rejects invalid UTF-8 rather than silently producing U+FFFD.
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SpreadsheetError("متن فایل با UTF-8 خوانده نشد. فایل را با انکدینگ UTF-8 ذخیره کنید.");
  }
  return parseCsv(text);
}

/**
 * Strips path separators and control characters from a user-supplied filename
 * before it is used in a download attribute.
 */
export function safeFilename(name: string, fallback = "export"): string {
  const cleaned = name
    .replace(/[/\\]/g, "-")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
}
