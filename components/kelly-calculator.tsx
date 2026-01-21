"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type KellyFormValues = {
  probability: string;
  odds: string;
  bankroll: string;
  maxRisk: string;
};

export function KellyCalculator() {
  const { register, watch } = useForm<KellyFormValues>({
    defaultValues: {
      probability: "55",
      odds: "1.92",
      bankroll: "1000",
      maxRisk: "5",
    },
  });

  const values = watch();
  const probability = Number(values.probability) / 100;
  const odds = Number(values.odds);
  const bankroll = Number(values.bankroll);
  const maxRisk = Number(values.maxRisk);

  const result = useMemo(() => {
    if (!probability || !odds || !bankroll) {
      return null;
    }

    const b = odds - 1;
    const q = 1 - probability;
    const rawKelly = (b * probability - q) / b;
    const fraction = Math.max(0, Math.min(rawKelly, 1));
    const suggested = fraction * bankroll;
    const capped = Math.min(suggested, (maxRisk / 100) * bankroll);

    return {
      probability: (probability * 100).toFixed(2),
      odds: odds.toFixed(2),
      fraction: (fraction * 100).toFixed(2),
      suggested: suggested.toFixed(2),
      capped: capped.toFixed(2),
    };
  }, [probability, odds, bankroll, maxRisk]);

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>Kelly Criterion</CardTitle>
        <CardDescription>
          Calculate optimal stake size for a given edge while capping risk per trade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-muted-foreground">
            Probability (%)
            <Input type="number" {...register("probability")} min="0" max="100" />
          </label>
          <label className="space-y-1 text-sm text-muted-foreground">
            Decimal Odds
            <Input type="number" step="0.01" {...register("odds")} min="1.01" />
          </label>
          <label className="space-y-1 text-sm text-muted-foreground">
            Bankroll
            <Input type="number" step="0.01" {...register("bankroll")} min="0" />
          </label>
          <label className="space-y-1 text-sm text-muted-foreground">
            Max Risk (%)
            <Input type="number" step="0.1" {...register("maxRisk")} min="0" max="100" />
          </label>
        </div>
        {result ? (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p>Edge: {((odds - 1) * probability - (1 - probability)).toFixed(2)}</p>
            <p className="mt-2">
              Recommended fraction: {result.fraction}% → Stake {result.suggested}
            </p>
            <p className="text-xs text-muted-foreground">
              Capped at {maxRisk}% risk: {result.capped}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Fill all fields to calculate your Kelly position.
          </p>
        )}
        <Button variant="secondary">Copy to Draft</Button>
      </CardContent>
    </Card>
  );
}
