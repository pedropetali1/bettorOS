import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const baseLeg = z.object({
  matchName: z.string().min(2, "Match name is required."),
  selection: z.string().min(2, "Selection is required."),
  eventDate: z.coerce.date(),
  sport: optionalTrimmed,
  league: optionalTrimmed,
  bankrollId: z.string().min(1, "Select a bankroll for each leg."),
});

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().gt(1, "Odds must be greater than 1.0.")
);

const legSchema = baseLeg.extend({
  odds: z.coerce.number().gt(1, "Odds must be greater than 1.0."),
  stake: z.coerce.number().positive("Stake must be greater than zero."),
});

const matchedLegSchema = baseLeg.extend({
  odds: optionalNumber.optional(),
  stake: z.coerce.number().min(0, "Stake must be zero or greater."),
});

const baseOperation = z.object({
  description: optionalTrimmed,
  matchedOdds: optionalNumber.optional(),
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

const arbitraryOperation = baseOperation
  .extend({
    type: z.literal("MATCHED"),
    legs: z.array(matchedLegSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const hasMatchedOdds = Boolean(value.matchedOdds);

    if (!value.legs.some((leg) => leg.stake > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a stake for at least one leg.",
        path: ["legs", 0, "stake"],
      });
    }

    value.legs.forEach((leg, index) => {
      if (!hasMatchedOdds && (!leg.odds || leg.odds <= 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Odds are required unless using multiple odds.",
          path: ["legs", index, "odds"],
        });
      }
    });
  });

export const operationSchema = z.discriminatedUnion("type", [
  simpleOperation,
  multiLegOperation,
  arbitraryOperation,
]);

export type OperationFormValues = z.input<typeof operationSchema>;
