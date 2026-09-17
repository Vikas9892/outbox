export interface CsvParseResult {
  totalRows: number;
  validEmails: string[];
  invalidEmails: string[];
  duplicateCount: number;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Parses raw CSV or text content, extracting valid RFC email addresses,
 * removing duplicates, and reporting invalid lines.
 */
export const parseAndValidateCsvLeads = (csvContent: string): CsvParseResult => {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const validEmails: string[] = [];
  const invalidEmails: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const line of lines) {
    // Split by comma, tab, or semicolon
    const tokens = line.split(/[,;\t]/).map((t) => t.trim().replace(/^["']|["']$/g, ''));

    for (const token of tokens) {
      if (!token) continue;

      const lower = token.toLowerCase();
      // Skip header words
      if (lower === 'email' || lower === 'recipient' || lower === 'leads' || lower === 'email address') {
        continue;
      }

      if (EMAIL_REGEX.test(token)) {
        if (seen.has(lower)) {
          duplicateCount++;
        } else {
          seen.add(lower);
          validEmails.push(lower);
        }
      } else if (token.includes('@') || token.length > 3) {
        // Only count as invalid if it resembles an email or entry rather than stray formatting
        if (!invalidEmails.includes(token)) {
          invalidEmails.push(token);
        }
      }
    }
  }

  return {
    totalRows: lines.length,
    validEmails,
    invalidEmails,
    duplicateCount,
  };
};

export default parseAndValidateCsvLeads;
