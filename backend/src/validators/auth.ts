import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter')
    .refine((p) => /[a-z]/.test(p), 'Password must contain at least one lowercase letter')
    .refine((p) => /[0-9]/.test(p), 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8)
    .max(128)
    .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter')
    .refine((p) => /[a-z]/.test(p), 'Password must contain at least one lowercase letter')
    .refine((p) => /[0-9]/.test(p), 'Password must contain at least one number'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
