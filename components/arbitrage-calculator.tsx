"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { OperationType } from "@prisma/client";

import { createOperation } from "@/app/actions/operation-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BankrollOption = {
  id: string;
  bookmakerName: string;
  currency: string;
  currentBalance: string;
};

type ArbitrageLeg = {
  matchName: string;
  selection: string;
  odds: string;
  stake: string;
  eventDate: string;
  sport?: string;
  league?: string;
  bankrollId: string;
};

type ArbitrageFormValues = {
  totalStake: string;
  description: string;
  legs: ArbitrageLeg[];
};

const createLeg = (bankrollId: string) => ({
  matchName: "",
  selection: "",
  odds: "2.00",
  stake: "",
  eventDate: new Date().toISOString().slice(0, 10),
  sport: "",
  league: "",
  bankrollId,
});

export function ArbitrageCalculator({ bankrolls }: { bankrolls: BankrollOption[] }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (bankrolls.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Arbitrage Calculator</CardTitle>
          <CardDescription>Add a bankroll before creating surebets.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Create at least one bankroll to calculate and submit surebet operations.
        </CardContent>
      </Card>
    );
  }

  const defaultBankrollId = bankrolls[0]?.id ?? "";
  const secondaryBankrollId = bankrolls[1]?.id ?? defaultBankrollId;

  const form = useForm<ArbitrageFormValues>({
    defaultValues: {
      totalStake: "100",
      description: "",
      legs: [createLeg(defaultBankrollId), createLeg(secondaryBankrollId)],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "legs",
  });

  const values = form.watch();
  const totalStake = Number(values.totalStake);
  const odds = values.legs.map((leg) => Number(leg.odds));

  const calculation = useMemo(() => {
    if (!Number.isFinite(totalStake) || totalStake <= 0) {
      return null;
    }

    if (odds.length < 2 || odds.some((odd) => !Number.isFinite(odd) || odd <= 1)) {
      return null;
    }

    const impliedSum = odds.reduce((sum, odd) => sum + 1 / odd, 0);
    if (impliedSum <= 0) {
      return null;
    }

    const payout = totalStake / impliedSum;
    const stakes = odds.map((odd) => payout / odd);
    const profit = payout - totalStake;
    const roi = profit / totalStake;

    return {
      impliedSum,
      payout,
      profit,
      roi,
      stakes,
    };
  }, [odds, totalStake]);

  const applyStakes = () => {
    if (!calculation) {
      setFeedback("Enter valid odds and total stake to calculate.");
      return;
    }
    calculation.stakes.forEach((stake, index) => {
      form.setValue(`legs.${index}.stake`, stake.toFixed(2));
    });
    setFeedback("Calculated stakes were applied.");
  };

  const onSubmit = async (values: ArbitrageFormValues) => {
    setIsSubmitting(true);
    setFeedback(null);

    const totalStakeNumber = Number(values.totalStake);
    if (!Number.isFinite(totalStakeNumber) || totalStakeNumber <= 0) {
      setIsSubmitting(false);
      setFeedback("Total stake must be greater than zero.");
      return;
    }
    const currentOdds = values.legs.map((leg) => Number(leg.odds));
    const impliedSum = currentOdds.reduce((sum, odd) => sum + 1 / odd, 0);
    const hasArb = impliedSum > 0 && impliedSum < 1;

    if (!hasArb) {
      setIsSubmitting(false);
      setFeedback("These odds do not create an arbitrage opportunity.");
      return;
    }

    const payout = totalStakeNumber / impliedSum;
    const stakes = currentOdds.map((odd) => payout / odd);

    const result = await createOperation({
      type: OperationType.ARBITRAGE,
      description: values.description || undefined,
      legs: values.legs.map((leg, index) => ({
        matchName: leg.matchName,
        selection: leg.selection,
        odds: leg.odds,
        stake: stakes[index]?.toFixed(2) ?? leg.stake,
        eventDate: leg.eventDate,
        sport: leg.sport,
        league: leg.league,
        bankrollId: leg.bankrollId,
      })),
    });

    setIsSubmitting(false);
    setFeedback(result.message);

    if (result.ok) {
      form.reset({
        totalStake: "100",
        description: "",
        legs: [createLeg(defaultBankrollId), createLeg(secondaryBankrollId)],
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arbitrage Calculator</CardTitle>
        <CardDescription>
          Calculate surebet stakes across multiple accounts and submit as an operation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-muted-foreground">
            Total Stake (split)
            <Input type="number" step="0.01" min="0" {...form.register("totalStake")} />
          </label>
          <label className="space-y-1 text-sm text-muted-foreground">
            Notes (optional)
            <Input placeholder="Surebet across books" {...form.register("description")} />
          </label>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Leg {index + 1}</p>
                {fields.length > 2 && (
                  <Button variant="ghost" size="sm" type="button" onClick={() => remove(index)}>
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-muted-foreground">
                  Match
                  <Input
                    placeholder="Team A vs Team B"
                    {...form.register(`legs.${index}.matchName`)}
                  />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground">
                  Selection
                  <Input placeholder="Team A" {...form.register(`legs.${index}.selection`)} />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground">
                  Bankroll
                  <Select
                    onValueChange={(value) => form.setValue(`legs.${index}.bankrollId`, value)}
                    value={form.watch(`legs.${index}.bankrollId`)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select bankroll" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankrolls.map((bankroll) => (
                        <SelectItem key={bankroll.id} value={bankroll.id}>
                          {bankroll.bookmakerName} ({bankroll.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm text-muted-foreground">
                  Odds
                  <Input
                    type="number"
                    step="0.01"
                    min="1.01"
                    {...form.register(`legs.${index}.odds`)}
                  />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground">
                  Stake
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register(`legs.${index}.stake`)}
                  />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground">
                  Event Date
                  <Input type="date" {...form.register(`legs.${index}.eventDate`)} />
                </label>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-muted-foreground">
                  Sport
                  <Input placeholder="Soccer" {...form.register(`legs.${index}.sport`)} />
                </label>
                <label className="space-y-1 text-sm text-muted-foreground">
                  League
                  <Input placeholder="Premier League" {...form.register(`legs.${index}.league`)} />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => append(createLeg(defaultBankrollId))}
          >
            Add leg
          </Button>
          <Button type="button" variant="secondary" onClick={applyStakes}>
            Calculate stakes
          </Button>
        </div>

        {calculation ? (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p>Implied total: {(calculation.impliedSum * 100).toFixed(2)}%</p>
            <p>
              Expected payout: {calculation.payout.toFixed(2)} • Profit: {calculation.profit.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              ROI: {(calculation.roi * 100).toFixed(2)}%
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Enter at least two odds greater than 1.0 and a total stake to compute the surebet.
          </p>
        )}

        {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}

        <Button type="button" disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)}>
          {isSubmitting ? "Submitting..." : "Create Surebet Operation"}
        </Button>
      </CardContent>
    </Card>
  );
}
