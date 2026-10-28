import { describe, expect, it } from 'vitest';
import { generateLetterPdf, referenceNumberFor, type LetterPdfData } from '../lib/pdf-letter';

const letter: LetterPdfData = {
  id: 'cf2f5209-ef33-4f27-a169-be5a7536d7a4',
  created_at: '2026-10-28T10:00:00.000Z',
  generated_body:
    'I, Rahul Reddy (24AK1A33D8), request leave for one day due to a medical appointment. I will catch up on missed coursework.',
  status: 'approved',
  mentor_id: 'b717b9b1-ec5b-4375-9614-41d996919245',
  hod_id: null,
  mentor_signed_at: '2026-10-28T10:05:00.000Z',
  hod_signed_at: null,
  letter_types: { name: 'Leave Letter' },
  student: {
    full_name: 'Rahul Reddy',
    roll_number: '24AK1A33D8',
    departments: { name: 'AI&ML' },
  },
  mentor: {
    full_name: 'Dr. K. Ramesh',
    designation: 'Class Mentor',
    esign_storage_path: null,
  },
  hod: null,
};

describe('PDF letter generation', () => {
  it('builds a stable reference number from the department, year, and id', () => {
    expect(referenceNumberFor(letter)).toBe('AITS/AIML/2026/CF2F5209EF33');
  });

  it('generates a PDF and a lowercase SHA-256 hash', async () => {
    const result = await generateLetterPdf(letter, { origin: 'https://letters.example.test' });

    expect(Buffer.from(result.bytes).subarray(0, 4).toString()).toBe('%PDF');
    expect(result.bytes.length).toBeGreaterThan(1000);
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.referenceNumber).toBe('AITS/AIML/2026/CF2F5209EF33');
  });
});
