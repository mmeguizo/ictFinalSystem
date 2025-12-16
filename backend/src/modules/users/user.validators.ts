import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(120).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['ADMIN', 'DEVELOPER', 'OFFICE_HEAD', 'USER']).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  confirmPassword: z.string().min(8, 'Confirm Password must be at least 8 characters').optional(),  
  avatarDataUrl: z.string().optional(),
});

export const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const setUserRoleSchema = z.object({
  id: z.number().int().positive(),
  role: z.enum(['ADMIN', 'DEVELOPER', 'OFFICE_HEAD', 'USER']),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
