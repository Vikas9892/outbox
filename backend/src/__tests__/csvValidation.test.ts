import { describe, it, expect } from 'vitest';
import { parseAndValidateCsvLeads } from '../utils/csvParser';

describe('CSV Parser and Lead Validation', () => {
  it('should extract valid emails, reject invalid formats, and detect duplicates', () => {
    const csvData = `
email,name,company
alice@example.com,Alice,Acme Corp
bob@domain.co.uk,Bob,Tech LLC
not-an-email,Invalid Guy,Nowhere
alice@example.com,Alice Duplicate,Acme Corp
charlie@leads.ai,Charlie,AI Labs
bad@domain@double.com,Bad Format,Test
    `;

    const result = parseAndValidateCsvLeads(csvData);

    expect(result.validEmails).toEqual([
      'alice@example.com',
      'bob@domain.co.uk',
      'charlie@leads.ai',
    ]);
    expect(result.duplicateCount).toBe(1);
    expect(result.invalidEmails.length).toBeGreaterThanOrEqual(2);
    expect(result.invalidEmails).toContain('not-an-email');
  });

  it('should handle comma-separated single line leads', () => {
    const rawText = 'john@work.com, sarah@startup.io, john@work.com';
    const result = parseAndValidateCsvLeads(rawText);

    expect(result.validEmails).toEqual(['john@work.com', 'sarah@startup.io']);
    expect(result.duplicateCount).toBe(1);
  });
});
