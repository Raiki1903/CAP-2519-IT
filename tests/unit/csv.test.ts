/**
 * CSV reader unit tests: parsing, normalization, dates, money, and error capping.
 * Covers parseCsv, normalizeHeader, parseDate, parseMoney, capErrors (server/features/imports/csv.ts).
 * Layer: unit test. Needs no server or database.
 */
import { describe, expect, it } from 'vitest';
import {
  capErrors,
  normalizeHeader,
  parseCsv,
  parseDate,
  parseMoney,
  tokenizeCsv,
} from '../../server/features/imports/csv';
import {
  PROJECT_IMPORT_COLUMNS,
  PROJECT_IMPORT_REQUIRED_COLUMNS,
} from '../../shared/constants/importColumns';

describe('CSV reader: normalizeHeader', () => {
  it('converts spaced and hyphenated names to lowercase underscored canonical forms', () => {
    expect(normalizeHeader('Project Code')).toBe('project_code');
    expect(normalizeHeader('  Serial Number  ')).toBe('serial_number');
    expect(normalizeHeader('its-property-tag')).toBe('its_property_tag');
    expect(normalizeHeader('FUNDING__SOURCE')).toBe('funding_source');
  });
});

describe('CSV reader: tokenizeCsv and RFC 4180 parsing', () => {
  it('handles quotes, commas inside quotes, escaped quotes, and newlines inside quotes', () => {
    const raw = 'name,notes\n"Monitor 24""", "Simple, comma"\n"Multi\nline",Done';
    const tokenized = tokenizeCsv(raw);

    expect(tokenized).toHaveLength(3);
    expect(tokenized[0].cells).toEqual(['name', 'notes']);
    expect(tokenized[1].cells).toEqual(['Monitor 24"', 'Simple, comma']);
    expect(tokenized[2].cells).toEqual(['Multi\nline', 'Done']);
  });

  it('strips leading UTF-8 Byte Order Mark (BOM)', () => {
    const bomCsv = '\uFEFFlab,name\nCITe4D,Keyboard';
    const tokenized = tokenizeCsv(bomCsv);

    expect(tokenized).toHaveLength(2);
    expect(tokenized[0].cells).toEqual(['lab', 'name']);
  });

  it('skips completely blank rows without shifting line numbers', () => {
    const csv = 'header1,header2\n\nval1,val2\n   ,   \nval3,val4';
    const tokenized = tokenizeCsv(csv);

    expect(tokenized).toHaveLength(3);
    expect(tokenized[0].line).toBe(1);
    expect(tokenized[1].line).toBe(3);
    expect(tokenized[1].cells).toEqual(['val1', 'val2']);
    expect(tokenized[2].line).toBe(5);
    expect(tokenized[2].cells).toEqual(['val3', 'val4']);
  });
});

describe('CSV reader: parseCsv header and file validation', () => {
  it('flags missing required columns and unknown columns', () => {
    const csv = 'project_name,unknown_col\nAlpha,test';
    const doc = parseCsv(csv, PROJECT_IMPORT_REQUIRED_COLUMNS, PROJECT_IMPORT_COLUMNS);

    expect(doc.fileErrors).toEqual(
      expect.arrayContaining([
        { row: 1, column: 'unknown_col', message: 'Unknown column: unknown_col.' },
        { row: 1, column: 'project_code', message: 'Missing required column: project_code.' },
        { row: 1, column: 'project_leader', message: 'Missing required column: project_leader.' },
        { row: 1, column: 'lab', message: 'Missing required column: lab.' },
        { row: 1, column: 'start_date', message: 'Missing required column: start_date.' },
      ]),
    );
  });

  it('flags duplicate column headers', () => {
    const csv = 'project_code,project_code,project_name,project_leader,lab,start_date\nPRJ-1,PRJ-1,Name,Lead,CITe4D,2026-01-01';
    const doc = parseCsv(csv, PROJECT_IMPORT_REQUIRED_COLUMNS, PROJECT_IMPORT_COLUMNS);

    expect(doc.fileErrors).toContainEqual({
      row: 1,
      column: 'project_code',
      message: 'Duplicate column header: project_code.',
    });
  });

  it('flags empty files and files with header only', () => {
    const emptyDoc = parseCsv('', PROJECT_IMPORT_REQUIRED_COLUMNS, PROJECT_IMPORT_COLUMNS);
    expect(emptyDoc.fileErrors).toContainEqual({
      row: 1,
      column: null,
      message: 'The file contains no data rows.',
    });

    const headerOnly = 'project_code,project_name,project_leader,lab,start_date\n';
    const headerDoc = parseCsv(headerOnly, PROJECT_IMPORT_REQUIRED_COLUMNS, PROJECT_IMPORT_COLUMNS);
    expect(headerDoc.fileErrors).toContainEqual({
      row: 1,
      column: null,
      message: 'The file contains no data rows.',
    });
  });

  it('flags files exceeding the 500-row limit', () => {
    const headers = 'project_code,project_name,project_leader,lab,start_date';
    const lines = [headers];
    for (let i = 1; i <= 501; i++) {
      lines.push(`PRJ-${i},Project ${i},Leader,CITe4D,2026-01-01`);
    }
    const doc = parseCsv(lines.join('\n'), PROJECT_IMPORT_REQUIRED_COLUMNS, PROJECT_IMPORT_COLUMNS);

    expect(doc.fileErrors).toContainEqual({
      row: 1,
      column: null,
      message: 'The file exceeds the limit of 500 rows.',
    });
  });
});

describe('CSV reader: parseDate', () => {
  it('parses valid ISO yyyy-mm-dd dates', () => {
    expect(parseDate('2026-11-17')).toBe('2026-11-17');
    expect(parseDate('2024-02-29')).toBe('2024-02-29'); // Leap year
  });

  it('parses valid US m/d/yyyy dates into ISO yyyy-mm-dd', () => {
    expect(parseDate('11/17/2026')).toBe('2026-11-17');
    expect(parseDate('5/9/2026')).toBe('2026-05-09');
    expect(parseDate('2/29/2024')).toBe('2024-02-29');
  });

  it('rejects invalid calendar dates and out-of-range values', () => {
    expect(parseDate('2023-02-29')).toBeNull(); // 2023 is not a leap year
    expect(parseDate('2026-13-01')).toBeNull(); // Month 13
    expect(parseDate('2026-04-31')).toBeNull(); // April has 30 days
    expect(parseDate('not-a-date')).toBeNull();
    expect(parseDate('1899-12-31')).toBeNull(); // Below 1900
    expect(parseDate('2101-01-01')).toBeNull(); // Above 2100
  });
});

describe('CSV reader: parseMoney', () => {
  it('parses numbers and formats them with two decimals', () => {
    expect(parseMoney('1234.5')).toBe('1234.50');
    expect(parseMoney('500')).toBe('500.00');
    expect(parseMoney('0')).toBe('0.00');
  });

  it('strips currency symbols and commas', () => {
    expect(parseMoney('PHP 1,234,567.89')).toBe('1234567.89');
    expect(parseMoney('₱ 50,000.00')).toBe('50000.00');
    expect(parseMoney('$99.95')).toBe('99.95');
  });

  it('rejects negative numbers, excessive decimals, and out-of-bounds amounts', () => {
    expect(parseMoney('-50')).toBeNull();
    expect(parseMoney('10.999')).toBeNull();
    expect(parseMoney('100000000.00')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
});

describe('CSV reader: capErrors', () => {
  it('leaves error lists of up to 200 items unchanged', () => {
    const list = Array.from({ length: 150 }, (_, i) => ({
      row: i + 2,
      column: 'test',
      message: `Error ${i}`,
    }));
    expect(capErrors(list)).toEqual(list);
  });

  it('caps error lists exceeding 200 items and appends "and N more"', () => {
    const list = Array.from({ length: 245 }, (_, i) => ({
      row: i + 2,
      column: 'test',
      message: `Error ${i}`,
    }));
    const capped = capErrors(list);

    expect(capped).toHaveLength(201);
    expect(capped[200]).toEqual({
      row: 0,
      column: null,
      message: 'and 45 more',
    });
  });
});

