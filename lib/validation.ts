import { z } from 'zod';

export const uuidSchema = z.string().uuid('A valid UUID is required.');

export const letterCreateSchema = z.object({
  letterTypeId: uuidSchema,
  mentorId: uuidSchema,
  formData: z
    .record(z.string(), z.string().max(2000))
    .refine((value) => Object.keys(value).length <= 20, 'Too many form fields.')
    .default({}),
  generatedBody: z
    .string()
    .trim()
    .min(1, 'Letter body cannot be empty.')
    .max(8000, 'Letter body is too long.'),
});

export const letterForwardSchema = z.object({
  letterId: uuidSchema,
});

export const letterRejectSchema = z.object({
  letterId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'Please provide a rejection reason.')
    .max(1000, 'Rejection reason is too long.'),
});

export const approveLetterSchema = z.object({
  letterId: uuidSchema,
});

export const notifySchema = z.object({
  letterId: uuidSchema,
  type: z.enum(['new_request', 'mentor_approved', 'approval', 'rejection']),
  rejectionReason: z.string().trim().max(1000).optional(),
});

export const aiGenerationSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, 'Please describe the letter in at least 10 characters.')
    .max(1500, 'Description is too long.'),
  tone: z.enum(['formal', 'casual']),
  openRouterKey: z
    .string()
    .trim()
    .min(20, 'A valid OpenRouter API key is required.')
    .max(200, 'OpenRouter API key is too long.')
    .regex(/^sk-or-v1-[A-Za-z0-9_-]+$/, 'Invalid OpenRouter API key format.'),
});

export const signatureUploadSchema = z.object({
  userId: uuidSchema,
  fileBase64: z.string().min(20, 'Signature image is required.').max(3_000_000, 'Signature image is too large.'),
  fileType: z.enum(['image/png', 'image/jpeg']),
});

export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2000),
    keys: z.object({
      p256dh: z.string().min(20).max(500),
      auth: z.string().min(10).max(200),
    }),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

export const createUserSchema = z.object({
  role: z.enum(['student', 'faculty']),
  full_name: z.string().trim().min(2).max(120),
  roll_number: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(200).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password is too long.'),
  designation: z.string().trim().max(80).optional(),
  is_hod: z.boolean().optional(),
});

export const bulkCreateUsersSchema = z.object({
  users: z.array(createUserSchema).min(1).max(100),
});

export const deleteUserSchema = z.object({
  userId: uuidSchema,
});

export const rollNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{2}[0-9][A-Z][0-9]{2}[A-Z0-9]{2}$/, 'Invalid roll number format.');

export const facultyEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .refine((value) => value.endsWith('@aits-tpt.edu.in'), 'Faculty email must use the @aits-tpt.edu.in domain.');

export type LetterCreateInput = z.infer<typeof letterCreateSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type NotifyInput = z.infer<typeof notifySchema>;
export type AiGenerationInput = z.infer<typeof aiGenerationSchema>;
export type SignatureUploadInput = z.infer<typeof signatureUploadSchema>;
