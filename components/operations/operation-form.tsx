"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OperationType } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { createOperation } from "@/app/actions/operation-actions";
import { BetScanner } from "@/components/operations/bet-scanner";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OperationFormValues,
  operationSchema,
} from "@/lib/validations/operation";
import { useToast } from "@/hooks/use-toast";

type BankrollOption = {
  id: string;
  bookmakerName: string;
  currency: string;
  currentBalance: string;
};

type OperationFormProps = {
  bankrolls: BankrollOption[];
  onSuccess?: () => void;
};

const typeOptions = [
  {
    type: OperationType.SIMPLE,
    label: "Simple",
    description: "Single bet, single bankroll.",
  },
  {
    type: OperationType.ARBITRAGE,
    label: "Arbitrary",
    description: "Multiple legs across bankrolls (arbitrage).",
  },
  {
    type: OperationType.MATCHED,
    label: "Multi-leg",
    description: "Multiple legs in the same bankroll (matched).",
  },
];

const createLeg = (bankrollId: string) => ({
  matchName: "",
  selection: "",
  odds: 0,
  stake: 0,
  eventDate: new Date().toISOString().slice(0, 10),
  sport: "",
  league: "",
  bankrollId,
});

export function OperationForm({ bankrolls, onSuccess }: OperationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const balanceById = useMemo(
    () =>
      new Map(
        bankrolls.map((bankroll) => [
          bankroll.id,
          {
            balance: Number(bankroll.currentBalance),
            currency: bankroll.currency,
          },
        ])
      ),
    [bankrolls]
  );

  const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(Number.isNaN(value) ? 0 : value);

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const matchBankrollId = (bookmakerName: string | null) => {
    if (!bookmakerName) return null;
    const needle = normalize(bookmakerName);
    let best: BankrollOption | null = null;
    for (const bankroll of bankrolls) {
      const candidate = normalize(bankroll.bookmakerName);
      if (candidate === needle) {
        return bankroll.id;
      }
      if (candidate.includes(needle) || needle.includes(candidate)) {
        best = bankroll;
      }
    }
    return best?.id ?? null;
  };

  const parseNumber = (value: string | number | null) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value;
    const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const toDateInput = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  };

  if (bankrolls.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        You need at least one bankroll before creating an operation.{" "}
        <Link href="/onboarding" className="text-primary underline">
          Start onboarding
        </Link>
        .
      </div>
    );
  }

  const form = useForm<OperationFormValues>({
    resolver: zodResolver(operationSchema),
    defaultValues: {
      type: OperationType.SIMPLE,
      matchedOdds: undefined,
      legs: [createLeg(bankrolls[0].id)],
      description: "",
    },
  });

  const { fields, append, remove, update } = useFieldArray({
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
    if (selectedType === OperationType.ARBITRAGE) {
      if (fields.length < 2) {
        append(createLeg(bankrolls[0].id));
      }
      if (fields.length > 2) {
        for (let i = fields.length - 1; i >= 2; i--) {
          remove(i);
        }
      }
    }
  }, [selectedType, fields.length, remove, append, bankrolls]);

  const onSubmit = async (values: OperationFormValues) => {
    let hasError = false;
    let errorMessage: string | null = null;

    if (values.type === OperationType.ARBITRAGE) {
      if (values.legs.length !== 2) {
        errorMessage = "Arbitrage requires exactly two legs.";
        return;
      }
      const [first, second] = values.legs;
      if (first.bankrollId === second.bankrollId) {
        form.setError("legs.0.bankrollId", {
          type: "manual",
          message: "Use two different bankrolls for arbitrage.",
        });
        form.setError("legs.1.bankrollId", {
          type: "manual",
          message: "Use two different bankrolls for arbitrage.",
        });
        hasError = true;
        errorMessage = "Arbitrage requires two different bankrolls.";
      }
      if (
        first.selection &&
        second.selection &&
        first.selection.trim().toLowerCase() === second.selection.trim().toLowerCase()
      ) {
        form.setError("legs.0.selection", {
          type: "manual",
          message: "Selections must be opposite sides.",
        });
        form.setError("legs.1.selection", {
          type: "manual",
          message: "Selections must be opposite sides.",
        });
        hasError = true;
        errorMessage = "Arbitrage requires opposite selections.";
      }
    }

    values.legs.forEach((leg, index) => {
      const selected = balanceById.get(leg.bankrollId);
      const stake = Number(leg.stake);
      if (!selected || Number.isNaN(stake)) return;

      if (stake > selected.balance) {
        form.setError(`legs.${index}.stake`, {
          type: "manual",
          message: `Saldo insuficiente (Disp: ${formatCurrency(
            selected.balance,
            selected.currency
          )})`,
        });
        hasError = true;
        errorMessage = "Saldo insuficiente para uma ou mais legs.";
      }
    });

    if (hasError) {
      toast({
        variant: "destructive",
        title: "Revise os dados",
        description: errorMessage ?? "Corrija os erros antes de continuar.",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await createOperation(values);
    setIsSubmitting(false);

    if (result.ok) {
      form.reset({
        type: OperationType.SIMPLE,
        matchedOdds: undefined,
        legs: [createLeg(bankrolls[0].id)],
        description: "",
      });
      toast({ title: "Operação criada", description: result.message });
      onSuccess?.();
    } else {
      toast({
        variant: "destructive",
        title: "Não foi possível criar a operação",
        description: result.message,
      });
    }
  };

  const showAddLeg =
    selectedType !== OperationType.SIMPLE && selectedType !== OperationType.ARBITRAGE;

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

        <BetScanner
          onScanComplete={(data) => {
            const items = Array.isArray(data) ? data : [data];
            const hasMultipleSelections = items.length > 1;

            if (hasMultipleSelections) {
              form.setValue("type", OperationType.MATCHED);
            }

            const currentLegCount = fields.length;
            if (currentLegCount < items.length) {
              for (let i = currentLegCount; i < items.length; i += 1) {
                append(createLeg(bankrolls[0].id));
              }
            } else if (currentLegCount > items.length) {
              for (let i = currentLegCount - 1; i >= items.length; i -= 1) {
                remove(i);
              }
            }

            const commonBankroll = matchBankrollId(items[0]?.bookmakerName ?? null);
            const oddsValues = items
              .map((item) => parseNumber(item.odds))
              .filter((value): value is number => value !== null);
            const stakeValues = items
              .map((item) => parseNumber(item.stake))
              .filter((value): value is number => value !== null);
            const uniqueOdds = Array.from(new Set(oddsValues));
            const uniqueStakes = Array.from(new Set(stakeValues));
            const useCombinedOdds = hasMultipleSelections && uniqueOdds.length === 1;

            if (useCombinedOdds) {
              form.setValue("matchedOdds", uniqueOdds[0]);
            } else {
              form.setValue("matchedOdds", undefined);
            }

            items.forEach((item, index) => {
              const bankId =
                commonBankroll ??
                (item.bookmakerName ? matchBankrollId(item.bookmakerName) : null);
              if (bankId) {
                form.setValue(`legs.${index}.bankrollId`, bankId);
              }

              const matchName = item.matchName ?? items[0]?.matchName ?? null;
              if (matchName) {
                form.setValue(`legs.${index}.matchName`, matchName);
              }
              if (item.selection) {
                form.setValue(`legs.${index}.selection`, item.selection);
              }

              if (useCombinedOdds) {
                form.setValue(`legs.${index}.odds`, undefined as unknown as number);
              } else {
                const odds = parseNumber(item.odds);
                if (odds !== null) {
                  form.setValue(`legs.${index}.odds`, odds);
                }
              }

              if (useCombinedOdds && uniqueStakes.length === 1 && uniqueStakes[0] !== null) {
                form.setValue(`legs.${index}.stake`, index === 0 ? uniqueStakes[0] : 0);
              } else {
                const stake = parseNumber(item.stake);
                if (stake !== null) {
                  form.setValue(`legs.${index}.stake`, stake);
                }
              }

              const date = toDateInput(item.date ?? items[0]?.date ?? null);
              if (date) {
                form.setValue(`legs.${index}.eventDate`, date);
              }
              const sport = item.sport ?? items[0]?.sport ?? null;
              if (sport) {
                form.setValue(`legs.${index}.sport`, sport);
              }
              const league = item.league ?? items[0]?.league ?? null;
              if (league) {
                form.setValue(`legs.${index}.league`, league);
              }
            });
          }}
        />

        {selectedType === OperationType.MATCHED ? (
          <FormField
            control={form.control}
            name="matchedOdds"
            render={({ field }) => {
              const { value, ...fieldProps } = field;
              const safeValue =
                typeof value === "number" || typeof value === "string" ? value : "";
              return (
                <FormItem>
                  <FormLabel>Odd da múltipla</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="1.01" {...fieldProps} value={safeValue} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : null}

        {fields.map((field, index) => (
          <Card key={field.id} className="gap-4 py-4">
            <CardHeader className="px-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {selectedType === OperationType.ARBITRAGE
                    ? `Leg ${index + 1} (Side ${index + 1})`
                    : `Leg #${index + 1}`}
                </CardTitle>
                {selectedType === OperationType.ARBITRAGE ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => update(index, createLeg(bankrolls[0].id))}
                  >
                    Clear
                  </Button>
                ) : (
                  selectedType !== OperationType.SIMPLE &&
                  fields.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  )
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`legs.${index}.matchName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jogo / Evento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Team A vs Team B"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`legs.${index}.selection`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selecao</FormLabel>
                      <FormControl>
                      <Input
                        placeholder={
                          selectedType === OperationType.ARBITRAGE
                            ? index === 0
                              ? "Outcome A"
                              : "Outcome B"
                            : "Over 2.5 Goals"
                        }
                        {...field}
                      />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-4 lg:grid-cols-4">
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
                              {bankroll.bookmakerName} -{" "}
                              {formatCurrency(
                                Number(bankroll.currentBalance),
                                bankroll.currency
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`legs.${index}.odds`}
                    render={({ field }) => {
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
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-6">
                <FormField
                  control={form.control}
                  name={`legs.${index}.eventDate`}
                  render={({ field }) => {
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
            </CardContent>
          </Card>
        ))}

        {showAddLeg && (
          <Button
            variant="outline"
            type="button"
            className="w-full sm:w-auto"
            onClick={() => append(createLeg(bankrolls[0].id))}
          >
            Add leg
          </Button>
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

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Saving..." : "Create Operation"}
        </Button>
      </form>
    </Form>
  );
}
