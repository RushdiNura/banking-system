import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[@$!%*?&#]/, "Password must contain a special character");

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name is too long")
      .regex(/^[a-zA-Z\s'-]+$/, "Invalid characters in first name"),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name is too long")
      .regex(/^[a-zA-Z\s'-]+$/, "Invalid characters in last name"),
    email: z.string().email("Invalid email address"),
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 digits")
      .regex(/^\+?[\d\s-]{10,15}$/, "Invalid phone number format"),
    password: passwordSchema,
    confirmPassword: z.string(),
    terms: z.boolean().refine((v) => v === true, "You must accept the terms"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Source account is required"),
  toAccountNumber: z
    .string()
    .length(10, "Account number must be 10 digits")
    .regex(/^\d+$/, "Account number must contain only digits"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than 0")
    .max(1000000, "Amount exceeds maximum limit"),
  description: z.string().max(500, "Description is too long").optional(),
  saveBeneficiary: z.boolean().optional(),
});

export const createAccountSchema = z.object({
  accountType: z.enum([
    "savings",
    "checking",
    "fixed_deposit",
    "recurring_deposit",
  ]),
  currency: z.enum(["USD", "EUR", "GBP", "JPY", "INR"]).default("USD"),
  initialDeposit: z.number().min(0, "Initial deposit cannot be negative"),
});

export const loanApplicationSchema = z.object({
  loanType: z.enum([
    "personal",
    "home",
    "auto",
    "education",
    "business",
    "gold",
  ]),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than 0"),
  termMonths: z
    .number()
    .int()
    .min(3, "Minimum 3 months")
    .max(360, "Maximum 360 months"),
  purpose: z.string().max(500).optional(),
  accountId: z.string().min(1, "Account is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
