import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export type RegisterInput = z.input<typeof registerSchema>;
