import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Fix markdown tables that are malformed.
 * 
 * Main issues:
 * 1. Separator row has wrong number of columns: "|---|---|" but header has 4 cols
 * 2. Multiple table rows crammed on one line during streaming
 * 3. Missing separator row entirely
 * 4. Missing blank line before table
 */
export function fixMarkdownTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect crammed rows: multiple table rows on one line
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && (trimmed.match(/\|/g) || []).length > 8) {
      const split = splitCrammedRows(trimmed);
      if (split.length > 1) {
        // Ensure blank line before table if needed
        const prev = result[result.length - 1]?.trim() ?? '';
        if (prev && !prev.startsWith('|')) result.push('');
        result.push(...split);
        continue;
      }
    }

    result.push(lines[i]);
  }

  // Second pass: fix separator rows to match header column count
  const fixed: string[] = [];
  for (let i = 0; i < result.length; i++) {
    const line = result[i].trim();
    const nextLine = result[i + 1]?.trim() ?? '';
    const prevLine = fixed[fixed.length - 1]?.trim() ?? '';

    // Case 1: Current line is header, next is separator with wrong col count → fix it
    if (isTableRow(line) && isSeparatorRow(nextLine)) {
      const headerCols = countColumns(line);
      const sepCols = countColumns(nextLine);
      fixed.push(result[i]);
      if (headerCols !== sepCols) {
        // Replace separator with correct column count
        fixed.push('|' + Array(headerCols).fill('---').join('|') + '|');
        i++; // skip original separator
      }
      continue;
    }

    // Case 2: Current line is header, next is data row (no separator) → inject
    // Only if previous line is NOT part of a table (not a row and not a separator)
    if (
      isTableRow(line) &&
      isTableRow(nextLine) &&
      !isSeparatorRow(nextLine) &&
      !isTableRow(prevLine) &&
      !isSeparatorRow(prevLine) &&
      !isSeparatorRow(line)
    ) {
      fixed.push(result[i]);
      const headerCols = countColumns(line);
      fixed.push('|' + Array(headerCols).fill('---').join('|') + '|');
      continue;
    }

    // Case 3: Current line is separator but previous is not a table row → remove orphan
    if (isSeparatorRow(line) && !isTableRow(prevLine)) {
      continue;
    }

    // Case 4: Data row has fewer columns than header → pad with empty cells
    if (isTableRow(line) && !isSeparatorRow(line) && isTableRow(prevLine)) {
      // Find the header (walk back past separator and other data rows)
      let headerIdx = fixed.length - 1;
      while (headerIdx >= 0 && (isTableRow(fixed[headerIdx].trim()) || isSeparatorRow(fixed[headerIdx].trim()))) {
        headerIdx--;
      }
      headerIdx++; // first table row = header
      if (headerIdx >= 0 && headerIdx < fixed.length) {
        const headerCols = countColumns(fixed[headerIdx].trim());
        const dataCols = countColumns(line);
        if (dataCols < headerCols) {
          const padded = line.replace(/\|$/, '') + Array(headerCols - dataCols).fill(' |').join('') ;
          fixed.push(padded);
          continue;
        }
      }
    }

    fixed.push(result[i]);
  }

  // Third pass: ensure blank line before table starts
  const final: string[] = [];
  for (let i = 0; i < fixed.length; i++) {
    const line = fixed[i].trim();
    const prev = final[final.length - 1]?.trim() ?? '';
    if (isTableRow(line) && prev && !prev.startsWith('|') && !isSeparatorRow(prev) && prev !== '') {
      final.push('');
    }
    final.push(fixed[i]);
  }

  return final.join('\n');
}

/** Split "| a | b | | c | d | | e | f |" into separate rows */
function splitCrammedRows(line: string): string[] {
  // Strategy: split by "| |" which is the boundary between rows
  const parts = line.split(/\|\s*\|/);
  if (parts.length <= 2) return [line]; // normal single row has 2 empty parts at edges

  const rows: string[] = [];
  let current = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part === '' && current) {
      // End of a row
      rows.push('| ' + current + ' |');
      current = '';
    } else if (part) {
      current = current ? current + ' | ' + part : part;
    }
  }
  if (current) rows.push('| ' + current + ' |');

  return rows.length > 1 ? rows : [line];
}

function isTableRow(line: string): boolean {
  if (!line) return false;
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.length > 2 && !isSeparatorRow(t);
}

function isSeparatorRow(line: string): boolean {
  if (!line) return false;
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function countColumns(row: string): number {
  const cells = row.split('|').slice(1, -1); // remove first/last empty from split
  return Math.max(cells.length, 1);
}
