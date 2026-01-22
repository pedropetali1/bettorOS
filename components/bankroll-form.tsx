"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { createBankroll } from "@/app/actions/bankroll-actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  BankrollFormValues,
  bankrollSchema,
} from "@/lib/validations/bankroll";

const currencies = ["BRL", "USD", "EUR"];

export function BankrollForm() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BankrollFormValues>({
    resolver: zodResolver(bankrollSchema),
    defaultValues: {
      bookmakerName: "",
      currency: "BRL",
      initialBalance: 0,
    },
  });
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "bankroll-form",
      hypothesisId: "A",
      location: "components/bankroll-form.tsx:45",
      message: "Form initialized",
      data: {
        initialBalanceDefault: form.getValues("initialBalance"),
        initialBalanceType: typeof form.getValues("initialBalance"),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  const onSubmit = async (values: BankrollFormValues) => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "bankroll-form",
        hypothesisId: "B",
        location: "components/bankroll-form.tsx:57",
        message: "Submit values",
        data: {
          initialBalance: values.initialBalance,
          initialBalanceType: typeof values.initialBalance,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    setIsSubmitting(true);
    setFeedback(null);
    const result = await createBankroll(values);
    setIsSubmitting(false);
    setFeedback(result.message);

    if (result.ok) {
      form.reset({ bookmakerName: "", currency: "BRL", initialBalance: 0 });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="bookmakerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bookmaker Name</FormLabel>
              <FormControl>
                <Input placeholder="Bet365" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="initialBalance"
            render={({ field }) => {
              // #region agent log
              fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId: "debug-session",
                  runId: "bankroll-form",
                  hypothesisId: "C",
                  location: "components/bankroll-form.tsx:108",
                  message: "Render initialBalance field",
                  data: {
                    value: field.value,
                    valueType: typeof field.value,
                    name: field.name,
                  },
                  timestamp: Date.now(),
                }),
              }).catch(() => {});
              // #endregion agent log
              const { value, ...fieldProps } = field;
              const safeValue =
                typeof value === "number" || typeof value === "string" ? value : "";
              return (
              <FormItem>
                <FormLabel>Initial Balance</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...fieldProps}
                    value={safeValue}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              );
            }}
          />
        </div>

        {feedback ? (
          <p className="text-sm text-muted-foreground">{feedback}</p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Create Bankroll"}
        </Button>
      </form>
    </Form>
  );
}
