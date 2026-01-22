"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OperationType } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { createOperation } from "@/app/actions/operation-actions";
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
  OperationFormValues,
  operationSchema,
} from "@/lib/validations/operation";

type BankrollOption = {
  id: string;
  bookmakerName: string;
  currency: string;
  currentBalance: string;
};

type OperationFormProps = {
  bankrolls: BankrollOption[];
};

const typeOptions = [
  {
    type: OperationType.SIMPLE,
    label: "Simple",
    description: "Single bet, single bankroll.",
  },
  {
    type: OperationType.ARBITRAGE,
    label: "Multi-leg",
    description: "Multiple legs across bankrolls (surebet).",
  },
  {
    type: OperationType.MATCHED,
    label: "Arbitrary",
    description: "Custom total with expected return override.",
  },
];

const createLeg = (bankrollId: string) => ({
  selection: "",
  odds: 1.9,
  stake: 0,
  eventDate: new Date().toISOString().slice(0, 10),
  sport: "",
  league: "",
  bankrollId,
});

export function OperationForm({ bankrolls }: OperationFormProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (bankrolls.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        You need at least one bankroll before creating an operation.{" "}
        <Link href="/bankrolls/new" className="text-primary underline">
          Add a bankroll
        </Link>
        .
      </div>
    );
  }

  const form = useForm<OperationFormValues>({
    resolver: zodResolver(operationSchema),
    defaultValues: {
      type: OperationType.SIMPLE,
      legs: [createLeg(bankrolls[0].id)],
      description: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "legs",
  });

  const selectedType = form.watch("type");

  useEffect(() => {
    if (selectedType === OperationType.SIMPLE && fields.length > 1) {
      for (let i = fields.length - 1; i >= 1; i--) {
        remove(i);
      }
    }
  }, [selectedType, fields.length, remove]);

  const onSubmit = async (values: OperationFormValues) => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "operation-form",
        hypothesisId: "O1",
        location: "components/operation-form.tsx:111",
        message: "Submit values",
        data: {
          type: values.type,
          legsCount: values.legs?.length ?? 0,
          oddsType: typeof values.legs?.[0]?.odds,
          stakeType: typeof values.legs?.[0]?.stake,
          eventDateType: typeof values.legs?.[0]?.eventDate,
          expectedReturnOverrideType: typeof (values as { expectedReturnOverride?: unknown })
            .expectedReturnOverride,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    setIsSubmitting(true);
    setFeedback(null);
    const result = await createOperation(values);
    setIsSubmitting(false);
    setFeedback(result.message);

    if (result.ok) {
      form.reset({
        type: OperationType.SIMPLE,
        legs: [createLeg(bankrolls[0].id)],
        description: "",
      });
    }
  };

  const showAddLeg = selectedType !== OperationType.SIMPLE;
  const showExpectedOverride = selectedType === OperationType.MATCHED;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Operation Type</p>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((option) => (
              <Button
                key={option.type}
                variant={selectedType === option.type ? "default" : "outline"}
                size="sm"
                type="button"
                onClick={() => form.setValue("type", option.type)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {typeOptions.find((option) => option.type === selectedType)?.description}
          </p>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="space-y-4 rounded-lg border px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Leg {index + 1}</p>
              {selectedType !== OperationType.SIMPLE && fields.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => remove(index)}
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`legs.${index}.selection`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selection</FormLabel>
                    <FormControl>
                      <Input placeholder="Team A to win" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`legs.${index}.bankrollId`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bankroll</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select bankroll" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bankrolls.map((bankroll) => (
                          <SelectItem key={bankroll.id} value={bankroll.id}>
                            {bankroll.bookmakerName} ({bankroll.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name={`legs.${index}.odds`}
                render={({ field }) => {
                  // #region agent log
                  fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sessionId: "debug-session",
                      runId: "operation-form",
                      hypothesisId: "O2",
                      location: "components/operation-form.tsx:208",
                      message: "Render odds field",
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
                    <FormLabel>Odds</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="1.01"
                        {...fieldProps}
                        value={safeValue}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name={`legs.${index}.stake`}
                render={({ field }) => {
                  // #region agent log
                  fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sessionId: "debug-session",
                      runId: "operation-form",
                      hypothesisId: "O3",
                      location: "components/operation-form.tsx:220",
                      message: "Render stake field",
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
                    <FormLabel>Stake</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...fieldProps}
                        value={safeValue}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name={`legs.${index}.eventDate`}
                render={({ field }) => {
                  // #region agent log
                  fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sessionId: "debug-session",
                      runId: "operation-form",
                      hypothesisId: "O4",
                      location: "components/operation-form.tsx:233",
                      message: "Render eventDate field",
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
                  const safeValue = typeof value === "string" ? value : "";
                  return (
                  <FormItem>
                    <FormLabel>Event Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...fieldProps} value={safeValue} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  );
                }}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`legs.${index}.sport`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sport</FormLabel>
                    <FormControl>
                      <Input placeholder="Soccer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`legs.${index}.league`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>League</FormLabel>
                    <FormControl>
                      <Input placeholder="Premier League" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ))}

        {showAddLeg && (
          <Button
            variant="outline"
            type="button"
            onClick={() => append(createLeg(bankrolls[0].id))}
          >
            Add leg
          </Button>
        )}

        {showExpectedOverride && (
          <FormField
            control={form.control}
            name="expectedReturnOverride"
            render={({ field }) => {
              // #region agent log
              fetch("http://127.0.0.1:7242/ingest/bd0f999b-d44a-4541-8b77-6bbb1d690a90", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId: "debug-session",
                  runId: "operation-form",
                  hypothesisId: "O5",
                  location: "components/operation-form.tsx:298",
                  message: "Render expectedReturnOverride field",
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
                <FormLabel>Expected Return</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...fieldProps}
                    value={safeValue}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              );
            }}
          />
        )}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Optional notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {feedback ? (
          <p className="text-sm text-muted-foreground">{feedback}</p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Create Operation"}
        </Button>
      </form>
    </Form>
  );
}
