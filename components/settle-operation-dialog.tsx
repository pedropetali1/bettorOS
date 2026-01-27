"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { type BetStatus, OperationType } from "@prisma/client";
import { useForm, useWatch } from "react-hook-form";

import { settleOperationAction } from "@/app/actions/financial-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

type OperationLeg = {
  id: string;
  selection: string;
  stake: string | number;
  odds: string | number;
  bankroll?: { bookmakerName: string };
  bankrollName?: string;
};

type OperationWithLegs = {
  id: string;
  type: OperationType;
  status: BetStatus;
  legs: OperationLeg[];
};

type SettleFormValues = {
  status: BetStatus;
  actualReturn?: string;
  winningLegId?: string;
};

type ToastState = { type: "success" | "error"; message: string } | null;

const statusOptions: BetStatus[] = [
  "PENDING",
  "WON",
  "LOST",
  "VOID",
  "CASHED_OUT",
];

export function SettleOperationDialog({
  operation,
  triggerLabel = "Settle",
}: {
  operation: OperationWithLegs;
  triggerLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState>(null);

  const form = useForm<SettleFormValues>({
    defaultValues: {
      status: operation.status ?? "PENDING",
      actualReturn: "",
      winningLegId: "",
    },
  });

  const status = useWatch({ control: form.control, name: "status" });
  const isArbitrage =
    operation.type === OperationType.ARBITRAGE ||
    operation.type === OperationType.MATCHED;
  const showWinningLeg = status === "WON" && isArbitrage;
  const showCashoutReturn = status === "CASHED_OUT";
  const showOptionalReturn = status === "WON" && !isArbitrage;

  const legOptions = useMemo(
    () =>
      operation.legs.map((leg) => ({
        id: leg.id,
        label: `${leg.bankroll?.bookmakerName ?? leg.bankrollName ?? "Bookmaker"} - ${
          leg.selection
        } - ${Number(leg.stake).toFixed(2)}`,
      })),
    [operation.legs]
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const submit = (values: SettleFormValues) => {
    if (values.status === "PENDING") {
      setToast({ type: "error", message: "Select a final status before settling." });
      return;
    }

    if (showWinningLeg && !values.winningLegId) {
      setToast({ type: "error", message: "Select which leg won the arbitrage." });
      return;
    }

    if (showCashoutReturn && !values.actualReturn) {
      setToast({ type: "error", message: "Actual return is required for cashout." });
      return;
    }

    startTransition(async () => {
      const result = await settleOperationAction({
        operationId: operation.id,
        status: values.status,
        actualReturn: values.actualReturn ? Number(values.actualReturn) : undefined,
        winningLegId: values.winningLegId || undefined,
      });

      setToast({
        type: result.ok ? "success" : "error",
        message: result.message,
      });
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settle Operation</DialogTitle>
          <DialogDescription>
            Update the final status and adjust bankroll balances safely.
          </DialogDescription>
        </DialogHeader>

        {toast ? (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-md border px-3 py-2 text-xs ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {toast.message}
          </div>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showWinningLeg ? (
              <FormField
                control={form.control}
                name="winningLegId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qual aposta venceu?</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {legOptions.map((leg) => (
                          <label
                            key={leg.id}
                            className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
                          >
                            <input
                              type="radio"
                              name={field.name}
                              value={leg.id}
                              checked={field.value === leg.id}
                              onChange={() => field.onChange(leg.id)}
                              className="mt-1 size-4 accent-primary"
                            />
                            <span className="text-muted-foreground">{leg.label}</span>
                          </label>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {showCashoutReturn || showOptionalReturn ? (
              <FormField
                control={form.control}
                name="actualReturn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {showCashoutReturn ? "Retorno real (obrigatorio)" : "Retorno real (opcional)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Settle"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
