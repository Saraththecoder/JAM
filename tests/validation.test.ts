import { describe, expect, it } from 'vitest';
import {
  createUserSchema,
  facultyEmailSchema,
  letterCreateSchema,
  rollNumberSchema,
} from '../lib/validation';

describe('validation schemas', () => {
  it('accepts a valid AITS roll number and uppercases it', () => {
    const result = rollNumberSchema.safeParse('24ak1a33d8');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('24AK1A33D8');
  });

  it('rejects an invalid roll number', () => {
    expect(rollNumberSchema.safeParse('24AK1A33').success).toBe(false);
  });

  it('accepts only AITS faculty email addresses', () => {
    expect(facultyEmailSchema.safeParse('Ramesh.K@AITS-TPT.EDU.IN').success).toBe(true);
    expect(facultyEmailSchema.safeParse('ramesh@gmail.com').success).toBe(false);
  });

  it('requires a non-empty letter body and a valid UUID', () => {
    const base = {
      letterTypeId: 'cf2f5209-ef33-4f27-a169-be5a7536d7a4',
      mentorId: 'b717b9b1-ec5b-4375-9614-41d996919245',
      formData: { reason: 'Medical appointment' },
      generatedBody: 'I request leave for one day.',
    };

    expect(letterCreateSchema.safeParse(base).success).toBe(true);
    expect(letterCreateSchema.safeParse({ ...base, generatedBody: '   ' }).success).toBe(false);
    expect(letterCreateSchema.safeParse({ ...base, mentorId: 'not-a-uuid' }).success).toBe(false);
  });

  it('allows an explicit HOD flag only as a boolean', () => {
    const faculty = {
      role: 'faculty',
      full_name: 'Dr. S. Rao',
      email: 's.rao@aits-tpt.edu.in',
      password: 'long-enough-password',
      designation: 'HOD',
      is_hod: true,
    };

    expect(createUserSchema.safeParse(faculty).success).toBe(true);
    expect(createUserSchema.safeParse({ ...faculty, is_hod: 'yes' }).success).toBe(false);
  });
});
