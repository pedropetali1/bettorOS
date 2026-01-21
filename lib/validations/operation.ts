import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const legSchema = z.object({
  selection: z.string().min(2, "Selection is required."),
  odds: z.coerce.number().gt(1, "Odds must be greater than 1.0."),
  stake: z.coerce.number().positive("Stake must be greater than zero."),
  eventDate: z.coerce.date(),
  sport: optionalTrimmed,
  league: optionalTrimmed,
  bankrollId: z.string().min(1, "Select a bankroll for each leg."),
});

const baseOperation = z.object({
  description: optionalTrimmed,
});

const simpleOperation = baseOperation.extend({
  type: z.literal("SIMPLE"),
  legs: z.array(legSchema).length(1),
});

const multiLegOperation = baseOperation.extend({
  type: z.literal("ARBITRAGE"),
  legs: z
    .array(legSchema)
    .min(2, "A multi-leg operation requires at least two legs."),
});

const arbitraryOperation = baseOperation.extend({
  type: z.literal("MATCHED"),
  legs: z.array(legSchema).min(1),
  expectedReturnOverride: z
    .coerce.number()
    .positive("Expected return must be greater than zero.")
    .optional(),
});

export const operationSchema = z.discriminatedUnion("type", [
  simpleOperation,
  multiLegOperation,
  arbitraryOperation,
]);

export type OperationFormValues = z.input<typeof operationSchema>;
