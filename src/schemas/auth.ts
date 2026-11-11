import { z } from "zod";

/** Schemas compartilhados entre formulário (cliente) e servidor. */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail muito longo.")
  .pipe(z.email("Esse e-mail não parece válido."))
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(128, "Use no máximo 128 caracteres.");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Como podemos te chamar?")
  .max(60, "Use no máximo 60 caracteres.");

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const requestResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
