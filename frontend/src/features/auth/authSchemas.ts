import { z } from "zod";

// bcrypt only uses the first 72 bytes of a password, and a non-Latin character takes up to 4 of them.
const BCRYPT_MAX_BYTES = 72;

const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email")
  .pipe(z.email("Enter a valid email address").max(255, "That email address is too long"));

const newPasswordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((value) => new TextEncoder().encode(value).length <= BCRYPT_MAX_BYTES, "That password is too long");

const confirmPasswordField = z.string().min(1, "Type your password again");

function passwordsMatch(values: { password: string; confirmPassword: string }) {
  return values.password === values.confirmPassword;
}

const passwordsMustMatch = {
  message: "The passwords don't match",
  path: ["confirmPassword"],
};

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(100, "Use at most 100 characters"),
    email: emailField,
    password: newPasswordField,
    confirmPassword: confirmPasswordField,
  })
  .refine(passwordsMatch, passwordsMustMatch);

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: confirmPasswordField,
  })
  .refine(passwordsMatch, passwordsMustMatch);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: newPasswordField,
    confirmPassword: confirmPasswordField,
  })
  .refine(passwordsMatch, passwordsMustMatch);

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Use at most 100 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
