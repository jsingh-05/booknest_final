import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  genre: z.string().optional(),
  isPublic: z.boolean().optional()
});

export const inviteSchema = z.object({
  email: z.string().email().optional(),
  expiresInHours: z.number().int().positive().optional()
});

export const acceptInviteSchema = z.object({
  token: z.string().min(8)
});

export const themeSchema = z.object({
  theme: z.string().min(1),
  duration: z.union([z.literal('week'), z.literal('month'), z.string().regex(/^\d+$/)]).optional()
});
