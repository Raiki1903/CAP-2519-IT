/**
 * CSV reader and parsing utilities: RFC 4180 parsing, header normalization, date/money parsing, and error capping.
 * Layer: feature utility. Called by server/features/imports/imports.service.ts.
 * Calls: shared/constants/importColumns.ts and shared/types/imports.ts.
 * Used by: bulk CSV import of projects and assets.
 */
import {
  IMPORT_ACQUISITION_VALUE_MAX,
  IMPORT_MAX_ERRORS,
  IMPORT_MAX_ROWS,
} from '@shared/constants/importColumns';
import type { ImportRowError } from '@shared/types/imports';

/** Raw parsed row with 1-based source line number and string values keyed by normalized column header. */
export interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

/** Result of parsing CSV text into normalized rows and structural file errors. */
export interface ParsedCsvDocument {
  headers: string[];
  rows: ParsedCsvRow[];
  fileErrors: ImportRowError[];
}

/**
 * Normalizes a column header: trims whitespace, converts to lowercase, and replaces spaces and hyphens with underscores.
 *
 * @param header the raw header from the CSV
 * @returns normalized canonical form, for example "Project Code" becomes "project_code"
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Splits raw CSV text into rows and cells adhering to RFC 4180.
 * Handles quoted fields, escaped quotes, multiline content, and skips blank lines.
 *
 * @param text raw CSV file contents
 * @returns array of non-blank rows with their starting 1-based line number and cell values
 */
export function tokenizeCsv(text: string): { line: number; cells: string[] }[] {
  let content = text;
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const rows: { line: number; cells: string[] }[] = [];
  let currentCells: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  let rowStartLine = 1;
  let currentLine = 1;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      if (!inQuotes) {
        if (currentField.trim() === '') {
          currentField = '';
        }
        inQuotes = true;
        fieldWasQuoted = true;
      } else if (i + 1 < content.length && content[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      currentCells.push(currentField);
      currentField = '';
      fieldWasQuoted = false;
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && i + 1 < content.length && content[i + 1] === '\n') {
        i++;
      }
      currentCells.push(currentField);
      currentField = '';
      fieldWasQuoted = false;

      const isNonBlank = currentCells.some((c) => c.trim() !== '');
      if (isNonBlank) {
        rows.push({ line: rowStartLine, cells: currentCells });
      }

      currentCells = [];
      currentLine++;
      rowStartLine = currentLine;
    } else {
      if (char === '\n') {
        currentLine++;
      }
      if (!inQuotes && fieldWasQuoted && (char === ' ' || char === '\t')) {
        continue;
      }
      currentField += char;
    }
  }

  currentCells.push(currentField);
  const isLastNonBlank = currentCells.some((c) => c.trim() !== '');
  if (isLastNonBlank) {
    rows.push({ line: rowStartLine, cells: currentCells });
  }

  return rows;
}

/**
 * Parses and validates CSV structure against expected canonical columns.
 *
 * @param csvText raw text of the CSV file
 * @param requiredColumns list of columns that must be present in the header
 * @param allowedColumns complete set of allowed columns for this import type
 * @returns parsed document containing normalized rows and any header/file-level errors
 */
export function parseCsv(
  csvText: string,
  requiredColumns: readonly string[],
  allowedColumns: readonly string[],
): ParsedCsvDocument {
  const tokenized = tokenizeCsv(csvText ?? '');
  const fileErrors: ImportRowError[] = [];

  if (tokenized.length === 0) {
    fileErrors.push({
      row: 1,
      column: null,
      message: 'The file contains no data rows.',
    });
    return { headers: [], rows: [], fileErrors };
  }

  const rawHeaders = tokenized[0].cells;
  const normalizedHeaders: string[] = [];
  const seenHeaders = new Set<string>();

  for (const raw of rawHeaders) {
    const trimmed = raw.trim();
    const normalized = normalizeHeader(trimmed);

    if (seenHeaders.has(normalized)) {
      fileErrors.push({
        row: 1,
        column: trimmed || normalized,
        message: `Duplicate column header: ${trimmed || normalized}.`,
      });
    } else {
      seenHeaders.add(normalized);
    }

    if (normalized && !allowedColumns.includes(normalized)) {
      fileErrors.push({
        row: 1,
        column: trimmed,
        message: `Unknown column: ${trimmed}.`,
      });
    }

    normalizedHeaders.push(normalized);
  }

  for (const required of requiredColumns) {
    if (!seenHeaders.has(required)) {
      fileErrors.push({
        row: 1,
        column: required,
        message: `Missing required column: ${required}.`,
      });
    }
  }

  const dataLines = tokenized.slice(1);
  if (dataLines.length === 0 && fileErrors.length === 0) {
    fileErrors.push({
      row: 1,
      column: null,
      message: 'The file contains no data rows.',
    });
  } else if (dataLines.length > IMPORT_MAX_ROWS) {
    fileErrors.push({
      row: 1,
      column: null,
      message: `The file exceeds the limit of ${IMPORT_MAX_ROWS} rows.`,
    });
  }

  const rows: ParsedCsvRow[] = [];
  for (const item of dataLines) {
    const values: Record<string, string> = {};
    for (let colIdx = 0; colIdx < normalizedHeaders.length; colIdx++) {
      const headerKey = normalizedHeaders[colIdx];
      if (!headerKey) continue;
      const cellVal = item.cells[colIdx] ?? '';
      values[headerKey] = cellVal.trim();
    }
    rows.push({ rowNumber: item.line, values });
  }

  return { headers: normalizedHeaders, rows, fileErrors };
}

/**
 * Checks whether a given year is a leap year.
 *
 * @param year four-digit calendar year
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Parses a date string in either yyyy-mm-dd or m/d/yyyy format into an ISO yyyy-mm-dd string.
 * Validates calendar days, leap years, and realistic year bounds (1900 to 2100).
 *
 * @param value raw date string from CSV
 * @returns normalized yyyy-mm-dd date string, or null if invalid
 */
export function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let year: number;
  let month: number;
  let day: number;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else if (usMatch) {
    month = parseInt(usMatch[1], 10);
    day = parseInt(usMatch[2], 10);
    year = parseInt(usMatch[3], 10);
  } else {
    return null;
  }

  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  const daysPerMonth = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysPerMonth[month]) return null;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Parses a monetary value, stripping currency indicators (PHP, ₱, $), commas, and spaces.
 * Ensures the value is non-negative and does not exceed IMPORT_ACQUISITION_VALUE_MAX.
 *
 * @param value raw currency string from CSV
 * @returns formatted numeric string with two decimals, or null if invalid
 */
export function parseMoney(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let cleaned = trimmed.replace(/^(?:PHP|Php|php|₱|\$)\s*/, '');
  cleaned = cleaned.replace(/,/g, '').trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0 || num > IMPORT_ACQUISITION_VALUE_MAX) {
    return null;
  }

  return num.toFixed(2);
}

/**
 * Caps an error list at 200 items, appending a single "and N more" item if errors exceed the limit.
 *
 * @param errors complete list of collected validation errors
 * @returns capped error array suitable for API responses
 */
export function capErrors(errors: ImportRowError[]): ImportRowError[] {
  if (errors.length <= IMPORT_MAX_ERRORS) {
    return errors;
  }
  const remaining = errors.length - IMPORT_MAX_ERRORS;
  return [
    ...errors.slice(0, IMPORT_MAX_ERRORS),
    {
      row: 0,
      column: null,
      message: `and ${remaining} more`,
    },
  ];
}

