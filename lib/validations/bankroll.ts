import { z } from "zod";

export const bankrollSchema = z.object({
  bookmakerName: z.string().min(2, "Bookmaker name is required."),
  currency: z.string().min(2, "Currency is required."),
  initialBalance: z.coerce.number().min(0, "Balance must be zero or greater."),
});

export type BankrollFormValues = z.input<typeof bankrollSchema>;
